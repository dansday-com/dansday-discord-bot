import OpenAI from 'openai';
import { getBotConfig } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';

const DISCORD_MESSAGE_LIMIT = 2000;
const MAX_REPLY_LENGTH = 4000;
const HISTORY_LIMIT = 40;
const MAX_RECENT = 10;
const REQUEST_TIMEOUT_MS = 120_000;

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
	const client = new OpenAI({ baseURL, apiKey: config.api_key, timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 });
	cachedClient = { baseURL, apiKey: config.api_key, client };
	return client;
}

async function callChatCompletions(config, messages) {
	const completion = await getClient(config).chat.completions.create({
		...buildCompletionParams(config),
		messages
	});
	return completion.choices?.[0]?.message?.content ?? '';
}

async function summarizeOlderMessages(config, olderMessages) {
	const conversationText = olderMessages
		.filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
		.map((m) => `${m.role}: ${m.content}`)
		.join('\n');

	if (!conversationText.trim()) return null;

	try {
		const completion = await getClient(config).chat.completions.create({
			model: config.model,
			messages: [
				{
					role: 'system',
					content:
						'Summarize this conversation history in 2-4 concise sentences. Focus on what was discussed, what questions were asked, and what answers were given. Keep it factual and brief.'
				},
				{ role: 'user', content: conversationText }
			]
		});
		return completion.choices?.[0]?.message?.content?.trim() || null;
	} catch (error) {
		await logger.log(`⚠️ AI chat summary failed, using recent messages only: ${error.message}`);
		return null;
	}
}

async function buildConversation(config, history) {
	if (history.length <= MAX_RECENT) {
		return history.map((row) => ({ role: row.role, content: row.content }));
	}

	const older = history.slice(0, -MAX_RECENT);
	const recent = history.slice(-MAX_RECENT).map((row) => ({ role: row.role, content: row.content }));
	const summary = await summarizeOlderMessages(config, older);

	return summary
		? [{ role: 'user', content: `[Previous conversation summary: ${summary}]` }, { role: 'assistant', content: 'Understood.' }, ...recent]
		: recent;
}

async function isReplyToBot(message, botUserId) {
	const referenceId = message.reference?.messageId;
	if (!referenceId) return false;

	const cached = message.channel.messages.cache.get(referenceId);
	if (cached) return cached.author?.id === botUserId;

	try {
		const fetched = await message.fetchReference();
		return fetched?.author?.id === botUserId;
	} catch {
		return false;
	}
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

		if (!mentioned && !(await isReplyToBot(message, botUserId))) return;

		const key = sessionKey(message.guild.id, message.author.id);
		if (inFlight.has(key)) return;
		inFlight.add(key);

		try {
			const prompt = stripBotMention(message.content ?? '', botUserId);
			const userContent = prompt || 'Hello!';

			await message.channel.sendTyping().catch(() => {});

			const history = await db.getBotAiSession(botConfig.id, message.guild.id, message.author.id, HISTORY_LIMIT);
			const conversation = await buildConversation(config, history);

			const today = new Date().toISOString().slice(0, 10);
			const systemContent = config.system_prompt?.replaceAll('{{today}}', today) ?? '';

			const messages = [...(systemContent ? [{ role: 'system', content: systemContent }] : []), ...conversation, { role: 'user', content: userContent }];

			const raw = await callChatCompletions(config, messages);
			const reply = stripReasoning(typeof raw === 'string' ? raw : '').slice(0, MAX_REPLY_LENGTH);

			if (!reply) {
				await message.reply({ content: 'I could not generate a response right now. Please try again.' }).catch(() => {});
				return;
			}

			await db.appendBotAiMessage(botConfig.id, message.guild.id, message.author.id, 'user', userContent);
			await db.appendBotAiMessage(botConfig.id, message.guild.id, message.author.id, 'assistant', reply);

			const chunks = splitForDiscord(reply);
			let replied = false;
			for (const chunk of chunks) {
				if (!replied) {
					await message.reply({ content: chunk, allowedMentions: { repliedUser: true, parse: [] } });
					replied = true;
				} else {
					await message.channel.send({ content: chunk, allowedMentions: { parse: [] } });
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
