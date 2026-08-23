import OpenAI from 'openai';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 20_000;
const WANTED_LINES = 5;
const MAX_LINE_LENGTH = 200;

const KINDS = {
	welcome: {
		placeholders: ['{user}', '{server}', '{memberCount}', '{accountAge}'],
		brief:
			'Write short, warm one-line greetings for a member who just joined a Discord server. Each line should feel genuinely happy they are here and make them want to say hello back.',
		example: '👋 Welcome {user} to {server}! You are member #{memberCount} — glad you made it.'
	},
	boost: {
		placeholders: ['{user}', '{server}', '{boostLevel}', '{totalBoosts}'],
		brief:
			'Write short, grateful one-line messages thanking a member who just boosted a Discord server. Each line should feel like a real thank you, not a receipt.',
		example: '💎 Thank you {user} for boosting {server}! We are Level {boostLevel} now with {totalBoosts} boosts.'
	}
};

function cacheKey(kind, serverId) {
	return `dansday:ai-greeting:${kind}:${serverId}`;
}

function normalizeBaseUrl(rawUrl) {
	const trimmed = String(rawUrl ?? '')
		.trim()
		.replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed.slice(0, -'/chat/completions'.length) : trimmed;
}

function stripReasoning(text) {
	return String(text ?? '')
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.trim();
}

function parseLines(raw, kind) {
	const required = kind === 'welcome' ? ['{user}'] : ['{user}'];

	return stripReasoning(raw)
		.split('\n')
		.map((line) =>
			line
				.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
				.replace(/^["'`]|["'`]$/g, '')
				.trim()
		)
		.filter((line) => line.length > 0 && line.length <= MAX_LINE_LENGTH)
		.filter((line) => required.every((token) => line.includes(token)))
		.filter((line) => !/\{[a-z]/i.test(line.replace(/\{(?:user|server|memberCount|accountAge|boostLevel|totalBoosts)\}/g, '')))
		.slice(0, WANTED_LINES);
}

async function readCache(kind, serverId) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return null;
	try {
		const raw = await redis.get(cacheKey(kind, serverId));
		const parsed = raw ? JSON.parse(raw) : null;
		return Array.isArray(parsed) && parsed.length ? parsed : null;
	} catch {
		return null;
	}
}

async function writeCache(kind, serverId, lines) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return;
	try {
		await redis.set(cacheKey(kind, serverId), JSON.stringify(lines), { EX: CACHE_TTL_SECONDS });
	} catch {
		/* cache is best effort */
	}
}

async function generate(kind, config, serverName) {
	const spec = KINDS[kind];
	const client = new OpenAI({
		baseURL: normalizeBaseUrl(config.api_url),
		apiKey: config.api_key,
		timeout: REQUEST_TIMEOUT_MS,
		maxRetries: 0
	});

	const prompt = `${spec.brief}

The server is called "${serverName}".

Write exactly ${WANTED_LINES} different lines, one per line, nothing else — no numbering, no bullets, no quotes, no explanation.

Rules for every line:
- Keep it to one short sentence that reads well out loud.
- Start with one fitting emoji, then the text.
- Use these placeholders exactly as written, they get replaced later: ${spec.placeholders.join(' ')}
- Every line must contain {user}.
- Never invent any other {placeholder}.
- Do not mention being an AI, and do not use hashtags.

For example: ${spec.example}`;

	const completion = await client.chat.completions.create({
		model: config.model,
		messages: [{ role: 'user', content: prompt }]
	});

	return parseLines(completion.choices?.[0]?.message?.content ?? '', kind);
}

export async function aiGreetingMessages(kind, { botId, serverId, serverName }) {
	if (!KINDS[kind] || !botId || !serverId) return null;

	const cached = await readCache(kind, serverId);
	if (cached) return cached;

	const config = db.botAiFromDbRow(await db.getBotAiByBotId(botId).catch(() => null));
	if (!config.enabled || !config.api_url || !config.api_key || !config.model) return null;

	try {
		const lines = await generate(kind, config, serverName || 'this server');
		if (!lines.length) {
			await logger.log(`⚠️ AI ${kind} message generation returned nothing usable, using the built-in messages`);
			return null;
		}

		await writeCache(kind, serverId, lines);
		await logger.log(`✨ AI wrote ${lines.length} ${kind} message(s) for ${serverName || serverId}`);
		return lines;
	} catch (error) {
		await logger.log(`❌ AI ${kind} message generation failed: ${error.message}`);
		return null;
	}
}

export default { aiGreetingMessages };
