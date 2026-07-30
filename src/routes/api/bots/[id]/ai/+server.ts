import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { botAiFromDbRow, BOT_AI_REASONING_LEVELS, type BotAiInput, type BotAiReasoning } from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const MAX_MODEL_LENGTH = 191;
const MAX_SYSTEM_PROMPT_LENGTH = 8000;

function maskConfig(config: BotAiInput) {
	const { api_key, ...rest } = config;
	return { ...rest, has_api_key: Boolean(api_key) };
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

	if (voice_model && voice_model.length > MAX_MODEL_LENGTH) {
		return json({ success: false, error: `Voice model name must be at most ${MAX_MODEL_LENGTH} characters` }, { status: 400 });
	}
	if (voice_enabled && (!api_key || !voice_model)) {
		return json({ success: false, error: 'API key and voice model are required to enable voice AI' }, { status: 400 });
	}
	if (voice_enabled && !enabled) {
		return json({ success: false, error: 'Enable AI chat first — voice is triggered by asking the bot in chat' }, { status: 400 });
	}

	if (api_url && !/^https?:\/\//i.test(api_url)) {
		return json({ success: false, error: 'API URL must start with http:// or https://' }, { status: 400 });
	}
	if (model && model.length > MAX_MODEL_LENGTH) {
		return json({ success: false, error: `Model name must be at most ${MAX_MODEL_LENGTH} characters` }, { status: 400 });
	}
	if (system_prompt && system_prompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
		return json({ success: false, error: `System prompt must be at most ${MAX_SYSTEM_PROMPT_LENGTH} characters` }, { status: 400 });
	}
	if (enabled && (!api_url || !api_key || !model)) {
		return json({ success: false, error: 'API URL, API key, and model are required to enable AI chat' }, { status: 400 });
	}

	const saved = await db.upsertBotAi(botId, { enabled, api_url, api_key, model, system_prompt, reasoning, voice_enabled, voice_model });
	return json({ success: true, ai: maskConfig(botAiFromDbRow(saved)) });
};
