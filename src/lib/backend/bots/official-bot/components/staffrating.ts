import { EmbedBuilder } from 'discord.js';
import { STAFF_RATING, getEmbedConfig } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { resolveStaffRatingAnchor } from './roleAnchor.js';
import db from '../../../../database.js';
import { serverTranslator, translate } from '../i18n.js';
import type { Guild, RoleCreateOptions, GuildMember } from 'discord.js';
import type { Translator } from '../i18n.js';
import { sendWithNotifiedMentions } from './notifiedMentions.js';
import { DISCORD_LIMITS, embedFieldText } from '../../../../discordLimits.js';
import { roundTo } from '../../../../utils/numbers.js';

const MIN_RATING = 1;
const MAX_RATING = 5;
const TOP_RATING_GREEN = 215;
const RED_CHANNEL_SHIFT_BITS = 16;
const GREEN_CHANNEL_SHIFT_BITS = 8;

function getRatingColor(rating: number) {
	const clamped = Math.max(MIN_RATING, Math.min(MAX_RATING, rating));
	const normalized = (clamped - MIN_RATING) / (MAX_RATING - MIN_RATING);

	const red = 255;
	const green = Math.round(0 + TOP_RATING_GREEN * normalized);
	const blue = Math.round(0 + 0 * normalized);

	return (red << RED_CHANNEL_SHIFT_BITS) | (green << GREEN_CHANNEL_SHIFT_BITS) | blue;
}

async function updateAllRatingRolePositions(guild: Guild, serverId: string | number) {
	const allRatings = await db.getAllStaffRatings(serverId);
	const withRoles = allRatings.filter((rating) => rating.rating_role_id && guild.roles.cache.has(rating.rating_role_id));
	if (withRoles.length === 0) {
		return;
	}

	const anchor = await resolveStaffRatingAnchor(guild, withRoles.length);
	if (!anchor.ok) {
		return;
	}

	for (let i = 0; i < withRoles.length; i++) {
		const role = guild.roles.cache.get(withRoles[i].rating_role_id);
		if (!role) {
			continue;
		}

		const targetPosition = anchor.basePosition + (withRoles.length - i - 1);

		if (role.position !== targetPosition) {
			await role.setPosition(targetPosition).catch(() => null);
		}
	}
}

type RatingChannelContext = { category?: string | null; feedback?: string | null };

type RatingEmbedInput = {
	staffDiscordId: string;
	ratingValue: number;
	totalReports: number;
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>> | null;
	channelContext?: RatingChannelContext;
};

function buildRatingChannelEmbed(tr: Translator, { staffDiscordId, ratingValue, totalReports, embedConfig, channelContext = {} }: RatingEmbedInput) {
	const categoryValue = channelContext.category ?? '—';
	const feedbackValue = embedFieldText(channelContext.feedback);

	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? null)
		.setTitle(tr('staffRating.ratingUpdate.title'))
		.setDescription(tr('staffRating.ratingUpdate.description', { staff: `<@${staffDiscordId}>` }))
		.addFields(
			{
				name: tr('staffRating.channelEmbed.fieldRating'),
				value: tr('staffRating.ratingUpdate.ratingValue', { rating: ratingValue.toFixed(1), totalReports })
			},
			{
				name: tr('staffRating.channelEmbed.fieldCategory'),
				value: categoryValue
			},
			{
				name: tr('staffRating.ratingUpdate.fieldFeedback'),
				value: feedbackValue
			}
		)
		.setTimestamp();

	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: embedConfig.FOOTER });
	}

	return embed;
}

type RatingRoleInput = { serverId: string | number; member: GuildMember; ratingValue: number; ratingRecord: { member_id: number } | null };

async function ensureRatingRole(guild: Guild, { serverId, member, ratingValue, ratingRecord }: RatingRoleInput) {
	const desiredName = `⭐ ${ratingValue.toFixed(1)} • Staff Rating`.slice(0, DISCORD_LIMITS.ROLE_NAME);
	const color = getRatingColor(ratingValue);

	const ratingRoleId = await db.getStaffRatingRole(serverId, ratingRecord?.member_id);
	let role = ratingRoleId ? guild.roles.cache.get(ratingRoleId) : null;
	if (!role) {
		const anchor = await resolveStaffRatingAnchor(guild);
		const creationData: RoleCreateOptions = {
			name: desiredName,
			color,
			reason: 'Staff rating role',
			mentionable: false
		};
		if (anchor.ok) {
			creationData.position = anchor.basePosition;
		}
		role = await guild.roles.create(creationData);
		await db.upsertRole(serverId, {
			id: role.id,
			name: role.name,
			position: role.position,
			hexColor: role.hexColor,
			permissions: role.permissions
		});
	} else {
		await role.edit({
			name: desiredName,
			color
		});
	}

	await updateAllRatingRolePositions(guild, serverId);

	return role;
}

