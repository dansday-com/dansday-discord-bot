import { GEMINI_VOICE_NAMES } from './geminiVoices.js';

export const SERVER_AI_SYSTEM_PROMPT_MAX = 8000;

export interface ServerAiSettings {
	system_prompt: string | null;
	voice_system_prompt: string | null;
	voice_name: string | null;
}

function trimmedOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function normalizeServerAiSettings(raw: unknown): ServerAiSettings {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { system_prompt: null, voice_system_prompt: null, voice_name: null };
	}
	const s = raw as Record<string, unknown>;
	const voiceName = trimmedOrNull(s.voice_name);
	return {
		system_prompt: trimmedOrNull(s.system_prompt),
		voice_system_prompt: trimmedOrNull(s.voice_system_prompt),
		voice_name: voiceName && GEMINI_VOICE_NAMES.includes(voiceName) ? voiceName : null
	};
}

export function validateServerAiSettings(raw: unknown): string | null {
	const s = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

	for (const [label, key] of [
		['System prompt', 'system_prompt'],
		['Voice system prompt', 'voice_system_prompt']
	] as const) {
		const value = s[key];
		if (typeof value === 'string' && value.trim().length > SERVER_AI_SYSTEM_PROMPT_MAX) {
			return `${label} must be at most ${SERVER_AI_SYSTEM_PROMPT_MAX} characters`;
		}
	}

	const voiceName = trimmedOrNull(s.voice_name);
	if (voiceName && !GEMINI_VOICE_NAMES.includes(voiceName)) {
		return 'Unknown voice name';
	}

	return null;
}
