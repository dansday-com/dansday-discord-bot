import OpenAI from 'openai';
import { AttachmentBuilder } from 'discord.js';
import { getBotConfig } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { publishVoiceCommand, readVoiceState } from './voiceControl.js';
import { getEnabledWikis, buildWikiTool, runWikiTool } from './wiki.js';
import { buildSearchTool, buildFetchTool, runSearchTool, runFetchTool } from './webTools.js';
import { buildImageTool, runImageTool } from './imageTools.js';

const DISCORD_MESSAGE_LIMIT = 2000;
const MAX_REPLY_LENGTH = 4000;
const MAX_RECENT = 10;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_TOOL_ITERATIONS = 5;
const MAX_GENERATED_IMAGES = 2;

const inFlight = new Set();

function sessionKey(guildId, memberId) {
	return `${guildId}:${memberId}`;
}

function normalizeBaseUrl(rawUrl) {
	const trimmed = rawUrl.trim().replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed.slice(0, -'/chat/completions'.length) : trimmed;
}

function stripReasoning(text) {
	return text
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/\(no output\)\s*/g, '')
		.trim();
}

function buildCompletionParams(config) {
	const useThinking = config.reasoning !== 'none';
	const modelLower = (config.model ?? '').toLowerCase();
	const isGemini = modelLower.includes('gemini');

	const thinkingKwargs = (() => {
		if (!useThinking) return {};
		if (modelLower.includes('glm')) return { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } };
		if (modelLower.includes('nemotron')) return { chat_template_kwargs: { enable_thinking: true }, reasoning_budget: -1 };
		if (modelLower.includes('qwen')) return { chat_template_kwargs: { enable_thinking: true } };
		if (modelLower.includes('deepseek') || modelLower.includes('kimi')) return { chat_template_kwargs: { thinking: true } };
		return {};
	})();

	return {
		model: config.model,
		...(useThinking ? { reasoning_effort: isGemini && config.reasoning === 'xhigh' ? 'high' : config.reasoning } : {}),
		...(!isGemini ? { frequency_penalty: 1.2 } : {}),
		...thinkingKwargs
	};
}

const VOICE_TOOLS = [
	{
		type: 'function',
		function: {
			name: 'join_voice',
			description:
				'Join the voice channel the user is currently in, so you can talk with them out loud. Only call this when the user asks you to join voice, join the call, or talk to them.',
			parameters: { type: 'object', properties: {} }
		}
	},
	{
		type: 'function',
		function: {
			name: 'leave_voice',
			description: 'Leave the voice channel you are currently in. Only call this when the user asks you to leave, disconnect, or stop talking.',
			parameters: { type: 'object', properties: {} }
		}
	}
];

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const ATTACHMENT_FETCH_TIMEOUT_MS = 20_000;

const ATTACHMENT_KINDS = [
	{ kind: 'image', test: (type, name) => type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name) },
	{ kind: 'pdf', test: (type, name) => type === 'application/pdf' || /\.pdf$/i.test(name) },
	{ kind: 'audio', test: (type, name) => type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(name) },
	{ kind: 'video', test: (type, name) => type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(name) }
];

function classifyAttachment(attachment) {
	const type = (attachment.contentType ?? '').split(';')[0].trim().toLowerCase();
	const name = attachment.name ?? '';
	return ATTACHMENT_KINDS.find((entry) => entry.test(type, name))?.kind ?? null;
}

function mimeFor(attachment, kind) {
	const declared = (attachment.contentType ?? '').split(';')[0].trim().toLowerCase();
	if (declared) return declared;

	const ext = (attachment.name ?? '').split('.').pop()?.toLowerCase() ?? '';
	const fallback = {
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		webp: 'image/webp',
		gif: 'image/gif',
		pdf: 'application/pdf',
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		ogg: 'audio/ogg',
		oga: 'audio/ogg',
		m4a: 'audio/mp4',
		mp4: 'video/mp4',
		mov: 'video/quicktime',
		webm: 'video/webm'
	}[ext];

	return fallback ?? (kind === 'image' ? 'image/png' : 'application/octet-stream');
}