type StaffRatingUpdate = {
	serverId: number;
	staffMemberId: string | number;
	staffDiscordId: string;
	stats?: { rating?: number | string; total_reports?: number } | null;
	options?: { channelContext?: RatingChannelContext };
};

export async function updateStaffRatingRole(guild: Guild, { serverId, staffMemberId, staffDiscordId, stats = null, options = {} }: StaffRatingUpdate) {
	try {
		const member = await guild.members.fetch(staffDiscordId).catch(() => null);
		if (!member) {
			return { updated: false, reason: 'member_not_found' };
		}
		let ratingRecord = await db.getStaffRating(serverId, staffMemberId);
		let totalReports = stats?.total_reports ?? ratingRecord?.total_reports ?? 0;
		let averageRating = stats?.rating ?? ratingRecord?.current_rating ?? 0;
		if (stats === null || stats.rating === undefined || stats.total_reports === undefined) {
			const aggregate = await db.getStaffRatingAggregate(serverId, staffMemberId);
			totalReports = aggregate.total_reports;
			averageRating = aggregate.average_rating || 0;
		}
		if (!totalReports || totalReports <= 0) {
			const ratingRoleId = await db.getStaffRatingRole(serverId, staffMemberId);
			if (ratingRoleId) {
				const role = guild.roles.cache.get(ratingRoleId);
				if (role) {
					await member.roles.remove(role.id).catch(() => null);
				}
			}
			await db.upsertStaffRating(serverId, staffMemberId, { ratingValue: 0, totalReports: 0 });
			await db.clearMemberRatingRole(staffMemberId);
			return { updated: false, reason: 'no_reports' };
		}
		const rounded = roundTo(Number(averageRating || 0), 1);
		const clamped = Math.max(MIN_RATING, Math.min(MAX_RATING, rounded));
		ratingRecord = await db.upsertStaffRating(serverId, staffMemberId, { ratingValue: clamped, totalReports });
		const role = await ensureRatingRole(guild, { serverId, member, ratingValue: clamped, ratingRecord });
		await db.upsertStaffRating(serverId, staffMemberId, { ratingValue: clamped, totalReports });
		await db.markMemberRatingRole(serverId, staffMemberId, role.id);
		if (!member.roles.cache.has(role.id)) {
			await member.roles.add(role.id, 'Staff rating updated');
		}
		let embedConfig = null;
		try {
			embedConfig = await getEmbedConfig(guild.id);
		} catch (error) {
			await logger.log(`⚠️ Failed to load embed config for rating channel: ${(error as Error).message}`);
		}

		const ratingChannelId = await STAFF_RATING.getRatingChannel(guild.id);
		if (ratingChannelId) {
			const channel = guild.channels.cache.get(ratingChannelId) || (await guild.channels.fetch(ratingChannelId).catch(() => null));
			if (channel && channel.isTextBased()) {
				const tr = await serverTranslator(guild.id);
				const ratingEmbed = buildRatingChannelEmbed(tr, {
					staffDiscordId,
					ratingValue: clamped,
					totalReports,
					embedConfig,
					channelContext: options.channelContext
				});
				await sendWithNotifiedMentions(channel, { embeds: [ratingEmbed] }).catch(() => null);
			}
		}
		const ratingDm = await translate(
			'staffRating.ratingUpdate.dm',
			{ guildId: guild.id, userId: staffDiscordId },
			{
				server: guild.name,
				rating: clamped.toFixed(1),
				totalReports
			}
		);
		await member.send({ content: ratingDm }).catch(() => null);
		return {
			updated: true,
			rating: clamped,
			total_reports: totalReports,
			role_name: role.name
		};
	} catch (error) {
		await logger.log(`❌ Error updating staff rating role: ${(error as Error).message}`);
		return { updated: false, reason: 'error', error: (error as Error).message };
	}
}

export default { updateStaffRatingRole };
