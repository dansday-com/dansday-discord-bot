import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	MAX_ESCALATION_STEPS,
	MAX_REASON_PRESETS,
	MAX_REASON_PRESET_LENGTH,
	MAX_TIMEOUT_SECONDS,
	MAX_WARN_EXPIRY_DAYS,
	escalationStepFor,
	moderationRulesFromSettings,
	normalizeEscalation,
	normalizeReasonPresets
} from '../src/lib/moderation-rules.ts';

test('normalizeEscalation ignores anything that is not a list of steps', () => {
	assert.deepEqual(normalizeEscalation(null), []);
	assert.deepEqual(normalizeEscalation('ban'), []);
	assert.deepEqual(normalizeEscalation([null, 'x', 7]), []);
});

test('normalizeEscalation drops invalid steps, keeps the last step per warning count and sorts them', () => {
	const steps = normalizeEscalation([
		{ warns: 3, action: 'ban' },
		{ warns: 1, action: 'timeout', duration_seconds: 600 },
		{ warns: 2, action: 'timeout', duration_seconds: 30 },
		{ warns: 0, action: 'kick' },
		{ warns: 1.9, action: 'kick' },
		{ warns: 4, action: 'nope' }
	]);
	assert.deepEqual(steps, [
		{ warns: 1, action: 'kick', duration_seconds: null },
		{ warns: 3, action: 'ban', duration_seconds: null }
	]);
});

test('normalizeEscalation caps timed durations at what Discord and the panel allow', () => {
	assert.deepEqual(normalizeEscalation([{ warns: 2, action: 'timeout', duration_seconds: 99_999_999 }]), [
		{ warns: 2, action: 'timeout', duration_seconds: MAX_TIMEOUT_SECONDS }
	]);
	assert.deepEqual(normalizeEscalation([{ warns: 2, action: 'tempban', duration_seconds: 9_999_999_999 }]), [
		{ warns: 2, action: 'tempban', duration_seconds: 10 * 365 * 86400 }
	]);
	assert.deepEqual(normalizeEscalation([{ warns: 2, action: 'kick', duration_seconds: 600 }]), [{ warns: 2, action: 'kick', duration_seconds: null }]);
});

test('normalizeEscalation keeps at most the allowed number of steps', () => {
	const many = Array.from({ length: MAX_ESCALATION_STEPS + 5 }, (_, i) => ({ warns: i + 1, action: 'kick' }));
	const steps = normalizeEscalation(many);
	assert.equal(steps.length, MAX_ESCALATION_STEPS);
	assert.equal(steps[0].warns, 1);
	assert.equal(steps[steps.length - 1].warns, MAX_ESCALATION_STEPS);
});

test('normalizeReasonPresets trims, removes case-insensitive duplicates and limits length and count', () => {
	assert.deepEqual(normalizeReasonPresets([' Spam ', 'spam', '', null, 'x'.repeat(MAX_REASON_PRESET_LENGTH + 50)]), [
		'Spam',
		'x'.repeat(MAX_REASON_PRESET_LENGTH)
	]);
	assert.deepEqual(normalizeReasonPresets('Spam'), []);
	const many = Array.from({ length: MAX_REASON_PRESETS + 5 }, (_, i) => `reason ${i}`);
	assert.equal(normalizeReasonPresets(many).length, MAX_REASON_PRESETS);
});

test('moderationRulesFromSettings reads the three settings keys with safe defaults', () => {
	assert.deepEqual(moderationRulesFromSettings(null), { warn_expiry_days: 0, escalation: [], reason_presets: [] });
	const rules = moderationRulesFromSettings({
		moderation_warn_expiry_days: '30.7',
		moderation_escalation: [{ warns: 3, action: 'ban' }],
		moderation_reason_presets: ['Spam']
	});
	assert.deepEqual(rules, { warn_expiry_days: 30, escalation: [{ warns: 3, action: 'ban', duration_seconds: null }], reason_presets: ['Spam'] });
	assert.equal(moderationRulesFromSettings({ moderation_warn_expiry_days: 99_999 }).warn_expiry_days, MAX_WARN_EXPIRY_DAYS);
	assert.equal(moderationRulesFromSettings({ moderation_warn_expiry_days: -5 }).warn_expiry_days, 0);
	assert.equal(moderationRulesFromSettings({ moderation_warn_expiry_days: 'abc' }).warn_expiry_days, 0);
});

test('escalationStepFor matches the exact warning count only', () => {
	const rules = moderationRulesFromSettings({ moderation_escalation: [{ warns: 3, action: 'ban' }] });
	assert.deepEqual(escalationStepFor(rules, 3), { warns: 3, action: 'ban', duration_seconds: null });
	assert.equal(escalationStepFor(rules, 2), null);
	assert.equal(escalationStepFor(rules, 4), null);
});
