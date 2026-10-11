import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INVITE_SLUG_MAX, INVITE_SLUG_MIN, inviteJoinPath, isValidInviteSlug, normalizeInviteSlug } from '../src/lib/invites.ts';

test('normalizeInviteSlug lowercases, strips accents and joins words with single dashes', () => {
	assert.equal(normalizeInviteSlug('  Héllo   Wörld!! '), 'hello-world');
	assert.equal(normalizeInviteSlug('My_Cool.Server'), 'my-cool-server');
	assert.equal(normalizeInviteSlug('---a---b---'), 'a-b');
});

test('normalizeInviteSlug returns an empty string when nothing usable is left', () => {
	assert.equal(normalizeInviteSlug(null), '');
	assert.equal(normalizeInviteSlug(undefined), '');
	assert.equal(normalizeInviteSlug('!!!'), '');
});

test('normalizeInviteSlug cuts at the limit without leaving a trailing dash', () => {
	assert.equal(normalizeInviteSlug('a'.repeat(40)), 'a'.repeat(INVITE_SLUG_MAX));
	assert.equal(normalizeInviteSlug(`${'a'.repeat(INVITE_SLUG_MAX - 1)} b`), 'a'.repeat(INVITE_SLUG_MAX - 1));
});

test('isValidInviteSlug accepts lowercase words separated by single dashes within the length limits', () => {
	assert.equal(isValidInviteSlug('abc'), true);
	assert.equal(isValidInviteSlug('a-b'), true);
	assert.equal(isValidInviteSlug('team-42'), true);
	assert.equal(isValidInviteSlug('a'.repeat(INVITE_SLUG_MAX)), true);
	assert.equal(isValidInviteSlug('a'.repeat(INVITE_SLUG_MIN - 1)), false);
	assert.equal(isValidInviteSlug('a'.repeat(INVITE_SLUG_MAX + 1)), false);
	assert.equal(isValidInviteSlug('a--b'), false);
	assert.equal(isValidInviteSlug('-ab'), false);
	assert.equal(isValidInviteSlug('ab-'), false);
	assert.equal(isValidInviteSlug('ABC'), false);
});

test('whatever normalizeInviteSlug returns for a real name is a valid slug', () => {
	for (const name of ['Dansday Community', 'Über Gamers 2026', 'night_owls']) {
		assert.equal(isValidInviteSlug(normalizeInviteSlug(name)), true);
	}
});

test('inviteJoinPath encodes the slug', () => {
	assert.equal(inviteJoinPath('my-server'), '/join/my-server');
	assert.equal(inviteJoinPath('a b/c'), '/join/a%20b%2Fc');
});
