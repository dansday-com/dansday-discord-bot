import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getEmbedConfig, getLevelingSettings, getServerForCurrentBot, DEFAULT_LEVELING_SETTINGS } from '../../../../config.js';
import { logger } from '../../../../../utils/index.js';
import db from '../../../../../database.js';
import { translate } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { inviteRewardFor, rememberCreatedInvite } from '../invites.js';

function pickInviteChannel(guild: any) {
	const me = guild.members.me;
	const everyone = guild.roles.everyone;
	const usable = (channel: any) =>
		channel &&
		(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
		channel.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite) &&
		channel.permissionsFor(everyone)?.has(PermissionFlagsBits.ViewChannel);
	const preferred = [guild.rulesChannel, guild.systemChannel].find(usable);
	if (preferred) return preferred;
	return [...guild.channels.cache.values()].filter(usable).sort((a: any, b: any) => a.rawPosition - b.rawPosition)[0] ?? null;
}

async function ensurePersonalInvite(guild: any, memberId: number, userTag: string): Promise<string | null> {
	const stored = await db.getMemberInviteLink(memberId).catch(() => null);
	if (stored) {
		const live = await guild.client.fetchInvite(stored).catch(() => null);
		if (live?.guild?.id === guild.id) return stored;
	}
	const channel = pickInviteChannel(guild);
	if (!channel) return null;
	const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: `Personal invite link for ${userTag}` }).catch(() => null);
	if (!invite?.code) return null;
	await db.setMemberInviteLink(memberId, invite.code);
	rememberCreatedInvite(guild.id, invite);
	return invite.code;
}

export async function handleInvitesButton(interaction: any) {
	const guild = interaction.guild;
	const g = guild.id;
	const u = interaction.user.id;

	try {
		await interaction.deferReply({ flags: 64 });

		const server = await getServerForCurrentBot(g);
		const guildMember = interaction.member ?? (await guild.members.fetch(u).catch(() => null));
		const dbMember = guildMember ? await db.upsertMember(server.id, guildMember).catch(() => null) : null;
		if (!guildMember || !dbMember?.id) {
			await interaction.editReply({ content: await translate('common.errors.memberNotFound', g, u) });
			return;
		}

		let settings = DEFAULT_LEVELING_SETTINGS.INVITE;
		try {
			settings = (await getLevelingSettings(g)).INVITE;
		} catch (_) {}

		const [stats, inviter, reward, code] = await Promise.all([
			db.getMemberInviteStats(Number(dbMember.id)),
			db.getMemberInviter(Number(dbMember.id)).catch(() => null),
			inviteRewardFor(guildMember),
			ensurePersonalInvite(guild, Number(dbMember.id), interaction.user.tag)
		]);

		const embedConfig = await getEmbedConfig(g);
		const hold = settings.HOLD_HOURS > 0 ? await translate('invites.hold', g, u, { hours: settings.HOLD_HOURS }) : '';
		const staffNote = reward.multiplier > 1 ? `\n${await translate('invites.staffNote', g, u, { multiplier: reward.multiplier })}` : '';
		const sharePercent = settings.SHARE_PERCENT * reward.multiplier;
		const shareLine = sharePercent > 0 ? `\n${await translate('invites.share', g, u, { percent: sharePercent })}` : '';
		const rewardLine = `${await translate('invites.reward', g, u, { xp: reward.xp.toLocaleString(), hold })}${staffNote}${shareLine}`;
		const linkLine = code ? await translate('invites.link', g, u, { url: `https://discord.gg/${code}` }) : await translate('invites.noLink', g, u);

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
		if (code) {
			row.addComponents(
				new ButtonBuilder()
					.setLabel(await translate('invites.copyButton', g, u))
					.setURL(`https://discord.gg/${code}`)
					.setStyle(ButtonStyle.Link)
			);
		}
		row.addComponents(await menuBackButton(g, u, 'me'));

		await interaction.editReply({ embeds: [embed], components: [row] });
	} catch (error) {
		await logger.log(`❌ Invites menu error: ${error.message}`);
		await interaction.editReply({ content: await translate('invites.error', g, u) }).catch(() => null);
	}
}
