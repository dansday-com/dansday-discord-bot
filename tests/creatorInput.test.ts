import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creatorRefKey, parseCreatorInput } from '../src/lib/backend/api/creator-alerts-api.ts';
import { resolveToolUrl } from '../src/lib/backend/bots/official-bot/components/aiToolHttp.ts';
import { fail, formatMs, nameOfMember, num, safeConfig } from '../src/lib/backend/bots/official-bot/components/aiToolShared.ts';

test('YouTube links are accepted by handle or channel id', () => {
	assert.deepEqual(parseCreatorInput('https://www.youtube.com/@dansday'), { platform: 'youtube', handle: '@dansday' });
	assert.deepEqual(parseCreatorInput('youtube.com/@dansday/videos'), { platform: 'youtube', handle: '@dansday' });
	assert.deepEqual(parseCreatorInput('https://m.youtube.com/channel/UC1234567890abcdefghijkl'), { platform: 'youtube', handle: 'UC1234567890abcdefghijkl' });
	assert.equal(parseCreatorInput('https://www.youtube.com/watch?v=abc'), null);
	assert.equal(parseCreatorInput('https://www.youtube.com/channel/not-a-channel-id'), null);
});

test('Twitch links are accepted by login, lowercased', () => {
	assert.deepEqual(parseCreatorInput('https://www.twitch.tv/DansDay'), { platform: 'twitch', handle: 'dansday' });
	assert.deepEqual(parseCreatorInput('twitch.tv/dans_day/videos'), { platform: 'twitch', handle: 'dans_day' });
	assert.equal(parseCreatorInput('https://www.twitch.tv/ab'), null);
	assert.equal(parseCreatorInput('https://www.twitch.tv/'), null);
});

test('TikTok links are accepted by handle without the at sign', () => {
	assert.deepEqual(parseCreatorInput('https://www.tiktok.com/@dansday'), { platform: 'tiktok', handle: 'dansday' });
	assert.deepEqual(parseCreatorInput('  tiktok.com/@dans.day/live  '), { platform: 'tiktok', handle: 'dans.day' });
	assert.equal(parseCreatorInput('https://www.tiktok.com/@'), null);
	assert.equal(parseCreatorInput('https://www.tiktok.com/dansday'), null);
});

test('anything that is not a supported creator link is rejected', () => {
	assert.equal(parseCreatorInput(''), null);
	assert.equal(parseCreatorInput('   '), null);
	assert.equal(parseCreatorInput('dansday'), null);
	assert.equal(parseCreatorInput('https://example.com/@dansday'), null);
	assert.equal(parseCreatorInput('https://youtube.com.evil.example/@dansday'), null);
});

test('creatorRefKey joins the platform and the account id', () => {
	assert.equal(creatorRefKey({ platform: 'twitch', accountId: '12345' }), 'twitch:12345');
});

test('resolveToolUrl appends the path once and tolerates trailing slashes', () => {
	assert.equal(resolveToolUrl('https://api.example/v1', '/search'), 'https://api.example/v1/search');
	assert.equal(resolveToolUrl('https://api.example/v1///', '/search'), 'https://api.example/v1/search');
	assert.equal(resolveToolUrl('https://api.example/v1/search', '/search'), 'https://api.example/v1/search');
	assert.equal(resolveToolUrl('', '/search'), '');
	assert.equal(resolveToolUrl('   ', '/search'), '');
});

test('assistant tool helpers never throw on odd input', () => {
	assert.deepEqual(fail('not_found'), { ok: false, reason: 'not_found' });
	assert.deepEqual(fail('not_found', { hint: 'try again' }), { ok: false, reason: 'not_found', hint: 'try again' });
	assert.equal(num(5), 5);
	assert.equal(num(null), 0);
	assert.equal(num(Number.NaN), 0);
	assert.equal(formatMs(90 * 60_000), '1h 30m');
	assert.equal(formatMs(-5), '0m');
	assert.deepEqual(safeConfig('{"a":1}'), { a: 1 });
	assert.deepEqual(safeConfig('not json'), {});
	assert.deepEqual(safeConfig(''), {});
});

test('nameOfMember prefers the server nickname and always returns something', () => {
	assert.equal(nameOfMember({ server_display_name: 'Nick', display_name: 'Global', username: 'user' }), 'Nick');
	assert.equal(nameOfMember({ server_display_name: '', display_name: 'Global', username: 'user' }), 'Global');
	assert.equal(nameOfMember({ username: 'user' }), 'user');
	assert.equal(nameOfMember(null), 'a member');
});
