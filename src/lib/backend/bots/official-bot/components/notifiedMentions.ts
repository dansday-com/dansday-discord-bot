import { NOTIFICATIONS } from '../../../config.js';
import type { GuildTextBasedChannel, Message, MessageCreateOptions } from 'discord.js';
import { mentionChunks } from '../../../../utils/mentions.js';

export async function notifiedMentions(channel: GuildTextBasedChannel): Promise<string[]> {
	return (await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(channel.guild.id, channel.id).catch(() => null)) ?? [];
}

export async function sendMentionOverflow(channel: GuildTextBasedChannel, mentions: readonly string[]) {
	for (const content of mentions.slice(1)) {
		await channel.send({ content }).catch(() => null);
	}
}

export async function sendWithNotifiedMentions(channel: GuildTextBasedChannel, options: Omit<MessageCreateOptions, 'content'>): Promise<Message> {
	const mentions = await notifiedMentions(channel);
	const message = await channel.send({ ...options, content: mentions[0] });
	await sendMentionOverflow(channel, mentions);
	return message;
}

export async function sendWithWatcherMentions(channel: GuildTextBasedChannel, options: Omit<MessageCreateOptions, 'content'>, watcherIds: string[]) {
	const channelMentions = await notifiedMentions(channel);
	const alreadyMentioned = channelMentions.join(' ');
	const mentionParts = [...channelMentions, ...mentionChunks(watcherIds.filter((id) => !alreadyMentioned.includes(`<@${id}>`)))];
	await channel.send({ ...options, content: mentionParts[0] });
	await sendMentionOverflow(channel, mentionParts);
}
