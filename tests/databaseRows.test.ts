import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BOT_PRESENCE, aiFromDbRow, presenceFromDbRow } from '../src/lib/database.ts';

test('a bot with no saved presence gets the default one', () => {
	assert.deepEqual(presenceFromDbRow(null), DEFAULT_BOT_PRESENCE);
	assert.deepEqual(presenceFromDbRow(undefined), DEFAULT_BOT_PRESENCE);
	assert.notEqual(presenceFromDbRow(null), DEFAULT_BOT_PRESENCE);
});

test('a saved presence keeps its values and falls back only where a field is blank', () => {
	const saved = presenceFromDbRow({
		discord_status: 'dnd',
		activity_type: 'watching',
		activity_name: '  the server  ',
		activity_url: 'https://example.test/live',
		activity_state: '   '
	});
	assert.deepEqual(saved, {
		discord_status: 'dnd',
		activity_type: 'watching',
		activity_name: 'the server',
		activity_url: 'https://example.test/live',
		activity_state: DEFAULT_BOT_PRESENCE.activity_state
	});
	const blank = presenceFromDbRow({ discord_status: 'idle', activity_type: 'playing', activity_name: null, activity_url: '  ', activity_state: null });
	assert.equal(blank.activity_name, DEFAULT_BOT_PRESENCE.activity_name);
	assert.equal(blank.activity_url, null);
});

test('missing assistant settings start disabled with nothing configured', () => {
	const empty = aiFromDbRow(null);
	assert.equal(empty.enabled, false);
	assert.equal(empty.voice_enabled, false);
	assert.equal(empty.api_key, null);
	assert.equal(empty.reasoning, 'none');
	assert.notEqual(aiFromDbRow(null), aiFromDbRow(null));
});

test('assistant settings are trimmed, blanks become null and unknown levels fall back', () => {
	const settings = aiFromDbRow({
		enabled: 1,
		voice_enabled: true,
		api_url: '  https://llm.example.test/v1  ',
		api_key: '   ',
		model: 'model-a',
		reasoning: 'not-a-level',
		voice_thinking: 'not-a-level',
		system_prompt: ''
	});
	assert.equal(settings.enabled, true);
	assert.equal(settings.voice_enabled, true);
	assert.equal(settings.api_url, 'https://llm.example.test/v1');
	assert.equal(settings.api_key, null);
	assert.equal(settings.model, 'model-a');
	assert.equal(settings.system_prompt, null);
	assert.equal(settings.reasoning, 'none');
	assert.equal(settings.voice_thinking, 'low');
	assert.equal(settings.image_model, null);
});

test('only true or 1 switches the assistant on', () => {
	assert.equal(aiFromDbRow({ enabled: 0 }).enabled, false);
	assert.equal(aiFromDbRow({ enabled: '1' }).enabled, false);
	assert.equal(aiFromDbRow({ enabled: true }).enabled, true);
});
