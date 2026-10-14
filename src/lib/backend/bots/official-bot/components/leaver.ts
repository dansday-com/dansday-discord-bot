import { LEAVER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { EmbedBuilder, escapeMarkdown } from 'discord.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { pickGreetingMessage, postGreeting } from './greetings.js';
import { serverTranslator, type Translator } from '../i18n.js';
import type { GuildMember, PartialGuildMember, Client } from 'discord.js';
import { DAY_MS, SECOND_MS } from '../../../../utils/time.js';

function timeInServerText(joinedAt: Date | null, tr: Translator): string {
	if (!joinedAt) {
		return tr('leaver.timeInServer.unknown');
	}
	const days = Math.floor((Date.now() - joinedAt.getTime()) / DAY_MS);
	if (days < 1) {
		return tr('leaver.timeInServer.lessThanDay');
	}
	if (days === 1) {
		return tr('leaver.timeInServer.oneDay');
	}
	return tr('leaver.timeInServer.days', { days });
}

type LeaverValues = { memberId: string; username: string; serverName: string; memberCount: number; timeInServer: string };

function replacePlaceholders(message: string, { memberId, username, serverName, memberCount, timeInServer }: LeaverValues) {
	return message
		.replace(/{username}/g, () => username)
		.replace(/{user}/g, `<@${memberId}>`)
		.replace(/{server}/g, () => serverName)
		.replace(/{memberCount}/g, (memberCount || 0).toString())
		.replace(/{timeInServer}/g, timeInServer);
}

type FarewellCard = { joinedAt: Date | null; timeInServer: string; memberCount: number; message: string; avatar: string | null };

function farewellEmbed(tr: Translator, embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>, card: FarewellCard) {
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('leaver.title'))
		.setDescription(card.message)
		.setThumbnail(card.avatar)
		.addFields([
			{
				name: tr('leaver.fields.joined'),
				value: card.joinedAt ? `<t:${Math.floor(card.joinedAt.getTime() / SECOND_MS)}:D>` : tr('leaver.unknownDate'),
				inline: true
			},
			{ name: tr('leaver.fields.timeInServer'), value: card.timeInServer, inline: true },
			{ name: tr('leaver.fields.memberCount'), value: tr('leaver.membersNow', { count: card.memberCount || 0 }), inline: true }
		])
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
}

async function farewellUser(member: GuildMember, client: Client) {
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
		const randomMessage = await pickGreetingMessage(LEAVER, {
			guildId: member.guild.id,
			kind: 'leave',
			label: 'leave',
			botId: botConfig.id,
			serverId: serverData.id,
			serverName: member.guild?.name || serverData.name
		});
		if (!randomMessage) {
			return;
		}

		const tr = await serverTranslator(member.guild.id);
		const joinedAt: Date | null = member.joinedAt ?? (memberData?.member_since instanceof Date ? memberData.member_since : null);
		const timeInServer = timeInServerText(joinedAt, tr);
		const memberCount = member.guild?.memberCount ?? (serverData?.total_members || 0);
		const username = escapeMarkdown(member.displayName || memberData?.display_name || member.user.username || `User ${member.user.id}`);
		const serverName = member.guild?.name || serverData?.name || tr('leaver.unknownServer');
		const message = replacePlaceholders(randomMessage, { memberId: member.user.id, username, serverName, memberCount, timeInServer });
		const embed = farewellEmbed(tr, await getEmbedConfig(member.guild.id), {
			joinedAt,
			timeInServer,
			memberCount,
			message,
			avatar: member.user.displayAvatarURL?.() || memberData?.avatar || null
		});

		await postGreeting(client, leaveChannelIds, {
			embed,
			label: 'leave',
			sentLog: (channel) => `✅ Said goodbye to ${username} (${member.user.id}) in ${serverData.name} to channel ${channel.name}`
		});
	} catch (err) {
		await logger.log(`❌ Failed to say goodbye to ${member.user.id}: ${(err as Error).message}`);
	}
}

function init(client: Client) {
	client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
		if (member.user?.bot) {
			return;
		}
		if (!member.guild || member.guild.available === false) {
			return;
		}
		await farewellUser(member as GuildMember, client);
	});
}

export default { init };
