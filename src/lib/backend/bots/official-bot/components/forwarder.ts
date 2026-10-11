import { FORWARDER, NOTIFICATIONS, getEmbedConfig } from '../../../config.js';
import { forwarderKeywordHaystack, forwarderKeywordsMatch } from '../../../../forwarder-settings.js';
import { logger } from '../../../../utils/index.js';
import { serverTranslator } from '../i18n.js';
import type { APIEmbed, ApplicationEmoji, Client, Collection, MessageCreateOptions, GuildTextBasedChannel } from 'discord.js';
import type { ForwardedMessage } from '../../../../forwarder-settings.js';
import type { ForwarderTarget } from '../../../config.js';

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
	for (const [pattern, animated] of patternSpecs) {
		const regex = new RegExp(pattern, 'g');
		let m;
		while ((m = regex.exec(str)) !== null) {
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
			out.push({ name: trimmedName, id, animated });
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
		.slice(-6);
	return `e_${digits}` || 'emoji';
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
	let cache = app.emojis.cache;
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
		let created = null;
		try {
			created = await app.emojis.create({ attachment: buffer, name });
		} catch (err) {
			if (isAppEmojiLimitError(err) && cache.size > 0) {
				const toRemove = cache.first();
				try {
					await toRemove!.delete();
					await app.emojis.fetch();
					cache = app.emojis.cache;
					created = await app.emojis.create({ attachment: buffer, name });
				} catch (retryErr) {
					if (log) {
						await log(`⚠️ Forwarder: could not add application emoji :${name}: (${(retryErr as Error).message})`);
					}
				}
			} else {
				if (log) {
					await log(`⚠️ Forwarder: could not add application emoji :${name}: (${(err as Error).message})`);
				}
			}
		}
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

	let forwarderConfigs;
	try {
		forwarderConfigs = await FORWARDER.getForwarderConfigsBySourceChannel(sourceChannelId, sourceGuildId);
	} catch (err) {
		await logger.log(`❌ Error finding forwarder config for source channel ${sourceChannelId}: ${(err as Error).message}`);
		return;
	}

	if (!forwarderConfigs || forwarderConfigs.length === 0) {
		await logger.log(`⚠️ No forwarder config found for channel ${sourceChannelId} in guild ${sourceGuildId}`);
		return;
	}

	for (const forwarderConfig of forwarderConfigs) {
		await deliverToForwarder(messageData, client, forwarderConfig, sourceChannelId).catch(() => null);
	}
}

async function deliverToForwarder(messageData: ForwardedMessage, client: Client, forwarderConfig: ForwarderTarget, sourceChannelId: string) {
	const targetChannelId = forwarderConfig.target_channel_id;
	const targetGuildId = forwarderConfig.target_guild_id;
	const rolePings = Array.isArray(forwarderConfig.role_pings) ? forwarderConfig.role_pings : [];
	const onlyForwardWhenMentionsSelfBot = forwarderConfig.only_forward_when_mentions_member === true;

	const targetChannel = client.channels.cache.get(targetChannelId) as GuildTextBasedChannel | undefined;

	if (!targetChannel) {
		await logger.log(`❌ Target channel not found: ${targetChannelId}`);
		return;
	}

	if (onlyForwardWhenMentionsSelfBot) {
		const selfBotId = messageData.selfbot_user_id;
		const mentionedUserIds = messageData.mentioned_user_ids || [];
		if (!selfBotId || !mentionedUserIds.includes(selfBotId)) {
			return;
		}
	}

	if (!forwarderKeywordsMatch(forwarderConfig.keywords, forwarderKeywordHaystack(messageData.content, messageData.embeds))) {
		return;
	}

	try {
		const embedConfig = await getEmbedConfig(targetGuildId);
		const tr = await serverTranslator(targetGuildId);

		const allTexts = [messageData.content || ''];
		if (messageData.embeds?.length) {
			for (const emb of messageData.embeds) {
				if (emb.description) {
					allTexts.push(emb.description);
				}
				if (emb.title) {
					allTexts.push(emb.title);
				}
				if (emb.fields?.length) {
					for (const f of emb.fields) {
						if (f.name) {
							allTexts.push(f.name);
						}
						if (f.value) {
							allTexts.push(f.value);
						}
					}
				}
			}
		}
		const pairs = allTexts
			.flatMap((t) => extractCustomEmojis(t).map((e) => [e.id, e] as const))
			.filter(([id, r]) => id && r && typeof r.name === 'string' && r.name.length > 0);
		const emojiRefs = [...new Map(pairs).values()];
		const { sourceToTarget: sourceIdToTargetId } = await ensureEmojisOnApplication(client, emojiRefs, logger.log.bind(logger));

		const applyEmojiReplace = (text: string) => replaceEmojiIdsInText(text, sourceIdToTargetId);

		const embeds = [];

		const messageEmbed: APIEmbed = {
			color: embedConfig.COLOR,
			title: tr('forwarder.title', { channel: messageData.channel.name }),
			author: {
				name: messageData.author.displayName || `${messageData.author.username}#${messageData.author.discriminator}`,
				icon_url: messageData.author.avatar
					? `https://cdn.discordapp.com/avatars/${messageData.author.id}/${messageData.author.avatar}.png`
					: `https://cdn.discordapp.com/embed/avatars/${parseInt(messageData.author.discriminator) % 5}.png`
			},
			timestamp: new Date(messageData.createdTimestamp).toISOString(),
			footer: {
				text: embedConfig.FOOTER
			}
		};

		let cleanContent = applyEmojiReplace(messageData.content || '');
		cleanContent = cleanMessageContent(cleanContent);
		if (onlyForwardWhenMentionsSelfBot && cleanContent) {
			cleanContent = stripMentionsFromText(cleanContent);
		}
		if (cleanContent && cleanContent.trim()) {
			messageEmbed.description = cleanContent;
		}

		if (messageData.attachments && messageData.attachments.length > 0) {
			const firstAttachment = messageData.attachments[0];

			messageEmbed.image = {
				url: firstAttachment.url
			};

			if (messageData.attachments.length > 1) {
				messageEmbed.fields = messageEmbed.fields || [];
				messageEmbed.fields.push({
					name: tr('forwarder.additionalAttachments'),
					value: messageData.attachments
						.slice(1)
						.map((att) => `[${att.name}](${att.url})`)
						.join('\n'),
					inline: false
				});
			}
		}

		embeds.push(messageEmbed);

		if (messageData.embeds && messageData.embeds.length > 0) {
			const cleanForEmbed = (t: string) => {
				if (!t) {
					return t;
				}
				let out = applyEmojiReplace(t);
				out = cleanMessageContent(out);
				if (onlyForwardWhenMentionsSelfBot && out) {
					out = stripMentionsFromText(out);
				}
				return out;
			};

			messageData.embeds.forEach((embed) => {
				const originalEmbed = { ...embed };

				if (originalEmbed.description) {
					originalEmbed.description = cleanForEmbed(originalEmbed.description);
				}

				if (originalEmbed.title) {
					originalEmbed.title = cleanForEmbed(originalEmbed.title);
				}

				if (originalEmbed.fields && originalEmbed.fields.length > 0) {
					originalEmbed.fields = originalEmbed.fields.map((field) => ({
						...field,
						name: cleanForEmbed(field.name),
						value: cleanForEmbed(field.value)
					}));
				}

				embeds.push(originalEmbed);
			});
		}

		const contentParts = [];
		const autoNotificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(targetGuildId, targetChannelId).catch(() => null);
		if (autoNotificationMentions && autoNotificationMentions.length > 0) {
			contentParts.push(autoNotificationMentions[0]);
		}
		if (rolePings.length > 0) {
			contentParts.push(rolePings.map((id: string) => `<@&${id}>`).join(' '));
		}
		const messageOptions: MessageCreateOptions = {
			embeds: embeds
		};
		if (contentParts.length > 0) {
			messageOptions.content = contentParts.join(' ');
		}

		await targetChannel.send(messageOptions);

		if (autoNotificationMentions && autoNotificationMentions.length > 1) {
			for (let i = 1; i < autoNotificationMentions.length; i++) {
				await targetChannel.send({ content: autoNotificationMentions[i] }).catch(() => null);
			}
		}

		await logger.log(`✅ Forwarded ${messageData.id} from source channel ${sourceChannelId}`);
	} catch (err) {
		await logger.log(`❌ Failed to forward ${messageData.id}: ${(err as Error).message}`);
		throw err;
	}
}

function init() {}

export default { init };
