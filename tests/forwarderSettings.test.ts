import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwarderKeywordHaystack, forwarderKeywordsMatch, normalizeForwarderKeywords, normalizeForwarderSettings } from '../src/lib/forwarder-settings.ts';

test('normalizeForwarderSettings falls back to an empty list', () => {
	assert.deepEqual(normalizeForwarderSettings(null), { forwarders: [] });
	assert.deepEqual(normalizeForwarderSettings('nope'), { forwarders: [] });
	assert.deepEqual(normalizeForwarderSettings({ forwarders: 'nope' }), { forwarders: [] });
});

test('normalizeForwarderSettings keeps the list and a boolean enabled flag', () => {
	assert.deepEqual(normalizeForwarderSettings({ forwarders: [1, 2] }), { forwarders: [1, 2] });
	assert.deepEqual(normalizeForwarderSettings({ forwarders: [1], enabled: false }), { forwarders: [1], enabled: false });
	assert.deepEqual(normalizeForwarderSettings({ forwarders: [], enabled: 'yes' }), { forwarders: [] });
});

test('normalizeForwarderKeywords trims, drops blanks and removes case-insensitive duplicates', () => {
	assert.deepEqual(normalizeForwarderKeywords([' Foo ', 'foo', '', null, undefined, 'Bar', 42]), ['Foo', 'Bar', '42']);
	assert.deepEqual(normalizeForwarderKeywords('foo'), []);
	assert.deepEqual(normalizeForwarderKeywords(undefined), []);
});

test('forwarderKeywordHaystack gathers every text part of a message in lower case', () => {
	const embeds = [
		{ title: 'Title', description: 'Body', author: { name: 'Author' }, footer: { text: 'Footer' }, fields: [{ name: 'Name', value: 'Value' }] },
		null,
		'skip'
	];
	assert.equal(forwarderKeywordHaystack('Hello', embeds), 'hello\ntitle\nbody\nauthor\nfooter\nname\nvalue');
	assert.equal(forwarderKeywordHaystack('', []), '');
	assert.equal(forwarderKeywordHaystack(null, null), '');
});

test('forwarderKeywordsMatch passes everything when no keywords are set', () => {
	assert.equal(forwarderKeywordsMatch([], ''), true);
	assert.equal(forwarderKeywordsMatch(null, 'anything'), true);
});

test('forwarderKeywordsMatch needs one keyword to appear in the haystack', () => {
	assert.equal(forwarderKeywordsMatch(['HeLLo'], 'say hello'), true);
	assert.equal(forwarderKeywordsMatch(['bye', 'hello'], 'say hello'), true);
	assert.equal(forwarderKeywordsMatch(['bye'], 'say hello'), false);
	assert.equal(forwarderKeywordsMatch(['hello'], ''), false);
});
