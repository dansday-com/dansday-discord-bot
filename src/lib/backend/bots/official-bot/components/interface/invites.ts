import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getEmbedConfig, getLevelingSettings, getServerForCurrentBot, DEFAULT_LEVELING_SETTINGS, publicSiteOrigin } from '../../../../config.js';
import { logger } from '../../../../../utils/index.js';
import db from '../../../../../database.js';
import { translate } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { inviteRewardFor, pickInviteChannel, rememberCreatedInvite } from '../invites.js';
import { listSluggedPublicServers } from '../../../../../frontend/public/server-slug/index.js';
import { INVITE_SLUG_MAX, INVITE_SLUG_MIN, inviteJoinPath, isValidInviteSlug, normalizeInviteSlug } from '../../../../../invites.js';

export const INVITE_SLUG_BUTTON_ID = 'invites_slug';
export const INVITE_SLUG_MODAL_ID = 'invites_slug_modal';
const SLUG_INPUT_ID = 'invites_slug_value';
const SLUG_ATTEMPTS = 50;

async function isServerSlug(slug: string): Promise<boolean> {
	const servers = await listSluggedPublicServers().catch(() => []);
	return servers.some((s) => s.slug === slug);
}

async function claimSlug(memberId: number, slug: string): Promise<boolean> {
	if (await isServerSlug(slug)) return false;
	return db.setMemberInviteSlug(memberId, slug);
}

async function claimDefaultSlug(memberId: number, name: string): Promise<string | null> {
	let base = normalizeInviteSlug(name)
		.slice(0, INVITE_SLUG_MAX - 6)
		.replace(/-+$/, '');
	if (base.length < INVITE_SLUG_MIN) base = base ? `${base}-member` : 'member';
	for (let i = 1; i <= SLUG_ATTEMPTS; i++) {
		const candidate = i === 1 ? base : `${base}-${i}`;
		if (await claimSlug(memberId, candidate)) return candidate;
	}
	const fallback = `${base}-${Math.random().toString(36).slice(2, 7)}`;
	return (await claimSlug(memberId, fallback)) ? fallback : null;
}

async function ensurePersonalInvite(guild: any, member: any, userTag: string): Promise<{ code: string; slug: string | null } | null> {
	const memberId = Number(member.id);
	const stored = await db.getMemberInviteLink(memberId).catch(() => null);
	let code: string | null = null;
	if (stored) {
		const live = await guild.client.fetchInvite(stored.code).catch(() => null);
		if (live?.guild?.id === guild.id) code = stored.code;
	}
	if (!code) {
		const channel = pickInviteChannel(guild);
		if (!channel) return null;
		const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: `Personal invite link for ${userTag}` }).catch(() => null);
		if (!invite?.code) return null;
		await db.setMemberInviteLink(memberId, invite.code);
		rememberCreatedInvite(guild.id, invite);
		code = invite.code;
	}
	const slug = stored?.slug ?? (await claimDefaultSlug(memberId, member.username || member.display_name || userTag));
	return { code, slug };
}

function joinUrl(link: { code: string; slug: string | null }) {
	return link.slug ? `${publicSiteOrigin()}${inviteJoinPath(link.slug)}` : `https://discord.gg/${link.code}`;
}

