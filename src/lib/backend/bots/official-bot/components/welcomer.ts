import { WELCOMER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent, NOTIFICATIONS } from '../../../config.js';
import { EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { aiGreetingMessages } from './aiGreeting.js';
import { attributeJoin, type JoinInviteResult } from './invites.js';
import { INVITE_SOURCE_LABEL } from '../../../../invites.js';
import { serverTranslator, type Translator } from '../i18n.js';

const INVITE_WAIT_MS = 5_000;

async function waitForInvite(member): Promise<JoinInviteResult | null> {
	return Promise.race([attributeJoin(member), new Promise<null>((resolve) => setTimeout(() => resolve(null), INVITE_WAIT_MS))]).catch(() => null);
}

function inviterText(invite: JoinInviteResult | null, tr: Translator): string {
	if (invite?.inviterDiscordId) return `<@${invite.inviterDiscordId}>`;
	if (invite?.source === 'vanity') return tr('welcomer.inviter.vanity');
	if (invite?.source === 'server') return tr('welcomer.inviter.server');
	return tr('welcomer.inviter.someone');
}

function invitedByText(invite: JoinInviteResult, tr: Translator): string {
	if (!invite.inviterDiscordId) return inviterText(invite, tr);
	const link = INVITE_SOURCE_LABEL[invite.source] ? tr(`welcomer.inviteSources.${invite.source}`) : null;
	const inviter = tr('welcomer.inviterCount', { inviter: `<@${invite.inviterDiscordId}>`, count: invite.inviterTotal ?? 0 });
	return `${inviter}${link ? `\n${link}` : ''}`;
}

function replacePlaceholders(message, memberId, serverData, memberData, memberCount, tr: Translator, invite: JoinInviteResult | null = null) {
	const now = new Date();
	let profileCreatedAt = null;
	if (memberData?.profile_created_at) {
		if (memberData.profile_created_at instanceof Date) {
			profileCreatedAt = memberData.profile_created_at;
		} else {
			profileCreatedAt = parseMySQLDateTimeUtc(memberData.profile_created_at);
		}
	}
	const accountAge = profileCreatedAt ? Math.floor((now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
	const accountAgeText =
		accountAge === 0
			? tr('welcomer.accountAge.today')
			: accountAge === 1
				? tr('welcomer.accountAge.oneDay')
				: tr('welcomer.accountAge.days', { days: accountAge });

	return message
		.replace(/{user}/g, `<@${memberId}>`)
		.replace(/{server}/g, serverData?.name || tr('welcomer.unknownServer'))
		.replace(/{memberCount}/g, (memberCount || 0).toString())
		.replace(/{accountAge}/g, accountAgeText)
		.replace(/{inviter}/g, inviterText(invite, tr))
		.replace(/{inviteCount}/g, (invite?.inviterTotal ?? 0).toString());
}

async function welcomeUser(member, client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log(`⚠️ Bot config not available, skipping welcome message`);
			return;
		}

		if (!(await isComponentFeatureEnabled(member.guild.id, serverSettingsComponent.welcomer))) {
			return;
		}

		const welcomeChannelIds = await WELCOMER.getChannels(member.guild.id);

		if (!welcomeChannelIds || welcomeChannelIds.length === 0) {
			await logger.log(`⚠️ No welcome channels configured for ${member.guild.id}, skipping welcome message`);
			return;
		}

		try {
			await member.guild.fetch();
		} catch (fetchError) {
			await logger.log(`⚠️ Failed to fetch guild ${member.guild.id} before welcome: ${fetchError.message}`);
		}

		const serverData = await db.upsertOfficialServer(botConfig.id, member.guild);
		if (!serverData) {
			await logger.log(`⚠️ Server not found in database for ${member.guild.id}, skipping welcome message`);
			return;
		}

		const memberData = (await db.upsertMember(serverData.id, member)) || (await db.getMemberByDiscordId(serverData.id, member.user.id));
		if (!memberData) {
			await logger.log(`⚠️ Member not found in database for ${member.user.id}, skipping welcome message`);
			return;
		}

		const configured = await WELCOMER.getMessages(member.guild.id);

		if (!configured || configured.length === 0) {
			await logger.log(`⚠️ No welcome messages configured for ${member.guild.id}, skipping welcome message`);
			return;
		}

		const custom = await WELCOMER.hasCustomMessages(member.guild.id).catch(() => true);
		const generated = custom
			? null
			: await aiGreetingMessages('welcome', { botId: botConfig.id, serverId: serverData.id, serverName: member.guild?.name || serverData.name });
		const messages = generated?.length ? generated : configured;

		const guildMemberCount = member.guild?.memberCount ?? (serverData?.total_members || 0);
		const invite = await waitForInvite(member);
		const tr = await serverTranslator(member.guild.id);
		const randomMessage = messages[Math.floor(Math.random() * messages.length)];
		const welcomeMessage = replacePlaceholders(randomMessage, member.user.id, serverData, memberData, guildMemberCount, tr, invite);

		const embedConfig = await getEmbedConfig(member.guild.id);

		let profileCreatedAt = null;
		if (memberData.profile_created_at) {
			if (memberData.profile_created_at instanceof Date) {
				profileCreatedAt = memberData.profile_created_at;
			} else {
				profileCreatedAt = parseMySQLDateTimeUtc(memberData.profile_created_at);
			}
		}
		const accountCreatedTimestamp = profileCreatedAt ? Math.floor(profileCreatedAt.getTime() / 1000) : Math.floor(Date.now() / 1000);

		const welcomeEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(tr('welcomer.title'))
			.setDescription(welcomeMessage)
			.setThumbnail(memberData.avatar || null)
			.addFields([
				{
					name: tr('welcomer.fields.accountCreated'),
					value: `<t:${accountCreatedTimestamp}:R>`,
					inline: true
				},
				{
					name: tr('welcomer.fields.memberCount'),
					value: tr('welcomer.memberNumber', { count: guildMemberCount || 0 }),
					inline: true
				},
				...(invite?.inviterDiscordId || invite?.source === 'vanity' || invite?.source === 'server'
					? [
							{
								name: tr('welcomer.fields.invitedBy'),
								value: invitedByText(invite, tr),
								inline: true
							}
						]
					: [])
			])
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		for (const channelId of welcomeChannelIds) {
			const welcomeChannel = client.channels.cache.get(channelId);
			if (welcomeChannel) {
				try {
					const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(member.guild.id, channelId).catch(() => null);
					await welcomeChannel.send({
						content: notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined,
						embeds: [welcomeEmbed]
					});

					if (notificationMentions && notificationMentions.length > 1) {
						for (let i = 1; i < notificationMentions.length; i++) {
							await welcomeChannel.send({ content: notificationMentions[i] }).catch(() => null);
						}
					}

					const memberName = memberData.display_name || memberData.username || `User ${member.user.id}`;
					await logger.log(`✅ Welcomed ${memberName} (${member.user.id}) in ${serverData.name} to channel ${welcomeChannel.name}`);
				} catch (err) {
					await logger.log(`❌ Failed to send welcome message to channel ${channelId}: ${err.message}`);
				}
			} else {
				await logger.log(`❌ Welcome channel not found: ${channelId}`);
			}
		}
	} catch (err) {
		await logger.log(`❌ Failed to welcome ${member.user.id}: ${err.message}`);
	}
}

function init(client) {
	client.on('guildMemberAdd', async (member) => {
		if (member.user?.bot) return;

		const botConfig = getBotConfig();
		if (botConfig && botConfig.id) {
			try {
				const serverData = await db.getServerByDiscordId(botConfig.id, member.guild.id);
				if (serverData) {
					const memberData = await db.getMemberByDiscordId(serverData.id, member.user.id);
					const memberName = memberData ? memberData.display_name || memberData.username : `User ${member.user.id}`;
					await logger.log(`👤 Member join event: ${memberName} (${member.user.id}) joined ${serverData.name}`);
				} else {
					await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
				}
			} catch (err) {
				await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
			}
		} else {
			await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
		}
		await welcomeUser(member, client);
	});
}

export default { init };
