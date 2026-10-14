import { logger } from '../../../../utils/index.js';
import { aiGreetingMessages } from './aiGreeting.js';
import { sendWithNotifiedMentions } from './notifiedMentions.js';
import type { Client, EmbedBuilder, GuildTextBasedChannel } from 'discord.js';

type GreetingSource = { getMessages(guildId: string): Promise<string[]>; hasCustomMessages(guildId: string): Promise<boolean> };
type GreetingTarget = { guildId: string; kind: 'welcome' | 'leave' | 'boost'; label: string; botId: number; serverId: number; serverName: string | null };
type GreetingPost = { embed: EmbedBuilder; label: string; sentLog: (channel: GuildTextBasedChannel) => string };

export async function pickGreetingMessage(source: GreetingSource, target: GreetingTarget): Promise<string | null> {
	const configured = await source.getMessages(target.guildId);
	if (!configured || configured.length === 0) {
		await logger.log(`⚠️ No ${target.label} messages configured for ${target.guildId}, skipping ${target.label} message`);
		return null;
	}
	const isCustom = await source.hasCustomMessages(target.guildId).catch(() => true);
	const generated = isCustom ? null : await aiGreetingMessages(target.kind, { botId: target.botId, serverId: target.serverId, serverName: target.serverName });
	const messages = generated?.length ? generated : configured;
	return messages[Math.floor(Math.random() * messages.length)];
}

export async function postGreeting(client: Client, channelIds: string[], { embed, label, sentLog }: GreetingPost) {
	for (const channelId of channelIds) {
		const channel = client.channels.cache.get(channelId) as GuildTextBasedChannel | undefined;
		if (!channel) {
			await logger.log(`❌ ${label[0].toUpperCase()}${label.slice(1)} channel not found: ${channelId}`);
			continue;
		}
		try {
			await sendWithNotifiedMentions(channel, { embeds: [embed] });
			await logger.log(sentLog(channel));
		} catch (err) {
			await logger.log(`❌ Failed to send ${label} message to channel ${channelId}: ${(err as Error).message}`);
		}
	}
}
