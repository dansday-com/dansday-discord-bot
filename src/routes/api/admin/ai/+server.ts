import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { aiFromDbRow, AI_REASONING_LEVELS, AI_VOICE_THINKING_LEVELS, type AiInput, type AiReasoning, type AiVoiceThinking } from '$lib/database.js';
import { GEMINI_VOICE_NAMES } from '$lib/geminiVoices.js';
import { HTTP } from '$lib/http.js';

const MAX_MODEL_LENGTH = 191;
const MAX_SYSTEM_PROMPT_LENGTH = 8000;

function maskConfig(config: AiInput) {
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

function authorize(locals: App.Locals) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED }) };
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return { error: json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN }) };
	}

	const panelId = Number(locals.user.panel_id);
	if (!Number.isFinite(panelId) || panelId <= 0) {
		return { error: json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND }) };
	}

	return { panelId };
}

export const GET: RequestHandler = async ({ locals }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}

	const row = await db.getAi(auth.panelId!);
	return json({ ai: maskConfig(aiFromDbRow(row)) });
};

type AiBody = Record<string, unknown>;

function optionalText(value: unknown): string | null {
	return value === null || value === undefined ? null : String(value).trim() || null;
}

function keyOrExisting(value: unknown, existing: string | null): string | null {
	const raw = value === null || value === undefined ? '' : String(value).trim();
	return raw || existing;
}

function readAiInput(body: AiBody, existing: AiInput): AiInput {
	return {
		enabled: body.enabled === true,
		api_url: optionalText(body.api_url),
		api_key: keyOrExisting(body.api_key, existing.api_key),
		model: optionalText(body.model),
		system_prompt: optionalText(body.system_prompt),
		reasoning: (body.reasoning === null || body.reasoning === undefined ? 'none' : String(body.reasoning)) as AiReasoning,
		voice_enabled: body.voice_enabled === true,
		voice_model: optionalText(body.voice_model),
		voice_name: optionalText(body.voice_name),
		voice_thinking: (body.voice_thinking === null || body.voice_thinking === undefined ? 'low' : String(body.voice_thinking)) as AiVoiceThinking,
		voice_api_key: keyOrExisting(body.voice_api_key, existing.voice_api_key),
		voice_system_prompt: optionalText(body.voice_system_prompt),
		search_api_url: optionalText(body.search_api_url),
		search_api_key: keyOrExisting(body.search_api_key, existing.search_api_key),
		search_model: optionalText(body.search_model),
		fetch_api_url: optionalText(body.fetch_api_url),
		fetch_api_key: keyOrExisting(body.fetch_api_key, existing.fetch_api_key),
		fetch_model: optionalText(body.fetch_model),
		image_api_url: optionalText(body.image_api_url),
		image_api_key: keyOrExisting(body.image_api_key, existing.image_api_key),
		image_model: optionalText(body.image_model)
	};
}

function voiceInputError(input: AiInput): string | null {
	if (input.voice_model && input.voice_model.length > MAX_MODEL_LENGTH) {
		return `Voice model name must be at most ${MAX_MODEL_LENGTH} characters`;
	}
	if (input.voice_name && !GEMINI_VOICE_NAMES.includes(input.voice_name)) {
		return 'Unknown voice name';
	}
	if (input.voice_enabled && (!input.voice_api_key || !input.voice_model)) {
		return 'Voice API key and voice model are required to enable voice AI';
	}
	return input.voice_enabled && !input.enabled ? 'Enable AI chat first — voice is triggered by asking the bot in chat' : null;
}

function limitsError(input: AiInput): string | null {
	const urls = [
		['API URL', input.api_url],
		['Web search API URL', input.search_api_url],
		['Web fetch API URL', input.fetch_api_url],
		['Image API URL', input.image_api_url]
	] as const;
	const badUrl = urls.find(([, url]) => url && !/^https?:\/\//i.test(url));
	if (badUrl) {
		return `${badUrl[0]} must start with http:// or https://`;
	}
	const models = [
		['Model', input.model],
		['Web search model', input.search_model],
		['Web fetch model', input.fetch_model],
		['Image model', input.image_model]
	] as const;
	const longModel = models.find(([, name]) => name && name.length > MAX_MODEL_LENGTH);
	if (longModel) {
		return `${longModel[0]} name must be at most ${MAX_MODEL_LENGTH} characters`;
	}
	const prompts = [
		['System prompt', input.system_prompt],
		['Voice system prompt', input.voice_system_prompt]
	] as const;
	const longPrompt = prompts.find(([, prompt]) => prompt && prompt.length > MAX_SYSTEM_PROMPT_LENGTH);
	return longPrompt ? `${longPrompt[0]} must be at most ${MAX_SYSTEM_PROMPT_LENGTH} characters` : null;
}

function aiInputError(input: AiInput): string | null {
	if (!AI_REASONING_LEVELS.includes(input.reasoning)) {
		return 'Invalid reasoning level';
	}
	if (!AI_VOICE_THINKING_LEVELS.includes(input.voice_thinking)) {
		return 'Invalid voice thinking level';
	}
	const invalid = voiceInputError(input) ?? limitsError(input);
	if (invalid) {
		return invalid;
	}
	return input.enabled && (!input.api_url || !input.api_key || !input.model) ? 'API URL, API key, and model are required to enable AI chat' : null;
}

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}
	const panelId = auth.panelId!;

	const body: AiBody | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const input = readAiInput(body, aiFromDbRow(await db.getAi(panelId)));
	const invalid = aiInputError(input);
	if (invalid) {
		return json({ success: false, error: invalid }, { status: HTTP.BAD_REQUEST });
	}

	const saved = await db.upsertAi(panelId, input);
	return json({ success: true, ai: maskConfig(aiFromDbRow(saved)) });
};
