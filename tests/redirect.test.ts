import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	ADMIN_TAB_PATHS,
	DASHBOARD_PATH,
	adminBotPath,
	adminServerPath,
	adminServerSectionPath,
	isBotSectionPath,
	parentPathname,
	serverIdFromUrl,
	webBotHome,
	webRouteUp
} from '../src/lib/frontend/redirect.ts';

test('admin paths are built from the bot and server ids', () => {
	assert.equal(DASHBOARD_PATH, '/admin/overview');
	assert.equal(ADMIN_TAB_PATHS.bots, '/admin/bots');
	assert.equal(adminBotPath(5), '/admin/bots/5');
	assert.equal(adminServerPath(5, '9'), '/admin/bots/5/servers/9');
	assert.equal(adminServerSectionPath(5, 9, 'members'), '/admin/bots/5/servers/9/members');
	assert.equal(adminServerSectionPath(5, 9, '//members'), '/admin/bots/5/servers/9/members');
	assert.equal(adminServerSectionPath(5, 9, ''), '/admin/bots/5/servers/9');
});

test('isBotSectionPath matches only the bot home and its presence page', () => {
	assert.equal(isBotSectionPath('/admin/bots/5'), true);
	assert.equal(isBotSectionPath('/admin/bots/5/'), true);
	assert.equal(isBotSectionPath('/admin/bots/5/presence'), true);
	assert.equal(isBotSectionPath('/admin/bots/5/servers'), false);
	assert.equal(isBotSectionPath('/admin/bots'), false);
	assert.equal(isBotSectionPath('/admin/overview'), false);
});

test('parentPathname climbs one level and skips the bare admin and bots roots', () => {
	assert.equal(parentPathname('/'), '/');
	assert.equal(parentPathname('/a'), '/');
	assert.equal(parentPathname('/a/b/'), '/a');
	assert.equal(parentPathname('/admin/overview'), '/');
	assert.equal(parentPathname('/admin/bots/5'), '/');
	assert.equal(parentPathname('/admin/bots/5/servers/9'), '/admin/bots/5/servers');
});

test('webRouteUp never lands on the servers list of a bot', () => {
	assert.equal(webRouteUp('/admin/bots/5/servers/9'), '/admin/bots/5');
	assert.equal(webRouteUp('/admin/bots/5/servers/9/members'), '/admin/bots/5/servers/9');
	assert.equal(webRouteUp('/admin/bots/5/presence/'), '/admin/bots/5');
});

test('webBotHome returns the bot page when the path names a bot', () => {
	assert.equal(webBotHome('/admin/bots/5/servers/9/config'), '/admin/bots/5');
	assert.equal(webBotHome('/admin/bots/abc'), '/admin/bots/abc');
	assert.equal(webBotHome('/admin/overview'), '/');
});

test('serverIdFromUrl reads the server from admin and api paths, then the server_id query', () => {
	assert.equal(serverIdFromUrl(new URL('https://x.test/admin/bots/1/servers/42/members')), 42);
	assert.equal(serverIdFromUrl(new URL('https://x.test/admin/bots/1/servers/42')), 42);
	assert.equal(serverIdFromUrl(new URL('https://x.test/api/servers/7/settings')), 7);
	assert.equal(serverIdFromUrl(new URL('https://x.test/api/agent?server_id=9')), 9);
	assert.equal(serverIdFromUrl(new URL('https://x.test/admin/bots/1')), null);
	assert.equal(serverIdFromUrl(new URL('https://x.test/api/servers/abc')), null);
	assert.equal(serverIdFromUrl(new URL('https://x.test/api/agent?server_id=-3')), null);
});
