import { FORWARDER, getEmbedConfig } from '../../../config.js';
import { forwarderKeywordHaystack, forwarderKeywordsMatch } from '../../../../forwarder-settings.js';
import { logger, attempt } from '../../../../utils/index.js';
import { serverTranslator, type Translator } from '../i18n.js';
import type { APIEmbed, ApplicationEmoji, Client, ClientApplication, Collection, MessageCreateOptions, GuildTextBasedChannel } from 'discord.js';
import type { ForwardedMessage } from '../../../../forwarder-settings.js';
import type { ForwarderTarget } from '../../../config.js';
import { notifiedMentions, sendMentionOverflow } from './notifiedMentions.js';
import { memberDefaultAvatarUrl, userAvatarUrl } from '../../../../discordAvatars.js';

const EMOJI_NAME_DIGITS = 6;

function extractCustomEmojis(text: string) {
	const str = text != null ? String(text) : '';
	if (!str) {
		return [];
	}
	const seen = new Set();
	const out = [];
	const patternSpecs = [
		['<:([^:]+):(\\d+)>', false],
		['<a:([^:]+):(\\d+)>', true]
	] as const;
	for (const [pattern, isAnimated] of patternSpecs) {
		const regex = new RegExp(pattern, 'g');
		for (const m of str.matchAll(regex)) {
			const name = m[1];
			const id = m[2];
			if (typeof name !== 'string' || typeof id !== 'string') {
				continue;
			}
			const trimmedName = name.trim();
			if (!trimmedName || seen.has(id)) {
				continue;
			}
			seen.add(id);
			out.push({ name: trimmedName, id, animated: isAnimated });
		}
	}
	return out;
}

type LogFn = (message: string) => unknown;
type EmojiRef = ReturnType<typeof extractCustomEmojis>[number];

async function downloadEmojiBuffer(emojiId: string, ext: string, log: LogFn) {
	const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
	try {
		const res = await fetch(cdnUrl);
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return Buffer.from(await res.arrayBuffer());
	} catch (err) {
		if (log) {
			await log(`⚠️ Forwarder: could not download emoji ${emojiId}: ${(err as Error).message}`);
		}
		return null;
	}
}

function findEmojiByName(cache: Collection<string, ApplicationEmoji>, name: string) {
	const n = String(name).trim();
	if (!n) {
		return null;
	}
	return cache.find((e) => String(e.name || '').trim() === n) || null;
}

function isAppEmojiLimitError(err: unknown) {
	const msg = ((err as Error | null)?.message || '').toLowerCase();
	return msg.includes('maximum number of emojis') || msg.includes('emojis reached') || msg.includes('2000');
}

function sanitizeAppEmojiName(name: string) {
	const s = String(name)
		.trim()
		.replace(/[^a-zA-Z0-9_]/g, '_');
	if (s.length >= 2) {
		return s;
	}
	const digits = String(name || '')
		.replace(/\D/g, '')
		.slice(-EMOJI_NAME_DIGITS);
	return `e_${digits}` || 'emoji';
}

type AppEmojiInput = { attachment: Buffer; name: string };

async function evictAndCreateAppEmoji(app: ClientApplication, emoji: AppEmojiInput, log: LogFn) {
	try {
		await app.emojis.cache.first()!.delete();
		await app.emojis.fetch();
		return await app.emojis.create(emoji);
	} catch (retryErr) {
		if (log) {
			await log(`⚠️ Forwarder: could not add application emoji :${emoji.name}: (${(retryErr as Error).message})`);
		}
		return null;
	}
}

async function createAppEmoji(app: ClientApplication, emoji: AppEmojiInput, log: LogFn) {
	const created = await attempt(() => app.emojis.create(emoji));
	if (created.ok) {
		return created.value;
	}
	if (isAppEmojiLimitError(created.error) && app.emojis.cache.size > 0) {
		return evictAndCreateAppEmoji(app, emoji, log);
	}
	if (log) {
		await log(`⚠️ Forwarder: could not add application emoji :${emoji.name}: (${(created.error as Error).message})`);
	}
	return null;
}

