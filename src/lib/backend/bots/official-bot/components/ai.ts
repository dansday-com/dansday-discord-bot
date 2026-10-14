import OpenAI from 'openai';
import { AttachmentBuilder } from 'discord.js';
import { getBotConfig, resolveGuildAiConfig } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { publishVoiceCommand, readVoiceState } from './voiceControl.js';
import { getEnabledWikis, buildWikiTool, runWikiTool } from './wiki.js';
import { buildSearchTool, buildFetchTool, runSearchTool, runFetchTool } from './webTools.js';
import { buildImageTool, runImageTool } from './imageTools.js';
import { buildServerTools, runServerTool, SERVER_TOOL_NAMES } from './serverTools.js';
import { resolveToolFeatures } from './aiToolShared.js';
import { buildAccountTools, runAccountTool, ACCOUNT_TOOL_NAMES } from './accountTools.js';
import { buildKnowledgeTools, runKnowledgeTool, KNOWLEDGE_TOOL_NAMES } from './knowledgeTools.js';
import { readAiSession, appendAiMessage, claimAiMessageLocal, claimAiMessageShared } from './aiSession.js';
import { aiLanguageInstruction, translateServer } from '../i18n.js';
import type { Client, Guild, GuildTextBasedChannel, Message, Attachment } from 'discord.js';
import type { AiInput } from '../../../../database.js';
import type { ChatCompletionMessageFunctionToolCall, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { HTTP } from '../../../../http.js';
import { BYTES_PER_MB } from '../../../../utils/numbers.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';
import { isoDay } from '../../../../utils/datetime.js';

const MAX_REPLY_LENGTH = 4000;
const MAX_RECENT = 10;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_TOOL_ITERATIONS = 5;
const MAX_GENERATED_IMAGES = 2;
const SPLIT_MIN_FRACTION = 0.5;

const inFlight = new Set();

function sessionKey(guildId: string, memberId: number | string) {
	return `${guildId}:${memberId}`;
}

function normalizeBaseUrl(rawUrl: string) {
	const trimmed = rawUrl.trim().replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed.slice(0, -'/chat/completions'.length) : trimmed;
}

function stripReasoning(text: string) {
	return text
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/\(no output\)\s*/g, '')
		.trim();
}

function buildCompletionParams(config: AiInput) {
	const isUseThinking = config.reasoning !== 'none';
	const modelLower = (config.model ?? '').toLowerCase();
	const isGemini = modelLower.includes('gemini');

	const thinkingKwargs = (() => {
		if (!isUseThinking) {
			return {};
		}
		if (modelLower.includes('glm')) {
			return { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } };
		}
		if (modelLower.includes('nemotron')) {
			return { chat_template_kwargs: { enable_thinking: true }, reasoning_budget: -1 };
		}
		if (modelLower.includes('qwen')) {
			return { chat_template_kwargs: { enable_thinking: true } };
		}
		if (modelLower.includes('deepseek') || modelLower.includes('kimi')) {
			return { chat_template_kwargs: { thinking: true } };
		}
		return {};
	})();

	return {
		model: config.model!,
		...(isUseThinking ? { reasoning_effort: isGemini && config.reasoning === 'xhigh' ? 'high' : config.reasoning } : {}),
		...(!isGemini ? { frequency_penalty: 0.3 } : {}),
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
const MAX_ATTACHMENT_MB = 12;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * BYTES_PER_MB;
const ATTACHMENT_FETCH_TIMEOUT_MS = 20_000;

const ATTACHMENT_KINDS = [
	{ kind: 'image', test: (type: string, name: string) => type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name) },
	{ kind: 'pdf', test: (type: string, name: string) => type === 'application/pdf' || /\.pdf$/i.test(name) },
	{ kind: 'audio', test: (type: string, name: string) => type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|m4a|aac|flac)$/i.test(name) },
	{ kind: 'video', test: (type: string, name: string) => type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(name) }
];

