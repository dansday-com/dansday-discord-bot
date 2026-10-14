import OpenAI from 'openai';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { SERVER_SETTINGS } from '../../../panelServer.js';
import { normalizeServerLanguage, serverLanguageEnglishName } from '../../../../languages.js';
import type { AiInput } from '../../../../database.js';
import { DAY_SECONDS } from '../../../../utils/time.js';

const CACHE_TTL_SECONDS = DAY_SECONDS;
const REQUEST_TIMEOUT_MS = 20_000;
const WANTED_LINES = 5;
const MAX_LINE_LENGTH = 200;

const KINDS = {
	welcome: {
		placeholders: ['{user}', '{server}', '{memberCount}', '{accountAge}'],
		required: '{user}',
		brief:
			'Write short, warm one-line greetings for a member who just joined a Discord server. Each line should feel genuinely happy they are here and make them want to say hello back.',
		example: '👋 Welcome {user} to {server}! You are member #{memberCount} — glad you made it.'
	},
	leave: {
		placeholders: ['{username}', '{server}', '{memberCount}', '{timeInServer}'],
		required: '{username}',
		brief:
			'Write short, kind one-line goodbyes for a member who just left a Discord server. Each line should wish them well without guilt-tripping them, and leave the door open to come back.',
		example: '👋 {username} left {server} after {timeInServer}. Safe travels — {memberCount} of us are still here.'
	},
	boost: {
		placeholders: ['{user}', '{server}', '{boostLevel}', '{totalBoosts}'],
		required: '{user}',
		brief:
			'Write short, grateful one-line messages thanking a member who just boosted a Discord server. Each line should feel like a real thank you, not a receipt.',
		example: '💎 Thank you {user} for boosting {server}! We are Level {boostLevel} now with {totalBoosts} boosts.'
	}
};

function cacheKey(kind: string, serverId: number | string, lang: string) {
	return `dansday:ai-greeting:${kind}:${serverId}:${lang}`;
}

async function serverLanguage(serverId: number | string) {
	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	return normalizeServerLanguage(row?.settings?.language);
}

function normalizeBaseUrl(rawUrl: unknown) {
	const trimmed = String(rawUrl ?? '')
		.trim()
		.replace(/\/+$/, '');
	return trimmed.endsWith('/chat/completions') ? trimmed.slice(0, -'/chat/completions'.length) : trimmed;
}

function stripReasoning(text: string) {
	return String(text ?? '')
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.trim();
}

function parseLines(raw: string, kind: string | number) {
	const { required } = KINDS[kind as keyof typeof KINDS];

	return stripReasoning(raw)
		.split('\n')
		.map((line) =>
			line
				.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
				.replace(/^["'`]|["'`]$/g, '')
				.trim()
		)
		.filter((line) => line.length > 0 && line.length <= MAX_LINE_LENGTH)
		.filter((line) => line.includes(required))
		.filter((line) => !/\{[a-z]/i.test(line.replace(/\{(?:user|username|server|memberCount|accountAge|timeInServer|boostLevel|totalBoosts)\}/g, '')))
		.slice(0, WANTED_LINES);
}

async function readCache(kind: string, serverId: number | string, lang: string) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return null;
	}
	try {
		const raw = await redis.get(cacheKey(kind, serverId, lang));
		const parsed = raw ? JSON.parse(raw) : null;
		return Array.isArray(parsed) && parsed.length ? parsed : null;
	} catch {
		return null;
	}
}

type GreetingKey = { kind: string; serverId: number | string; lang: string };

async function writeCache({ kind, serverId, lang }: GreetingKey, lines: string[]) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		return;
	}
	try {
		await redis.set(cacheKey(kind, serverId, lang), JSON.stringify(lines), { EX: CACHE_TTL_SECONDS });
	} catch {}
}

type GreetingTarget = { serverName: string | null; lang: string };

async function generate(kind: string | number, config: AiInput, { serverName, lang }: GreetingTarget) {
	const spec = KINDS[kind as keyof typeof KINDS];
	const client = new OpenAI({
		baseURL: normalizeBaseUrl(config.api_url),
		apiKey: config.api_key,
		timeout: REQUEST_TIMEOUT_MS,
		maxRetries: 0
	});

	const prompt = `${spec.brief}

The server is called "${serverName}".

Write every line in ${serverLanguageEnglishName(lang)}. Keep the placeholders exactly as written, untranslated.

Write exactly ${WANTED_LINES} different lines, one per line, nothing else — no numbering, no bullets, no quotes, no explanation.

Rules for every line:
- Keep it to one short sentence that reads well out loud.
- Start with one fitting emoji, then the text.
- Use these placeholders exactly as written, they get replaced later: ${spec.placeholders.join(' ')}
- Every line must contain ${spec.required}.
- Never invent any other {placeholder}.
- Do not mention being an AI, and do not use hashtags.

For example: ${spec.example}`;

	const completion = await client.chat.completions.create({
		model: config.model!,
		messages: [{ role: 'user', content: prompt }]
	});

	return parseLines(completion.choices?.[0]?.message?.content ?? '', kind);
}

export async function aiGreetingMessages(kind: string, { botId, serverId, serverName }: { botId: number; serverId: number; serverName: string | null }) {
	if (!KINDS[kind as keyof typeof KINDS] || !botId || !serverId) {
		return null;
	}

	const lang = await serverLanguage(serverId);
	const cached = await readCache(kind, serverId, lang);
	if (cached) {
		return cached;
	}

	const config = db.aiFromDbRow(await db.getAiByBotId(botId).catch(() => null));
	if (!config.enabled || !config.api_url || !config.api_key || !config.model) {
		return null;
	}

	try {
		const lines = await generate(kind, config, { serverName: serverName || 'this server', lang });
		if (!lines.length) {
			await logger.log(`⚠️ AI ${kind} message generation returned nothing usable, using the built-in messages`);
			return null;
		}

		await writeCache({ kind, serverId, lang }, lines);
		await logger.log(`✨ AI wrote ${lines.length} ${kind} message(s) for ${serverName || serverId}`);
		return lines;
	} catch (error) {
		await logger.log(`❌ AI ${kind} message generation failed: ${(error as Error).message}`);
		return null;
	}
}

export default { aiGreetingMessages };