async function ensureEmojisOnApplication(client: Client, emojiRefs: EmojiRef[], log: LogFn) {
	const sourceToTarget = new Map<string, string>();
	if (!emojiRefs.length) {
		return { sourceToTarget };
	}
	const app = client.application;
	if (!app?.emojis) {
		if (log) {
			await log('⚠️ Forwarder: application emojis not available (client.application.emojis missing)');
		}
		return { sourceToTarget };
	}
	await app.emojis.fetch();
	let { cache } = app.emojis;
	for (const ref of emojiRefs) {
		let name = ref.name != null ? String(ref.name).trim() : '';
		if (!name && ref.id) {
			name = String(ref.id);
		}
		if (!name) {
			continue;
		}
		name = sanitizeAppEmojiName(name);
		const refId = ref.id != null ? String(ref.id) : '';
		if (!refId) {
			continue;
		}
		let existingEmoji = findEmojiByName(cache, name);
		if (existingEmoji) {
			sourceToTarget.set(refId, existingEmoji.id);
			continue;
		}
		await app.emojis.fetch();
		cache = app.emojis.cache;
		existingEmoji = findEmojiByName(cache, name);
		if (existingEmoji) {
			sourceToTarget.set(refId, existingEmoji.id);
			continue;
		}
		const ext = ref.animated ? 'gif' : 'png';
		const buffer = await downloadEmojiBuffer(refId, ext, log);
		if (!buffer) {
			continue;
		}
		const created = await createAppEmoji(app, { attachment: buffer, name }, log);
		if (created) {
			sourceToTarget.set(refId, created.id);
			cache = app.emojis.cache;
		}
	}
	return { sourceToTarget };
}

function replaceEmojiIdsInText(text: string, sourceIdToTargetId: Map<string, string>) {
	if (!text || sourceIdToTargetId.size === 0) {
		return text;
	}
	return text
		.replace(/<:([^:]+):(\d+)>/g, (_, name, id) => {
			const target = sourceIdToTargetId.get(id);
			return target ? `<:${name}:${target}>` : `<:${name}:${id}>`;
		})
		.replace(/<a:([^:]+):(\d+)>/g, (_, name, id) => {
			const target = sourceIdToTargetId.get(id);
			return target ? `<a:${name}:${target}>` : `<a:${name}:${id}>`;
		});
}

function cleanMessageContent(text: string) {
	if (!text) {
		return text;
	}

	const cleaned = text.replace(/@unknown-role/g, '');
	return cleaned;
}

function stripMentionsFromText(text: string) {
	if (!text) {
		return text;
	}
	let stripped = text.replace(/<@!?\d+>/g, '').replace(/<@&\d+>/g, '');
	stripped = stripped
		.split('\n')
		.map((line: string) => line.replace(/\s+/g, ' ').trim())
		.join('\n')
		.trim();
	return stripped;
}

export async function processMessageFromSelfBot(messageData: ForwardedMessage, client: Client) {
	const sourceChannelId = messageData.channel?.id;
	const sourceGuildId = messageData.guild?.id;

	if (!sourceChannelId || !sourceGuildId) {
		await logger.log(`❌ Source channel ID or guild ID not provided in message data`);
		return;
	}

	const forwarderConfigsResult = await attempt(() => FORWARDER.getForwarderConfigsBySourceChannel(sourceChannelId, sourceGuildId));
	if (!forwarderConfigsResult.ok) {
		await logger.log(`❌ Error finding forwarder config for source channel ${sourceChannelId}: ${(forwarderConfigsResult.error as Error).message}`);
		return;
	}
	const forwarderConfigs = forwarderConfigsResult.value;

	if (!forwarderConfigs || forwarderConfigs.length === 0) {
		await logger.log(`⚠️ No forwarder config found for channel ${sourceChannelId} in guild ${sourceGuildId}`);
		return;
	}

	for (const forwarderConfig of forwarderConfigs) {
		await deliverToForwarder(messageData, client, { forwarderConfig, sourceChannelId }).catch(() => null);
	}
}

type ForwardRoute = { forwarderConfig: ForwarderTarget; sourceChannelId: string };
type TextCleaner = (text: string) => string;
type ForwardStyle = { tr: Translator; embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>; clean: TextCleaner };

function shouldForward(messageData: ForwardedMessage, forwarderConfig: ForwarderTarget) {
	if (forwarderConfig.only_forward_when_mentions_member === true) {
		const selfBotId = messageData.selfbot_user_id;
		if (!selfBotId || !(messageData.mentioned_user_ids || []).includes(selfBotId)) {
			return false;
		}
	}
	return forwarderKeywordsMatch(forwarderConfig.keywords, forwarderKeywordHaystack(messageData.content, messageData.embeds));
}