function classifyAttachment(attachment: Attachment) {
	const type = (attachment.contentType ?? '').split(';')[0].trim().toLowerCase();
	const name = attachment.name ?? '';
	return ATTACHMENT_KINDS.find((entry) => entry.test(type, name))?.kind ?? null;
}

function mimeFor(attachment: Attachment, kind: string) {
	const declared = (attachment.contentType ?? '').split(';')[0].trim().toLowerCase();
	if (declared) {
		return declared;
	}

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

async function fetchAttachmentPart(attachment: Attachment) {
	const kind = classifyAttachment(attachment);
	if (!kind) {
		return null;
	}
	if (attachment.size && attachment.size > MAX_ATTACHMENT_BYTES) {
		await logger.log(`📎 AI skipping ${attachment.name ?? 'attachment'} (${attachment.size} bytes over limit)`);
		return null;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ATTACHMENT_FETCH_TIMEOUT_MS);

	try {
		const res = await fetch(attachment.url, { signal: controller.signal });
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}

		const buffer = Buffer.from(await res.arrayBuffer());
		if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
			throw new Error(`${buffer.byteLength} bytes over limit`);
		}

		const mime = mimeFor(attachment, kind);
		const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

		if (kind === 'image') {
			return { type: 'image_url', image_url: { url: dataUrl } };
		}
		return { type: 'input_file', input_file: { filename: attachment.name ?? `file.${mime.split('/')[1] ?? 'bin'}`, file_data: dataUrl } };
	} catch (error) {
		await logger.log(`📎 AI could not read ${attachment.name ?? 'attachment'}: ${(error as Error).message}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function buildAttachmentParts(messages: unknown) {
	const list = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);

	const supported = [];
	for (const entry of list) {
		for (const attachment of entry.attachments?.values?.() ?? []) {
			if (classifyAttachment(attachment)) {
				supported.push(attachment);
			}
		}
	}

	const capped = supported.slice(0, MAX_ATTACHMENTS);
	if (!capped.length) {
		return { parts: [], kinds: [] };
	}

	const settled = await Promise.all(capped.map((attachment) => fetchAttachmentPart(attachment)));
	const parts = settled.filter(Boolean);
	const kinds = capped.filter((attachment, index) => settled[index]).map((attachment) => classifyAttachment(attachment));

	if (supported.length > capped.length) {
		await logger.log(`📎 AI ignoring ${supported.length - capped.length} extra attachment(s) over the ${MAX_ATTACHMENTS} limit`);
	}

	return { parts, kinds };
}

const TOOL_RETRY_HINT = 'This is the final result for this tool. Do not call it again — reply to the user in words.';

function finalToolResult(payload: Record<string, unknown>) {
	return JSON.stringify({ ...payload, final: true, next_step: TOOL_RETRY_HINT });
}

async function executeVoiceTool(name: string, message: Message<true>, botId: number) {
	const state = await readVoiceState(botId);

	if (name === 'leave_voice') {
		if (!state) {
			return finalToolResult({ ok: false, reason: 'not_in_voice_channel' });
		}

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

	const isPublished = await publishVoiceCommand(botId, {
		cmd: 'join',
		guildId: message.guild.id,
		channelId,
		channelName: message.member!.voice.channel?.name ?? '',
		inviterId: message.author.id,
		textChannelId: message.channel.id
	});

	if (!isPublished) {
		return finalToolResult({ ok: false, reason: 'voice_worker_unavailable' });
	}

	return finalToolResult({ ok: true, joining: true, channel_name: message.member!.voice.channel?.name ?? '' });
}

const SERVER_DATA_NOTE = `[System] You can read this server's own live data with your tools: its public statistics, leaderboards, a member's public profile, staff ratings, running giveaways, active Discord Quests, the XP item shop with prices and timings, the "How the XP Game Works" guide, and the account of the person you are talking to. Use them instead of guessing or answering from memory whenever someone asks about this server, this game, the shop, their level, their bag or their tasks — the numbers change constantly and only the tools are current.

Every get_my_* tool (get_my_overview, get_my_items, get_my_assets, get_my_minigames, get_my_history, get_my_tasks) reads the account of whoever is talking to you right now. None of them can read anyone else's, so never call one to answer a question about another person. If someone asks what another member has in their bag, what they are invested in, their history, their minigames or their tasks, tell them plainly that this is private to that member, and offer get_member_info for the public parts — level, XP, rank, roles and staff rating — instead.`;

const PING_NOTE =
	'[System] To ping someone, write their tag in that exact <@id> form — a plain name or a bare number does not ping. Only use an id you have actually been given in this conversation; never invent one.';

const MENTION_RE = /<@!?(\d{17,20})>/g;
const MAX_PINGS_PER_MESSAGE = 5;

async function resolveMentionedMembers(guild: Guild, content: string) {
	if (!guild) {
		return [];
	}

	const ids = [...new Set([...String(content).matchAll(MENTION_RE)].map((match) => match[1]))].slice(0, MAX_PINGS_PER_MESSAGE);
	if (!ids.length) {
		return [];
	}

	const allowed = [];
	for (const id of ids) {
		const member = guild.members.cache.get(id) ?? (await guild.members.fetch(id).catch(() => null));
		if (member && !member.user?.bot) {
			allowed.push(id);
		}
	}

	return allowed;
}

function stripBotMention(content: string, botUserId: unknown) {
	return content
		.replace(new RegExp(`<@!?${botUserId}>`, 'g'), ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function splitForDiscord(text: string, limit: number = DISCORD_LIMITS.MESSAGE) {
	const chunks = [];
	let remaining = text;

	while (remaining.length > limit) {
		let cut = remaining.lastIndexOf('\n', limit);
		if (cut < limit * SPLIT_MIN_FRACTION) {
			cut = remaining.lastIndexOf(' ', limit);
		}
		if (cut < limit * SPLIT_MIN_FRACTION) {
			cut = limit;
		}

		chunks.push(remaining.slice(0, cut).trim());
		remaining = remaining.slice(cut).trim();
	}

	if (remaining) {
		chunks.push(remaining);
	}
	return chunks;
}

let cachedClient: { baseURL: string; apiKey: string | null; client: OpenAI } | null = null;

function getClient(config: AiInput) {
	const baseURL = normalizeBaseUrl(config.api_url!);
	if (cachedClient && cachedClient.baseURL === baseURL && cachedClient.apiKey === config.api_key) {
		return cachedClient.client;
	}
	const client = new OpenAI({ baseURL, apiKey: config.api_key!, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
	cachedClient = { baseURL, apiKey: config.api_key, client };
	return client;
}

async function callChatCompletions(
	config: AiInput,
	messages: ChatCompletionMessageParam[],
	{
		tools = null,
		onToolCall = null
	}: { tools?: ChatCompletionTool[] | null; onToolCall?: ((name: string, args: Record<string, unknown>) => Promise<string>) | null } = {}
) {
	const client = getClient(config);
	const params = buildCompletionParams(config);
	const loop = [...messages];
	const toolResultCache = new Map();
	let lastContent = '';

	for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
		const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
		const shouldOfferTools = tools && onToolCall && !isLastIteration;

		const completion = await client.chat.completions.create({
			...params,
			...(shouldOfferTools ? { tools, tool_choice: 'auto' } : {}),
			messages: loop
		});

		const choice = completion.choices?.[0]?.message;
		if (!choice) {
			return lastContent;
		}

		if (typeof choice.content === 'string' && choice.content.trim()) {
			lastContent = choice.content;
		}

		if (!choice.tool_calls?.length || !onToolCall) {
			return choice.content ?? lastContent;
		}

		loop.push(choice);

		const pending = new Map();

		for (const call of choice.tool_calls as ChatCompletionMessageFunctionToolCall[]) {
			const cacheKey = `${call.function.name}:${call.function.arguments ?? ''}`;
			if (toolResultCache.has(cacheKey) || pending.has(cacheKey)) {
				continue;
			}
			let args = {};
			try {
				args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
			} catch {
				args = {};
			}
			pending.set(cacheKey, onToolCall(call.function.name, args));
		}

		const keys = [...pending.keys()];
		const settled = await Promise.all(pending.values());
		keys.forEach((key, index) => toolResultCache.set(key, settled[index]));

		for (const call of choice.tool_calls as ChatCompletionMessageFunctionToolCall[]) {
			const cacheKey = `${call.function.name}:${call.function.arguments ?? ''}`;
			loop.push({ role: 'tool', tool_call_id: call.id, content: toolResultCache.get(cacheKey) });
		}
	}

	return lastContent;
}

async function fetchRepliedMessage(message: Message) {
	const referenceId = message.reference?.messageId;
	if (!referenceId) {
		return null;
	}

	const cached = message.channel.messages.cache.get(referenceId);
	if (cached) {
		return cached;
	}

	return message.fetchReference().catch(() => null);
}

type GuildAiConfig = Awaited<ReturnType<typeof resolveGuildAiConfig>>;
type GeneratedImage = Awaited<ReturnType<typeof runImageTool>>;
type AiTrigger = { botUserId: string; botId: number; isMentioned: boolean };
type UserTurn = { prompt: string; userContent: string; attachmentParts: unknown[]; attachmentKinds: (string | null)[] };
type ToolSetup = { botId: number; config: GuildAiConfig; wikis: Awaited<ReturnType<typeof getEnabledWikis>>; generatedImages: GeneratedImage[] };
type AiReply = { reply: string; imageFiles: AttachmentBuilder[] };

function aiTrigger(message: Message): AiTrigger | null {
	if (message.author?.bot || !message.guild || message.mentions.everyone) {
		return null;
	}
	const botUserId = message.client.user?.id;
	if (!botUserId) {
		return null;
	}
	const isMentioned = message.mentions.users.has(botUserId);
	if (!isMentioned && !message.reference?.messageId) {
		return null;
	}
	const botConfig = getBotConfig();
	return botConfig?.id ? { botUserId, botId: botConfig.id, isMentioned } : null;
}

function quotedNoteFor(quoted: Message | null, botUserId: string) {
	if (!quoted) {
		return '';
	}
	const quotedText = stripBotMention(quoted.content ?? '', botUserId).trim();
	const quotedName = quoted.member?.displayName ?? quoted.author?.username ?? 'someone';
	const quotedKinds = [...(quoted.attachments?.values?.() ?? [])].map(classifyAttachment).filter(Boolean);
	return `[Replying to ${quotedName}${quotedKinds.length ? ` who attached ${quotedKinds.join(', ')}` : ''}]${quotedText ? ` ${quotedName} said: "${quotedText}"` : ''}\n\n`;
}

async function buildUserTurn(message: Message, { botUserId, replied }: { botUserId: string; replied: Message | null }): Promise<UserTurn> {
	const prompt = stripBotMention(message.content ?? '', botUserId);
	const quoted = replied && replied.author?.id !== botUserId ? replied : null;
	const { parts: attachmentParts, kinds: attachmentKinds } = await buildAttachmentParts([quoted, message]);
	const ownText = prompt || (attachmentParts.length ? `(${attachmentKinds.join(', ')} attached, no message text)` : 'Hello!');
	const speakerName = message.member?.displayName ?? message.author.username;
	const speakerNote = `[System] You are talking with ${speakerName}, whose mention tag is <@${message.author.id}>.`;
	return { prompt, userContent: `${speakerNote}\n\n${quotedNoteFor(quoted, botUserId)}${ownText}`, attachmentParts, attachmentKinds };
}

function aiToolRunner(message: Message<true>, setup: ToolSetup) {
	const { botId, config, wikis, generatedImages } = setup;
	const toolContext = { botId, guildId: message.guild.id, callerDiscordId: message.author.id };
	const asJson = (result: unknown) => JSON.stringify(result);
	return (name: string, args: Record<string, unknown>) => {
		(message.channel as GuildTextBasedChannel).sendTyping().catch(() => {});
		if (SERVER_TOOL_NAMES.has(name)) {
			return runServerTool(name, args, toolContext).then(asJson);
		}
		if (ACCOUNT_TOOL_NAMES.has(name)) {
			return runAccountTool(name, args, toolContext).then(asJson);
		}
		if (KNOWLEDGE_TOOL_NAMES.has(name)) {
			return runKnowledgeTool(name, args, toolContext).then(asJson);
		}
		if (name === 'search_wiki') {
			return runWikiTool(wikis, args, { sessionKey: `${botId}:${message.guild.id}:${message.author.id}` }).then(asJson);
		}
		if (name === 'search_web') {
			return runSearchTool(config, args).then(asJson);
		}
		if (name === 'fetch_web_page') {
			return runFetchTool(config, args).then(asJson);
		}
		if (name === 'generate_image') {
			return runImageTool(config, args).then((result) => {
				if (result.ok && generatedImages.length < MAX_GENERATED_IMAGES) {
					generatedImages.push(result);
				}
				const { buffer, ...summary } = result;
				return finalToolResult(summary.ok ? { ...summary, sent_to_channel: true } : summary);
			});
		}
		return executeVoiceTool(name, message, botId);
	};
}

function availableAiTools(
	config: GuildAiConfig,
	{ wikis, toolFeatures }: { wikis: ToolSetup['wikis']; toolFeatures: Awaited<ReturnType<typeof resolveToolFeatures>> | null }
) {
	const wikiTool = buildWikiTool(wikis);
	const searchTool = buildSearchTool(config);
	const fetchTool = buildFetchTool(config);
	const imageTool = buildImageTool(config);
	return [
		...(config.voice_enabled && !!config.voice_model ? VOICE_TOOLS : []),
		...buildServerTools(toolFeatures),
		...buildAccountTools(toolFeatures),
		...buildKnowledgeTools(),
		...(wikiTool ? [wikiTool] : []),
		...(searchTool ? [searchTool] : []),
		...(fetchTool ? [fetchTool] : []),
		...(imageTool ? [imageTool] : [])
	];
}

async function generateAiReply(message: Message<true>, { botId, config, turn }: { botId: number; config: GuildAiConfig; turn: UserTurn }): Promise<AiReply> {
	const [conversation, wikis, toolFeatures, languageNote] = await Promise.all([
		readAiSession({ botId, guildId: message.guild.id, memberId: message.author.id }, MAX_RECENT),
		getEnabledWikis(botId).catch(() => []),
		resolveToolFeatures(botId, message.guild.id).catch(() => null),
		aiLanguageInstruction(message.guild.id, 'chat').catch(() => '')
	]);

	const hasServerData = buildServerTools(toolFeatures).length > 0 || buildAccountTools(toolFeatures).length > 0;
	const today = isoDay(new Date());
	const systemContent = [config.system_prompt?.replace(/\{\{today\}\}/g, today) ?? '', languageNote, PING_NOTE, hasServerData ? SERVER_DATA_NOTE : '']
		.filter(Boolean)
		.join('\n\n');
	const userMessage = turn.attachmentParts.length
		? { role: 'user', content: [{ type: 'text', text: turn.userContent }, ...turn.attachmentParts] }
		: { role: 'user', content: turn.userContent };
	const messages = [...(systemContent ? [{ role: 'system', content: systemContent }] : []), ...conversation, userMessage];

	const tools = availableAiTools(config, { wikis, toolFeatures });
	const generatedImages: GeneratedImage[] = [];
	const raw = await callChatCompletions(config, messages as ChatCompletionMessageParam[], {
		tools: tools.length ? (tools as ChatCompletionTool[]) : null,
		onToolCall: tools.length ? aiToolRunner(message, { botId, config, wikis, generatedImages }) : null
	});
	const imageFiles = generatedImages
		.map((image, index) => (image.buffer ? new AttachmentBuilder(image.buffer, { name: `image-${index + 1}.png` }) : null))
		.filter(Boolean) as AttachmentBuilder[];
	return { reply: stripReasoning(typeof raw === 'string' ? raw : '').slice(0, MAX_REPLY_LENGTH), imageFiles };
}

async function sendAiReply(message: Message<true>, { reply, imageFiles }: AiReply) {
	const mention = `<@${message.author.id}>`;
	const chunks = splitForDiscord(reply, DISCORD_LIMITS.MESSAGE - mention.length - 1);
	const lastIndex = chunks.length - 1;

	for (let i = 0; i < chunks.length; i++) {
		const content = i === lastIndex ? `${chunks[i]} ${mention}` : chunks[i];
		const named = await resolveMentionedMembers(message.guild, content);
		const allowedMentions = { parse: [], users: [...new Set([...named, ...(i === lastIndex ? [message.author.id] : [])])] };
		if (i === 0) {
			await message.reply({ content, ...(imageFiles.length ? { files: imageFiles } : {}), allowedMentions: { ...allowedMentions, repliedUser: false } });
		} else {
			await (message.channel as GuildTextBasedChannel).send({ content, allowedMentions });
		}
	}
}

async function answerMessage(message: Message<true>, trigger: AiTrigger) {
	const { botId, botUserId } = trigger;
	if (!(await claimAiMessageShared(botId, message.id))) {
		await logger.log(`🔁 AI ignoring message ${message.id}, another process claimed it first`);
		return;
	}

	const [configRow, replied] = await Promise.all([db.getAiByBotId(botId), fetchRepliedMessage(message)]);
	const panelAi = db.aiFromDbRow(configRow);
	if (!panelAi.enabled || !panelAi.api_url || !panelAi.api_key || !panelAi.model) {
		return;
	}
	if (!trigger.isMentioned && replied?.author?.id !== botUserId) {
		return;
	}

	const config = await resolveGuildAiConfig(message.guild.id, panelAi);
	await (message.channel as GuildTextBasedChannel).sendTyping().catch(() => {});
	const turn = await buildUserTurn(message, { botUserId, replied });
	const answer = await generateAiReply(message, { botId, config, turn });

	if (!answer.reply) {
		const fallback = answer.imageFiles.length
			? { files: answer.imageFiles, allowedMentions: { parse: [], repliedUser: false } }
			: { content: await translateServer('ai.errors.noResponse', message.guild.id) };
		await message.reply(fallback).catch(() => {});
		return;
	}

	const scope = { botId, guildId: message.guild.id, memberId: message.author.id };
	const storedContent = turn.attachmentParts.length && turn.prompt ? `${turn.userContent} [${turn.attachmentKinds.join(', ')} attached]` : turn.userContent;
	const persisted = appendAiMessage(scope, 'user', storedContent)
		.then(() => appendAiMessage(scope, 'assistant', answer.reply))
		.catch(() => {});
	await sendAiReply(message, answer);
	await persisted;
}

async function reportAiError(message: Message, error: unknown) {
	const status = error instanceof OpenAI.APIError ? error.status : null;
	await logger.log(`❌ AI chat error${status ? ` (${status})` : ''}: ${(error as Error).message}`);
	const noticeKey =
		status === HTTP.UNAUTHORIZED || status === HTTP.FORBIDDEN
			? 'ai.errors.keyRejected'
			: status === HTTP.TOO_MANY_REQUESTS
				? 'ai.errors.rateLimited'
				: 'ai.errors.failed';
	const notice = await translateServer(noticeKey, message.guild?.id ?? '').catch(() => '');
	if (notice) {
		await message.reply({ content: notice }).catch(() => {});
	}
}

async function handleMessageCreate(message: Message) {
	try {
		const trigger = aiTrigger(message);
		if (!trigger || !message.inGuild()) {
			return;
		}

		const key = sessionKey(message.guild.id, message.author.id);
		if (inFlight.has(key)) {
			return;
		}
		if (!claimAiMessageLocal(trigger.botId, message.id)) {
			await logger.log(`🔁 AI ignoring a duplicate delivery of message ${message.id}`);
			return;
		}
		inFlight.add(key);
		try {
			await answerMessage(message, trigger);
		} finally {
			inFlight.delete(key);
		}
	} catch (error) {
		await reportAiError(message, error);
	}
}

function init(client: Client) {
	client.on('messageCreate', handleMessageCreate);
}

export default { init, splitForDiscord, normalizeBaseUrl };
