import { LEAVER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent, NOTIFICATIONS } from '../../../config.js';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { aiGreetingMessages } from './aiGreeting.js';
import { serverTranslator, type Translator } from '../i18n.js';

function timeInServerText(joinedAt: Date | null, tr: Translator): string {
	if (!joinedAt) return tr('leaver.timeInServer.unknown');
	const days = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
	if (days < 1) return tr('leaver.timeInServer.lessThanDay');
	if (days === 1) return tr('leaver.timeInServer.oneDay');
	return tr('leaver.timeInServer.days', { days });
}

function replacePlaceholders(message, memberId, username, serverName, memberCount, timeInServer) {
	return message
		.replace(/{username}/g, () => username)
		.replace(/{user}/g, `<@${memberId}>`)
		.replace(/{server}/g, () => serverName)
		.replace(/{memberCount}/g, (memberCount || 0).toString())
		.replace(/{timeInServer}/g, timeInServer);
}

async function farewellUser(member, client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log(`⚠️ Bot config not available, skipping leave message`);
			return;
		}

		if (!(await isComponentFeatureEnabled(member.guild.id, serverSettingsComponent.leaver))) {
			return;
		}

		const leaveChannelIds = await LEAVER.getChannels(member.guild.id);

		if (!leaveChannelIds || leaveChannelIds.length === 0) {
			await logger.log(`⚠️ No leave channels configured for ${member.guild.id}, skipping leave message`);
			return;
		}

		const serverData = await db.upsertOfficialServer(botConfig.id, member.guild);
		if (!serverData) {
			await logger.log(`⚠️ Server not found in database for ${member.guild.id}, skipping leave message`);
			return;
		}

		const memberData = await db.getMemberByDiscordId(serverData.id, member.user.id).catch(() => null);

		const configured = await LEAVER.getMessages(member.guild.id);

		if (!configured || configured.length === 0) {
			await logger.log(`⚠️ No leave messages configured for ${member.guild.id}, skipping leave message`);
			return;
		}

		const custom = await LEAVER.hasCustomMessages(member.guild.id).catch(() => true);
		const generated = custom
			? null
			: await aiGreetingMessages('leave', { botId: botConfig.id, serverId: serverData.id, serverName: member.guild?.name || serverData.name });
		const messages = generated?.length ? generated : configured;

		const tr = await serverTranslator(member.guild.id);
		const joinedAt: Date | null = member.joinedAt ?? (memberData?.member_since instanceof Date ? memberData.member_since : null);
		const timeInServer = timeInServerText(joinedAt, tr);
		const guildMemberCount = member.guild?.memberCount ?? (serverData?.total_members || 0);
		const username = escapeMarkdown(member.displayName || memberData?.display_name || member.user.username || `User ${member.user.id}`);
		const serverName = member.guild?.name || serverData?.name || tr('leaver.unknownServer');
		const randomMessage = messages[Math.floor(Math.random() * messages.length)];
		const leaveMessage = replacePlaceholders(randomMessage, member.user.id, username, serverName, guildMemberCount, timeInServer);

		const embedConfig = await getEmbedConfig(member.guild.id);

		const leaveEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(tr('leaver.title'))
			.setDescription(leaveMessage)
			.setThumbnail(member.user.displayAvatarURL?.() || memberData?.avatar || null)
			.addFields([
				{
					name: tr('leaver.fields.joined'),
					value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:D>` : tr('leaver.unknownDate'),
					inline: true
				},
				{
					name: tr('leaver.fields.timeInServer'),
					value: timeInServer,
					inline: true
				},
				{
					name: tr('leaver.fields.memberCount'),
					value: tr('leaver.membersNow', { count: guildMemberCount || 0 }),
					inline: true
				}
			])
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		for (const channelId of leaveChannelIds) {
			const leaveChannel = client.channels.cache.get(channelId);
			if (leaveChannel) {
				try {
					const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(member.guild.id, channelId).catch(() => null);
					await leaveChannel.send({
						content: notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined,
						embeds: [leaveEmbed]
					});

					if (notificationMentions && notificationMentions.length > 1) {
						for (let i = 1; i < notificationMentions.length; i++) {
							await leaveChannel.send({ content: notificationMentions[i] }).catch(() => null);
						}
					}

					await logger.log(`✅ Said goodbye to ${username} (${member.user.id}) in ${serverData.name} to channel ${leaveChannel.name}`);
				} catch (err) {
					await logger.log(`❌ Failed to send leave message to channel ${channelId}: ${err.message}`);
				}
			} else {
				await logger.log(`❌ Leave channel not found: ${channelId}`);
			}
		}
	} catch (err) {
		await logger.log(`❌ Failed to say goodbye to ${member.user.id}: ${err.message}`);
	}
}

function init(client) {
	client.on('guildMemberRemove', async (member) => {
		if (member.user?.bot) return;
		if (!member.guild || member.guild.available === false) return;
		await farewellUser(member, client);
	});
}

export default { init };
