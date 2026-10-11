import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	applyMessagePlaceholders,
	isSelfAssignableRole,
	messageCustomId,
	messageDocProblems,
	messageSummary,
	messageUploadLimit,
	newMessageDoc,
	normalizeMessageDoc,
	parseMessageCustomId,
	parseMessageEmoji,
	pickText
} from '../src/lib/messages.ts';

const MB = 1024 * 1024;

test('a role is self-assignable only when it grants no moderation or management permission', () => {
	assert.equal(isSelfAssignableRole('0'), true);
	assert.equal(isSelfAssignableRole(null), true);
	assert.equal(isSelfAssignableRole('2048'), true);
	assert.equal(isSelfAssignableRole('8'), false);
	assert.equal(isSelfAssignableRole(String(1n << 28n)), false);
	assert.equal(isSelfAssignableRole(String((1n << 28n) | 2048n)), false);
	assert.equal(isSelfAssignableRole(String(1n << 40n)), false);
});

test('a permission value that cannot be read is treated as unsafe', () => {
	assert.equal(isSelfAssignableRole('abc'), false);
	assert.equal(isSelfAssignableRole({}), false);
});

test('messageUploadLimit follows the server boost level', () => {
	assert.equal(messageUploadLimit(0), 20 * MB);
	assert.equal(messageUploadLimit(1), 20 * MB);
	assert.equal(messageUploadLimit(2), 50 * MB);
	assert.equal(messageUploadLimit(3), 100 * MB);
	assert.equal(messageUploadLimit('x'), 20 * MB);
});

test('pickText prefers the requested language and falls back to the base language', () => {
	assert.equal(pickText({ en: 'Hello', id: 'Halo' }, 'id', 'en'), 'Halo');
	assert.equal(pickText({ en: 'Hello', id: '  ' }, 'id', 'en'), 'Hello');
	assert.equal(pickText({ en: 'Hello' }, 'id', 'en'), 'Hello');
	assert.equal(pickText(undefined, 'id', 'en'), '');
});

test('applyMessagePlaceholders fills in the server name and the current year', () => {
	assert.equal(applyMessagePlaceholders('Hi {server} {server}', 'Dansday'), 'Hi Dansday Dansday');
	assert.equal(applyMessagePlaceholders('© {year}', 'Dansday'), `© ${new Date().getFullYear()}`);
	assert.equal(applyMessagePlaceholders('no tokens', 'Dansday'), 'no tokens');
});

test('parseMessageEmoji accepts custom and unicode emoji and rejects plain text', () => {
	assert.deepEqual(parseMessageEmoji('<:wave:123456789012345678>'), { id: '123456789012345678', name: 'wave', animated: false });
	assert.deepEqual(parseMessageEmoji('<a:spin:123456789012345678>'), { id: '123456789012345678', name: 'spin', animated: true });
	assert.deepEqual(parseMessageEmoji('😀'), { name: '😀' });
	assert.equal(parseMessageEmoji('abc'), null);
	assert.equal(parseMessageEmoji(''), null);
});

test('a component custom id survives a round trip', () => {
	const plain = messageCustomId('server', 12, 'abc123', 'en');
	assert.deepEqual(parseMessageCustomId(plain), { scope: 'server', messageId: 12, partId: 'abc123', lang: 'en', pinned: false, post: null });
	const pinned = messageCustomId('global', 3, 'part9', 'en', true, 7);
	assert.deepEqual(parseMessageCustomId(pinned), { scope: 'global', messageId: 3, partId: 'part9', lang: 'en', pinned: true, post: 7 });
});

test('parseMessageCustomId rejects ids that are not from the message builder', () => {
	assert.equal(parseMessageCustomId(null), null);
	assert.equal(parseMessageCustomId('x|1|a|en'), null);
	assert.equal(parseMessageCustomId('menu_cat|leveling'), null);
	assert.equal(parseMessageCustomId(messageCustomId('server', 0, 'a', 'en')), null);
	assert.equal(parseMessageCustomId(messageCustomId('server', 1, '', 'en')), null);
});

test('a new message document is already in normal form and anything unreadable becomes an empty one', () => {
	const doc = newMessageDoc('en');
	assert.deepEqual(normalizeMessageDoc(doc), doc);
	assert.deepEqual(normalizeMessageDoc('junk'), normalizeMessageDoc(null));
	assert.deepEqual(normalizeMessageDoc(JSON.parse(JSON.stringify(normalizeMessageDoc(doc)))), normalizeMessageDoc(doc));
});

test('an empty message is reported and a message with text is not', () => {
	const empty = newMessageDoc('en');
	assert.deepEqual(messageDocProblems(empty), ['Write something, or press + to add an embed, a photo or buttons.']);
	const written = normalizeMessageDoc({ ...empty, text: { en: 'Hello' } });
	assert.deepEqual(messageDocProblems(written), []);
	assert.equal(messageSummary(written), 'Hello');
});