async function forwardedEmojiMap(client: Client, messageData: ForwardedMessage) {
	const embedTexts = (messageData.embeds ?? []).flatMap((emb) => [emb.description, emb.title, ...(emb.fields ?? []).flatMap((f) => [f.name, f.value])]);
	const allTexts = [messageData.content || '', ...embedTexts.filter((text): text is string => Boolean(text))];
	const pairs = allTexts
		.flatMap((t) => extractCustomEmojis(t).map((e) => [e.id, e] as const))
		.filter(([id, r]) => id && r && typeof r.name === 'string' && r.name.length > 0);
	const { sourceToTarget } = await ensureEmojisOnApplication(client, [...new Map(pairs).values()], logger.log.bind(logger));
	return sourceToTarget;
}

function textCleaner(emojiMap: Map<string, string>, shouldStripMentions: boolean): TextCleaner {
	return (text) => {
		if (!text) {
			return text;
		}
		const cleaned = cleanMessageContent(replaceEmojiIdsInText(text, emojiMap));
		return shouldStripMentions && cleaned ? stripMentionsFromText(cleaned) : cleaned;
	};
}

function forwardedMessageEmbed(messageData: ForwardedMessage, { tr, embedConfig, clean }: ForwardStyle): APIEmbed {
	const { author } = messageData;
	const messageEmbed: APIEmbed = {
		color: embedConfig.COLOR,
		title: tr('forwarder.title', { channel: messageData.channel.name }),
		author: {
			name: author.displayName || `${author.username}#${author.discriminator}`,
			icon_url: author.avatar ? userAvatarUrl(author.id, author.avatar) : memberDefaultAvatarUrl(author.id, author.discriminator)
		},
		timestamp: new Date(messageData.createdTimestamp).toISOString(),
		footer: { text: embedConfig.FOOTER }
	};

	const cleanContent = clean(messageData.content || '');
	if (cleanContent && cleanContent.trim()) {
		messageEmbed.description = cleanContent;
	}

	const attachments = messageData.attachments ?? [];
	if (attachments.length > 0) {
		messageEmbed.image = { url: attachments[0].url };
	}
	if (attachments.length > 1) {
		messageEmbed.fields = [
			...(messageEmbed.fields || []),
			{
				name: tr('forwarder.additionalAttachments'),
				value: attachments
					.slice(1)
					.map((att) => `[${att.name}](${att.url})`)
					.join('\n'),
				inline: false
			}
		];
	}
	return messageEmbed;
}

function forwardedSourceEmbeds(messageData: ForwardedMessage, clean: TextCleaner): APIEmbed[] {
	return (messageData.embeds ?? []).map((embed) => ({
		...embed,
		...(embed.description ? { description: clean(embed.description) } : {}),
		...(embed.title ? { title: clean(embed.title) } : {}),
		...(embed.fields && embed.fields.length > 0
			? { fields: embed.fields.map((field) => ({ ...field, name: clean(field.name), value: clean(field.value) })) }
			: {})
	}));
}

async function deliverToForwarder(messageData: ForwardedMessage, client: Client, { forwarderConfig, sourceChannelId }: ForwardRoute) {
	const targetGuildId = forwarderConfig.target_guild_id;
	const rolePings = Array.isArray(forwarderConfig.role_pings) ? forwarderConfig.role_pings : [];
	const targetChannel = client.channels.cache.get(forwarderConfig.target_channel_id) as GuildTextBasedChannel | undefined;
	if (!targetChannel) {
		await logger.log(`❌ Target channel not found: ${forwarderConfig.target_channel_id}`);
		return;
	}
	if (!shouldForward(messageData, forwarderConfig)) {
		return;
	}

	try {
		const clean = textCleaner(await forwardedEmojiMap(client, messageData), forwarderConfig.only_forward_when_mentions_member === true);
		const style: ForwardStyle = { tr: await serverTranslator(targetGuildId), embedConfig: await getEmbedConfig(targetGuildId), clean };
		const embeds = [forwardedMessageEmbed(messageData, style), ...forwardedSourceEmbeds(messageData, clean)];

		const autoNotificationMentions = await notifiedMentions(targetChannel);
		const contentParts = [...autoNotificationMentions.slice(0, 1), ...(rolePings.length > 0 ? [rolePings.map((id: string) => `<@&${id}>`).join(' ')] : [])];
		const messageOptions: MessageCreateOptions = { embeds, ...(contentParts.length > 0 ? { content: contentParts.join(' ') } : {}) };

		await targetChannel.send(messageOptions);
		await sendMentionOverflow(targetChannel, autoNotificationMentions);
		await logger.log(`✅ Forwarded ${messageData.id} from source channel ${sourceChannelId}`);
	} catch (err) {
		await logger.log(`❌ Failed to forward ${messageData.id}: ${(err as Error).message}`);
		throw err;
	}
}

function init() {}

export default { init };