async function buildInvitesView(interaction: any) {
	const guild = interaction.guild;
	const g = guild.id;
	const u = interaction.user.id;

	const server = await getServerForCurrentBot(g);
	const guildMember = interaction.member ?? (await guild.members.fetch(u).catch(() => null));
	const dbMember = guildMember ? await db.upsertMember(server.id, guildMember).catch(() => null) : null;
	if (!guildMember || !dbMember?.id) return null;

	let settings = DEFAULT_LEVELING_SETTINGS.INVITE;
	try {
		settings = (await getLevelingSettings(g)).INVITE;
	} catch (_) {}

	const [stats, inviter, reward, link] = await Promise.all([
		db.getMemberInviteStats(Number(dbMember.id)),
		db.getMemberInviter(Number(dbMember.id)).catch(() => null),
		inviteRewardFor(guildMember),
		ensurePersonalInvite(guild, dbMember, interaction.user.tag)
	]);

	const embedConfig = await getEmbedConfig(g);
	const hold = settings.HOLD_HOURS > 0 ? await translate('invites.hold', g, u, { hours: settings.HOLD_HOURS }) : '';
	const staffNote = reward.multiplier > 1 ? `\n${await translate('invites.staffNote', g, u, { multiplier: reward.multiplier })}` : '';
	const sharePercent = settings.SHARE_PERCENT * reward.multiplier;
	const shareLine = sharePercent > 0 ? `\n${await translate('invites.share', g, u, { percent: sharePercent })}` : '';
	const rewardLine = `${await translate('invites.reward', g, u, { xp: reward.xp.toLocaleString(), hold })}${staffNote}${shareLine}`;
	const linkLine = link ? await translate('invites.link', g, u, { url: joinUrl(link) }) : await translate('invites.noLink', g, u);

	const fields = [
		{ name: await translate('invites.fields.total', g, u), value: stats.total.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.active', g, u), value: stats.active.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.left', g, u), value: stats.left.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.fake', g, u), value: stats.fake.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.bonus', g, u), value: stats.bonus.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.xp', g, u), value: stats.xp.toLocaleString(), inline: true },
		{ name: await translate('invites.fields.shareXp', g, u), value: stats.share_xp.toLocaleString(), inline: true }
	];
	if (stats.pending > 0) {
		fields.push({ name: await translate('invites.fields.pending', g, u), value: stats.pending.toLocaleString(), inline: true });
	}
	if (inviter?.inviter_discord_id) {
		fields.push({ name: await translate('invites.fields.invitedBy', g, u), value: `<@${inviter.inviter_discord_id}>`, inline: true });
	}

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('invites.title', g, u))
		.setDescription(`${rewardLine}\n\n${linkLine}`)
		.addFields(fields)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const row = new ActionRowBuilder<ButtonBuilder>();
	if (link) {
		row.addComponents(
			new ButtonBuilder()
				.setLabel(await translate('invites.copyButton', g, u))
				.setURL(joinUrl(link))
				.setStyle(ButtonStyle.Link),
			new ButtonBuilder()
				.setCustomId(INVITE_SLUG_BUTTON_ID)
				.setLabel(await translate('invites.customizeButton', g, u))
				.setStyle(ButtonStyle.Secondary)
		);
	}
	row.addComponents(await menuBackButton(g, u, 'me'));

	return { embeds: [embed], components: [row] };
}

export async function handleInvitesButton(interaction: any) {
	const g = interaction.guild.id;
	const u = interaction.user.id;

	try {
		await interaction.deferUpdate();
		const view = await buildInvitesView(interaction);
		if (!view) {
			await interaction.followUp({ content: await translate('common.errors.memberNotFound', g, u), flags: 64 });
			return;
		}
		await interaction.editReply(view);
	} catch (error) {
		await logger.log(`❌ Invites menu error: ${error.message}`);
		await interaction.followUp({ content: await translate('invites.error', g, u), flags: 64 }).catch(() => null);
	}
}

export async function handleInviteSlugButton(interaction: any) {
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const server = await getServerForCurrentBot(g);
	const dbMember = await db.getMemberByDiscordId(server.id, u).catch(() => null);
	const link = dbMember?.id ? await db.getMemberInviteLink(Number(dbMember.id)).catch(() => null) : null;

	const input = new TextInputBuilder()
		.setCustomId(SLUG_INPUT_ID)
		.setLabel(await translate('invites.slugLabel', g, u, { min: INVITE_SLUG_MIN, max: INVITE_SLUG_MAX }))
		.setStyle(TextInputStyle.Short)
		.setMinLength(INVITE_SLUG_MIN)
		.setMaxLength(INVITE_SLUG_MAX)
		.setRequired(true);
	if (link?.slug) input.setValue(link.slug);

	const modal = new ModalBuilder()
		.setCustomId(INVITE_SLUG_MODAL_ID)
		.setTitle(await translate('invites.slugTitle', g, u))
		.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
	await interaction.showModal(modal);
}

export async function handleInviteSlugModal(interaction: any) {
	const g = interaction.guild.id;
	const u = interaction.user.id;
	await interaction.deferReply({ flags: 64 });

	const slug = normalizeInviteSlug(interaction.fields.getTextInputValue(SLUG_INPUT_ID));
	if (!isValidInviteSlug(slug)) {
		await interaction.editReply({ content: await translate('invites.slugInvalid', g, u, { min: INVITE_SLUG_MIN, max: INVITE_SLUG_MAX }) });
		return;
	}

	const server = await getServerForCurrentBot(g);
	const dbMember = await db.getMemberByDiscordId(server.id, u).catch(() => null);
	const link = dbMember?.id ? await db.getMemberInviteLink(Number(dbMember.id)).catch(() => null) : null;
	if (!dbMember?.id || !link) {
		await interaction.editReply({ content: await translate('invites.noLink', g, u) });
		return;
	}

	if (link.slug !== slug && !(await claimSlug(Number(dbMember.id), slug))) {
		await interaction.editReply({ content: await translate('invites.slugTaken', g, u, { slug }) });
		return;
	}

	const url = `${publicSiteOrigin()}${inviteJoinPath(slug)}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setLabel(await translate('invites.copyButton', g, u))
			.setURL(url)
			.setStyle(ButtonStyle.Link)
	);
	await interaction.editReply({ content: await translate('invites.slugSaved', g, u, { url }), components: [row] });
}
