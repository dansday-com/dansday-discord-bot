import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GEMINI_VOICE_NAMES } from '../src/lib/geminiVoices.ts';
import { SERVER_AI_SYSTEM_PROMPT_MAX, normalizeServerAiSettings, validateServerAiSettings } from '../src/lib/server-ai-settings.ts';

const EMPTY = { system_prompt: null, voice_system_prompt: null, voice_name: null };
const VOICE = GEMINI_VOICE_NAMES[0];

test('anything that is not a settings object normalises to empty settings', () => {
	assert.deepEqual(normalizeServerAiSettings(null), EMPTY);
	assert.deepEqual(normalizeServerAiSettings('prompt'), EMPTY);
	assert.deepEqual(normalizeServerAiSettings(['prompt']), EMPTY);
	assert.deepEqual(normalizeServerAiSettings({}), EMPTY);
});

test('prompts are trimmed and blank ones become null', () => {
	assert.deepEqual(normalizeServerAiSettings({ system_prompt: '  Be kind.  ', voice_system_prompt: '   ', voice_name: VOICE }), {
		system_prompt: 'Be kind.',
		voice_system_prompt: null,
		voice_name: VOICE
	});
	assert.equal(normalizeServerAiSettings({ system_prompt: 42 }).system_prompt, null);
});

test('only a known voice name is kept', () => {
	assert.ok(GEMINI_VOICE_NAMES.length > 0);
	assert.equal(normalizeServerAiSettings({ voice_name: ` ${VOICE} ` }).voice_name, VOICE);
	assert.equal(normalizeServerAiSettings({ voice_name: 'NotAVoice' }).voice_name, null);
});

test('valid settings pass validation', () => {
	assert.equal(validateServerAiSettings({}), null);
	assert.equal(validateServerAiSettings(null), null);
	assert.equal(validateServerAiSettings({ system_prompt: 'x'.repeat(SERVER_AI_SYSTEM_PROMPT_MAX), voice_name: VOICE }), null);
	assert.equal(validateServerAiSettings({ system_prompt: `${'x'.repeat(SERVER_AI_SYSTEM_PROMPT_MAX)}   ` }), null);
});

test('a prompt over the limit or an unknown voice is rejected with a message', () => {
	assert.equal(
		validateServerAiSettings({ system_prompt: 'x'.repeat(SERVER_AI_SYSTEM_PROMPT_MAX + 1) }),
		`System prompt must be at most ${SERVER_AI_SYSTEM_PROMPT_MAX} characters`
	);
	assert.equal(
		validateServerAiSettings({ voice_system_prompt: 'x'.repeat(SERVER_AI_SYSTEM_PROMPT_MAX + 1) }),
		`Voice system prompt must be at most ${SERVER_AI_SYSTEM_PROMPT_MAX} characters`
	);
	assert.equal(validateServerAiSettings({ voice_name: 'NotAVoice' }), 'Unknown voice name');
});
