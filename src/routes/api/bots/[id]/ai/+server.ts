import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { botAiFromDbRow, BOT_AI_REASONING_LEVELS, type BotAiInput, type BotAiReasoning } from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';
import { GEMINI_VOICE_NAMES } from '$lib/geminiVoices.js';

const MAX_MODEL_LENGTH = 191;
const MAX_SYSTEM_PROMPT_LENGTH = 8000;

function maskConfig(config: BotAiInput) {
	const { api_key, voice_api_key, search_api_key, fetch_api_key, image_api_key, ...rest } = config;
	return {
		...rest,
		has_api_key: Boolean(api_key),
		has_voice_api_key: Boolean(voice_api_key),
		has_search_api_key: Boolean(search_api_key),
		has_fetch_api_key: Boolean(fetch_api_key),
		has_image_api_key: Boolean(image_api_key)
	};
}

async function authorize(locals: App.Locals, params: Partial<Record<string, string>>) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: 401 }) };
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId)) {
		return { error: json({ success: false, error: 'Invalid bot id' }, { status: 400 }) };
	}

	const bot = await db.getBot(botId);
	if (!bot) {
		return { error: json({ success: false, error: 'Bot not found' }, { status: 404 }) };
	}

	if (!(await accountOwnsBot(locals, botId))) {
		return { error: json({ success: false, error: 'Access denied' }, { status: 403 }) };
	}

	return { botId };
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;

	const row = await db.getBotAiByBotId(auth.botId!);
	return json({ ai: maskConfig(botAiFromDbRow(row)) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const auth = await authorize(locals, params);
	if (auth.error) return auth.error;
	const botId = auth.botId!;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const existing = botAiFromDbRow(await db.getBotAiByBotId(botId));

	const enabled = body.enabled === true;
	const api_url = body.api_url === null || body.api_url === undefined ? null : String(body.api_url).trim() || null;
	const model = body.model === null || body.model === undefined ? null : String(body.model).trim() || null;
	const system_prompt = body.system_prompt === null || body.system_prompt === undefined ? null : String(body.system_prompt).trim() || null;

	const rawKey = body.api_key === null || body.api_key === undefined ? '' : String(body.api_key).trim();
	const api_key = rawKey ? rawKey : existing.api_key;

	const reasoning = (body.reasoning === null || body.reasoning === undefined ? 'none' : String(body.reasoning)) as BotAiReasoning;
	if (!BOT_AI_REASONING_LEVELS.includes(reasoning)) {
		return json({ success: false, error: 'Invalid reasoning level' }, { status: 400 });
	}

	const voice_enabled = body.voice_enabled === true;
	const voice_model = body.voice_model === null || body.voice_model === undefined ? null : String(body.voice_model).trim() || null;
	const voice_name = body.voice_name === null || body.voice_name === undefined ? null : String(body.voice_name).trim() || null;
	const voice_api_url = body.voice_api_url === null || body.voice_api_url === undefined ? null : String(body.voice_api_url).trim() || null;
	const voice_system_prompt =
		body.voice_system_prompt === null || body.voice_system_prompt === undefined ? null : String(body.voice_system_prompt).trim() || null;

	const rawVoiceKey = body.voice_api_key === null || body.voice_api_key === undefined ? '' : String(body.voice_api_key).trim();
	const voice_api_key = rawVoiceKey ? rawVoiceKey : existing.voice_api_key;

	const search_api_url = body.search_api_url === null || body.search_api_url === undefined ? null : String(body.search_api_url).trim() || null;
	const search_model = body.search_model === null || body.search_model === undefined ? null : String(body.search_model).trim() || null;
	const rawSearchKey = body.search_api_key === null || body.search_api_key === undefined ? '' : String(body.search_api_key).trim();
	const search_api_key = rawSearchKey ? rawSearchKey : existing.search_api_key;

	const fetch_api_url = body.fetch_api_url === null || body.fetch_api_url === undefined ? null : String(body.fetch_api_url).trim() || null;
	const fetch_model = body.fetch_model === null || body.fetch_model === undefined ? null : String(body.fetch_model).trim() || null;
	const rawFetchKey = body.fetch_api_key === null || body.fetch_api_key === undefined ? '' : String(body.fetch_api_key).trim();
	const fetch_api_key = rawFetchKey ? rawFetchKey : existing.fetch_api_key;

	const image_api_url = body.image_api_url === null || body.image_api_url === undefined ? null : String(body.image_api_url).trim() || null;
	const image_model = body.image_model === null || body.image_model === undefined ? null : String(body.image_model).trim() || null;
	const rawImageKey = body.image_api_key === null || body.image_api_key === undefined ? '' : String(body.image_api_key).trim();
	const image_api_key = rawImageKey ? rawImageKey : existing.image_api_key;

	if (voice_model && voice_model.length > MAX_MODEL_LENGTH) {
		return json({ success: false, error: `Voice model name must be at most ${MAX_MODEL_LENGTH} characters` }, { status: 400 });
	}
	if (voice_name && !GEMINI_VOICE_NAMES.includes(voice_name)) {
		return json({ success: false, error: 'Unknown voice name' }, { status: 400 });
	}
	if (voice_enabled && (!voice_api_url || !voice_api_key || !voice_model)) {
		return json({ success: false, error: 'Voice API URL, API key, and voice model are required to enable voice AI' }, { status: 400 });
	}
	if (voice_enabled && !enabled) {
		return json({ success: false, error: 'Enable AI chat first — voice is triggered by asking the bot in chat' }, { status: 400 });
	}

	for (const [label, url] of [
		['API URL', api_url],
		['Voice API URL', voice_api_url],
		['Web search API URL', search_api_url],
		['Web fetch API URL', fetch_api_url],
		['Image API URL', image_api_url]
	] as const) {
		if (url && !/^https?:\/\//i.test(url)) {
			return json({ success: false, error: `${label} must start with http:// or https://` }, { status: 400 });
		}
	}

	for (const [label, name] of [
		['Model', model],
		['Web search model', search_model],
		['Web fetch model', fetch_model],
		['Image model', image_model]
	] as const) {
		if (name && name.length > MAX_MODEL_LENGTH) {
			return json({ success: false, error: `${label} name must be at most ${MAX_MODEL_LENGTH} characters` }, { status: 400 });
		}
	}

	for (const [label, prompt] of [
		['System prompt', system_prompt],
		['Voice system prompt', voice_system_prompt]
	] as const) {
		if (prompt && prompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
			return json({ success: false, error: `${label} must be at most ${MAX_SYSTEM_PROMPT_LENGTH} characters` }, { status: 400 });
		}
	}

	if (enabled && (!api_url || !api_key || !model)) {
		return json({ success: false, error: 'API URL, API key, and model are required to enable AI chat' }, { status: 400 });
	}

	const saved = await db.upsertBotAi(botId, {
		enabled,
		api_url,
		api_key,
		model,
		system_prompt,
		reasoning,
		voice_enabled,
		voice_model,
		voice_name,
		voice_api_url,
		voice_api_key,
		voice_system_prompt,
		search_api_url,
		search_api_key,
		search_model,
		fetch_api_url,
		fetch_api_key,
		fetch_model,
		image_api_url,
		image_api_key,
		image_model
	});
	return json({ success: true, ai: maskConfig(botAiFromDbRow(saved)) });
};
