import { BOOSTER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { pickGreetingMessage, postGreeting } from './greetings.js';
import { serverTranslator, type Translator } from '../i18n.js';
import type { GuildMember, PartialGuildMember, Client } from 'discord.js';
import { SECOND_MS } from '../../../../utils/time.js';

type BoosterValues = { memberId: string; serverName: string; boostLevel: number; totalBoosts: number };

function replaceBoosterPlaceholders(message: string, { memberId, serverName, boostLevel, totalBoosts }: BoosterValues) {
	return message
		.replace(/\{user\}/g, `<@${memberId}>`)
		.replace(/\{server\}/g, serverName || 'Unknown Server')
		.replace(/\{boostLevel\}/g, String(boostLevel))
		.replace(/\{totalBoosts\}/g, String(totalBoosts));
}

type BoostCard = { message: string; avatar: string | null; boostLevel: number; totalBoosts: number; boosterSince: Date | string | null };

function boostLevelOf(premiumTier: unknown, fallback: number) {
	if (!premiumTier) {
		return fallback;
	}
	const tier = String(premiumTier);
	const match = /TIER_(\d+)/.exec(tier);
	return match ? parseInt(match[1], 10) : parseInt(tier, 10) || 0;
}

function boostedSinceText(boosterSince: Date | string | null, tr: Translator) {
	const since = !boosterSince ? null : boosterSince instanceof Date ? boosterSince : parseMySQLDateTimeUtc(boosterSince);
	return since ? `<t:${Math.floor(since.getTime() / SECOND_MS)}:R>` : tr('booster.justNow');
}

function boosterEmbed(tr: Translator, embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>, card: BoostCard) {
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('booster.title'))
		.setDescription(card.message)
		.setThumbnail(card.avatar)
		.addFields([
			{ name: tr('booster.fields.boostLevel'), value: tr('booster.level', { level: card.boostLevel }), inline: true },
			{ name: tr('booster.fields.totalBoosts'), value: `${card.totalBoosts}`, inline: true },
			{ name: tr('booster.fields.boostedSince'), value: boostedSinceText(card.boosterSince, tr), inline: false }
		])
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
}

async function boosterRecords(member: GuildMember, botId: number) {
	await member.guild.fetch().catch((fetchError) => logger.log(`⚠️ Failed to fetch guild ${member.guild.id} before booster: ${(fetchError as Error).message}`));
	const serverData = await db.upsertOfficialServer(botId, member.guild);
	if (!serverData) {
		await logger.log(`⚠️ Server not found in database for ${member.guild.id}, skipping booster message`);
		return null;
	}
	const memberData = await db.upsertMember(serverData.id, member);
	if (!memberData) {
		await logger.log(`⚠️ Member not found in database for ${member.user.id}, skipping booster message`);
		return null;
	}
	if (!memberData.display_name && !memberData.username) {
		await logger.log(`⚠️ Member profile incomplete for ${member.user.id}, skipping booster message`);
		return null;
	}
	return { serverData, memberData };
}

async function thankBooster(member: GuildMember, client: Client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log(`⚠️ Bot config not available, skipping booster message`);
			return;
		}
		if (!(await isComponentFeatureEnabled(member.guild.id, serverSettingsComponent.booster))) {
			return;
		}

		const boosterChannelIds = await BOOSTER.getChannels(member.guild.id);
		if (!boosterChannelIds || boosterChannelIds.length === 0) {
			await logger.log(`⚠️ No booster channels configured for ${member.guild.id}, skipping booster message`);
			return;
		}

		const records = await boosterRecords(member, botConfig.id);
		if (!records) {
			return;
		}
		const { serverData, memberData } = records;
		const randomMessage = await pickGreetingMessage(BOOSTER, {
			guildId: member.guild.id,
			kind: 'boost',
			label: 'booster',
			botId: botConfig.id,
			serverId: serverData.id,
			serverName: member.guild?.name || serverData.name
		});
		if (!randomMessage) {
			return;
		}

		const totalBoosts = member.guild?.premiumSubscriptionCount ?? (serverData?.total_boosters || 0);
		const boostLevel = boostLevelOf(member.guild?.premiumTier, serverData?.boost_level || 0);
		const tr = await serverTranslator(member.guild.id);
		const serverName = member.guild?.name || serverData?.name || tr('booster.unknownServer');
		const message = replaceBoosterPlaceholders(randomMessage, { memberId: member.user.id, serverName, boostLevel, totalBoosts });
		const embed = boosterEmbed(tr, await getEmbedConfig(member.guild.id), {
			message,
			avatar: memberData.avatar || null,
			boostLevel,
			totalBoosts,
			boosterSince: memberData.booster_since ?? null
		});

		const memberName = memberData.display_name || memberData.username;
		await postGreeting(client, boosterChannelIds, {
			embed,
			label: 'booster',
			sentLog: (channel) => `✅ Thanked booster ${memberName} (${member.user.id}) in ${serverData.name} (channel: ${channel.name})`
		});
	} catch (err) {
		await logger.log(`❌ Failed to thank booster ${member.user.id}: ${(err as Error).message}`);
	}
}

function init(client: Client) {
	client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
		try {
			const botConfig = getBotConfig();
			if (!botConfig || !botConfig.id) {
				return;
			}

			const wasBoosting = oldMember.premiumSince !== null;
			const isBoosting = newMember.premiumSince !== null;

			if (!wasBoosting && isBoosting) {
				const serverData = await db.upsertOfficialServer(botConfig.id, newMember.guild);
				if (serverData) {
					await db.upsertMember(serverData.id, newMember);
				}
				await thankBooster(newMember, client);
			} else if (wasBoosting && !isBoosting) {
				const serverData = await db.upsertOfficialServer(botConfig.id, newMember.guild);
				if (serverData) {
					await db.upsertMember(serverData.id, newMember);
				}
			}
		} catch (err) {
			await logger.log(`❌ Error handling booster update: ${(err as Error).message}`);
		}
	});
}

export default { init };