async function fetchAttachmentPart(attachment) {
	const kind = classifyAttachment(attachment);
	if (!kind) return null;
	if (attachment.size && attachment.size > MAX_ATTACHMENT_BYTES) {
		await logger.log(`📎 AI skipping ${attachment.name ?? 'attachment'} (${attachment.size} bytes over limit)`);
		return null;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ATTACHMENT_FETCH_TIMEOUT_MS);

	try {
		const res = await fetch(attachment.url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const buffer = Buffer.from(await res.arrayBuffer());
		if (buffer.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`${buffer.byteLength} bytes over limit`);

		const mime = mimeFor(attachment, kind);
		const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

		if (kind === 'image') return { type: 'image_url', image_url: { url: dataUrl } };
		return { type: 'input_file', input_file: { filename: attachment.name ?? `file.${mime.split('/')[1] ?? 'bin'}`, file_data: dataUrl } };
	} catch (error) {
		await logger.log(`📎 AI could not read ${attachment.name ?? 'attachment'}: ${error.message}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function buildAttachmentParts(messages) {
	const list = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);

	const supported = [];
	for (const entry of list) {
		for (const attachment of entry.attachments?.values?.() ?? []) {
			if (classifyAttachment(attachment)) supported.push(attachment);
		}
	}

	const capped = supported.slice(0, MAX_ATTACHMENTS);
	if (!capped.length) return { parts: [], kinds: [] };

	const settled = await Promise.all(capped.map((attachment) => fetchAttachmentPart(attachment)));
	const parts = settled.filter(Boolean);
	const kinds = capped.filter((attachment, index) => settled[index]).map((attachment) => classifyAttachment(attachment));

	if (supported.length > capped.length) {
		await logger.log(`📎 AI ignoring ${supported.length - capped.length} extra attachment(s) over the ${MAX_ATTACHMENTS} limit`);
	}

	return { parts, kinds };
}

const TOOL_RETRY_HINT = 'This is the final result for this tool. Do not call it again — reply to the user in words.';

function finalToolResult(payload) {
	return JSON.stringify({ ...payload, final: true, next_step: TOOL_RETRY_HINT });
}

async function executeVoiceTool(name, message, botId) {
	const state = await readVoiceState(botId);

	if (name === 'leave_voice') {
		if (!state) return finalToolResult({ ok: false, reason: 'not_in_voice_channel' });

		if (state.inviterId && message.author.id !== state.inviterId) {
			const inviter = message.guild?.members?.cache?.get(state.inviterId);
			const inviterName = inviter?.displayName ?? inviter?.user?.username ?? null;

			return finalToolResult({
				ok: false,
				reason: 'not_the_inviter',
				inviter_id: state.inviterId,
				inviter_name: inviterName,
				tell_the_user: `You are staying in the voice channel. Tell them plainly that they are not the one who invited you, so they cannot make you leave — only ${inviterName ? inviterName : 'the member who invited you'} can. Keep it to one short, friendly sentence.`
			});
		}

		await publishVoiceCommand(botId, { cmd: 'leave', reason: 'user_request' });
		return finalToolResult({ ok: true, left: true });
	}

	const channelId = message.member?.voice?.channelId ?? null;
	if (!channelId) {
		return finalToolResult({ ok: false, reason: 'user_not_in_a_voice_channel' });
	}

	if (state) {
		if (state.channelId === channelId) {
			return finalToolResult({ ok: false, reason: 'already_in_this_channel' });
		}
		return finalToolResult({ ok: false, reason: 'busy_in_another_channel', busy_channel_name: state.channelName ?? 'another channel' });
	}

	const published = await publishVoiceCommand(botId, {
		cmd: 'join',
		guildId: message.guild.id,
		channelId,
		channelName: message.member.voice.channel?.name ?? '',
		inviterId: message.author.id,
		textChannelId: message.channel.id
	});

	if (!published) {
		return finalToolResult({ ok: false, reason: 'voice_worker_unavailable' });
	}

	return finalToolResult({ ok: true, joining: true, channel_name: message.member.voice.channel?.name ?? '' });
}

const MENTION_RE = /<@!?(\d{17,20})>/g;
const MAX_PINGS_PER_MESSAGE = 5;

async function resolveMentionedMembers(guild, content) {
	if (!guild) return [];

	const ids = [...new Set([...String(content).matchAll(MENTION_RE)].map((match) => match[1]))].slice(0, MAX_PINGS_PER_MESSAGE);
	if (!ids.length) return [];

	const allowed = [];
	for (const id of ids) {
		const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
		if (member && !member.user?.bot) allowed.push(id);
	}

	return allowed;
}

function stripBotMention(content, botUserId) {
	return content
		.replace(new RegExp(`<@!?${botUserId}>`, 'g'), ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function splitForDiscord(text, limit = DISCORD_MESSAGE_LIMIT) {
	const chunks = [];
	let remaining = text;

	while (remaining.length > limit) {
		let cut = remaining.lastIndexOf('\n', limit);
		if (cut < limit * 0.5) cut = remaining.lastIndexOf(' ', limit);
		if (cut < limit * 0.5) cut = limit;

		chunks.push(remaining.slice(0, cut).trim());
		remaining = remaining.slice(cut).trim();
	}

	if (remaining) chunks.push(remaining);
	return chunks;
}

let cachedClient = null;

function getClient(config) {
	const baseURL = normalizeBaseUrl(config.api_url);
	if (cachedClient && cachedClient.baseURL === baseURL && cachedClient.apiKey === config.api_key) {
		return cachedClient.client;
	}
	const client = new OpenAI({ baseURL, apiKey: config.api_key, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
	cachedClient = { baseURL, apiKey: config.api_key, client };
	return client;
}

async function callChatCompletions(config, messages, { tools = null, onToolCall = null } = {}) {
	const client = getClient(config);
	const params = buildCompletionParams(config);
	const loop = [...messages];
	const toolResultCache = new Map();

	for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
		const lastIteration = i === MAX_TOOL_ITERATIONS - 1;
		const offerTools = tools && onToolCall && !lastIteration;

		const completion = await client.chat.completions.create({
			...params,
			...(offerTools ? { tools, tool_choice: 'auto' } : {}),
			messages: loop
		});

		const choice = completion.choices?.[0]?.message;
		if (!choice) return '';

		if (!choice.tool_calls?.length || !onToolCall) {
			return choice.content ?? '';
		}

		loop.push(choice);

		for (const call of choice.tool_calls) {
			const cacheKey = `${call.function.name}:${call.function.arguments ?? ''}`;
			if (!toolResultCache.has(cacheKey)) {
				let args = {};
				try {
					args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
				} catch {
					args = {};
				}
				toolResultCache.set(cacheKey, await onToolCall(call.function.name, args));
			}
			loop.push({ role: 'tool', tool_call_id: call.id, content: toolResultCache.get(cacheKey) });
		}
	}

	return '';
}

async function fetchRepliedMessage(message) {
	const referenceId = message.reference?.messageId;
	if (!referenceId) return null;

	const cached = message.channel.messages.cache.get(referenceId);
	if (cached) return cached;

	return message.fetchReference().catch(() => null);
}

async function handleMessageCreate(message) {
	try {
		if (message.author?.bot || !message.guild) return;
		if (message.mentions.everyone) return;

		const botUserId = message.client.user?.id;
		if (!botUserId) return;

		const mentioned = message.mentions.users.has(botUserId);
		if (!mentioned && !message.reference?.messageId) return;

		const botConfig = getBotConfig();
		if (!botConfig?.id) return;

		const config = db.botAiFromDbRow(await db.getBotAiByBotId(botConfig.id));
		if (!config.enabled || !config.api_url || !config.api_key || !config.model) return;

		const replied = await fetchRepliedMessage(message);
		if (!mentioned && replied?.author?.id !== botUserId) return;

		const key = sessionKey(message.guild.id, message.author.id);
		if (inFlight.has(key)) return;
		inFlight.add(key);

		try {
			const prompt = stripBotMention(message.content ?? '', botUserId);

			await message.channel.sendTyping().catch(() => {});

			const quoted = replied && replied.author?.id !== botUserId ? replied : null;
			const { parts: attachmentParts, kinds: attachmentKinds } = await buildAttachmentParts([quoted, message]);

			const quotedText = quoted ? stripBotMention(quoted.content ?? '', botUserId).trim() : '';
			const quotedName = quoted ? (quoted.member?.displayName ?? quoted.author?.username ?? 'someone') : '';
			const quotedKinds = quoted ? [...(quoted.attachments?.values?.() ?? [])].map(classifyAttachment).filter(Boolean) : [];
			const quotedNote = quoted
				? `[Replying to ${quotedName}${quotedKinds.length ? ` who attached ${quotedKinds.join(', ')}` : ''}]${quotedText ? ` ${quotedName} said: "${quotedText}"` : ''}\n\n`
				: '';

			const ownText = prompt || (attachmentParts.length ? `(${attachmentKinds.join(', ')} attached, no message text)` : 'Hello!');
			const userContent = `${quotedNote}${ownText}`;

			const history = await db.getBotAiSession(botConfig.id, message.guild.id, message.author.id, MAX_RECENT);
			const conversation = history.map((row) => ({ role: row.role, content: row.content }));

			const today = new Date().toISOString().slice(0, 10);
			const speakerName = message.member?.displayName ?? message.author.username;
			const identityNote = `[System] You are talking with ${speakerName}, whose mention tag is <@${message.author.id}>. To ping someone, write their tag in that exact <@id> form — a plain name or a bare number does not ping. Only use an id you have actually been given here or in this conversation; never invent one.`;
			const systemContent = [config.system_prompt?.replace(/\{\{today\}\}/g, today) ?? '', identityNote].filter(Boolean).join('\n\n');

			const userMessage = attachmentParts.length
				? { role: 'user', content: [{ type: 'text', text: userContent }, ...attachmentParts] }
				: { role: 'user', content: userContent };

			const messages = [...(systemContent ? [{ role: 'system', content: systemContent }] : []), ...conversation, userMessage];

			const voiceReady = config.voice_enabled && !!config.voice_model;
			const wikis = await getEnabledWikis(botConfig.id).catch(() => []);
			const wikiTool = buildWikiTool(wikis);
			const searchTool = buildSearchTool(config);
			const fetchTool = buildFetchTool(config);
			const imageTool = buildImageTool(config);

			const tools = [
				...(voiceReady ? VOICE_TOOLS : []),
				...(wikiTool ? [wikiTool] : []),
				...(searchTool ? [searchTool] : []),
				...(fetchTool ? [fetchTool] : []),
				...(imageTool ? [imageTool] : [])
			];

			const generatedImages = [];

			const onToolCall = (name, args) => {
				message.channel.sendTyping().catch(() => {});
				if (name === 'search_wiki') return runWikiTool(wikis, args).then((result) => JSON.stringify(result));
				if (name === 'search_web') return runSearchTool(config, args).then((result) => JSON.stringify(result));
				if (name === 'fetch_web_page') return runFetchTool(config, args).then((result) => JSON.stringify(result));
				if (name === 'generate_image') {
					return runImageTool(config, args).then((result) => {
						if (result.ok && generatedImages.length < MAX_GENERATED_IMAGES) generatedImages.push(result);
						const { buffer, ...summary } = result;
						return finalToolResult(summary.ok ? { ...summary, sent_to_channel: true } : summary);
					});
				}
				return executeVoiceTool(name, message, botConfig.id);
			};

			const raw = await callChatCompletions(config, messages, {
				tools: tools.length ? tools : null,
				onToolCall: tools.length ? onToolCall : null
			});
			const reply = stripReasoning(typeof raw === 'string' ? raw : '').slice(0, MAX_REPLY_LENGTH);

			const imageFiles = generatedImages
				.map((image, index) => (image.buffer ? new AttachmentBuilder(image.buffer, { name: `image-${index + 1}.png` }) : null))
				.filter(Boolean);

			if (!reply) {
				if (imageFiles.length) {
					await message.reply({ files: imageFiles, allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
					return;
				}
				await message.reply({ content: 'I could not generate a response right now. Please try again.' }).catch(() => {});
				return;
			}

			const storedContent = attachmentParts.length && prompt ? `${userContent} [${attachmentKinds.join(', ')} attached]` : userContent;
			await db.appendBotAiMessage(botConfig.id, message.guild.id, message.author.id, 'user', storedContent);
			await db.appendBotAiMessage(botConfig.id, message.guild.id, message.author.id, 'assistant', reply);

			const mention = `<@${message.author.id}>`;
			const chunks = splitForDiscord(reply, DISCORD_MESSAGE_LIMIT - mention.length - 1);
			const lastIndex = chunks.length - 1;

			for (let i = 0; i < chunks.length; i++) {
				const content = i === lastIndex ? `${chunks[i]} ${mention}` : chunks[i];
				const named = await resolveMentionedMembers(message.guild, content);
				const allowedMentions = { parse: [], users: [...new Set([...named, ...(i === lastIndex ? [message.author.id] : [])])] };

				if (i === 0) {
					await message.reply({
						content,
						...(imageFiles.length ? { files: imageFiles } : {}),
						allowedMentions: { ...allowedMentions, repliedUser: false }
					});
				} else {
					await message.channel.send({ content, allowedMentions });
				}
			}
		} finally {
			inFlight.delete(key);
		}
	} catch (error) {
		const status = error instanceof OpenAI.APIError ? error.status : null;
		await logger.log(`❌ AI chat error${status ? ` (${status})` : ''}: ${error.message}`);

		const notice =
			status === 401 || status === 403
				? 'The AI API key was rejected. Please check the bot panel settings.'
				: status === 429
					? 'The AI service is rate limited right now. Please try again in a moment.'
					: 'Something went wrong while contacting the AI service.';
		await message.reply({ content: notice }).catch(() => {});
	}
}

function init(client) {
	client.on('messageCreate', handleMessageCreate);
}

export default { init, splitForDiscord, normalizeBaseUrl };
