import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	apexHome,
	apexLink,
	isPublicServerSubpath,
	publicServerBasePath,
	publicServerPath,
	publicServerSlugFromHost,
	publicServerSubdomainOrigin,
	publicServerSubdomainUrl,
	publicServerUrl,
	publicSiteOrigin,
	serverSlugToSubdomainLabel,
	subdomainLabelToServerSlug
} from '../src/lib/url.ts';

test('public server links are built on the site origin', () => {
	assert.equal(publicSiteOrigin(), 'https://example.test');
	assert.equal(apexHome(), 'https://example.test/');
	assert.equal(publicServerPath('my server'), '/server/my%20server');
	assert.equal(publicServerUrl('abc'), 'https://example.test/server/abc');
	assert.equal(publicServerUrl('abc', 'leaderboard'), 'https://example.test/server/abc/leaderboard');
	assert.equal(publicServerUrl(''), null);
});

test('slugs use underscores and subdomain labels use dashes', () => {
	assert.equal(serverSlugToSubdomainLabel('server_1'), 'server-1');
	assert.equal(subdomainLabelToServerSlug('server-1'), 'server_1');
});

test('a server subdomain resolves to its slug', () => {
	assert.equal(publicServerSlugFromHost('dansday.example.test'), 'dansday');
	assert.equal(publicServerSlugFromHost('Dansday.Example.Test.'), 'dansday');
	assert.equal(publicServerSlugFromHost('dansday.example.test:3000'), 'dansday');
	assert.equal(publicServerSlugFromHost('server-1.example.test'), 'server_1');
	assert.equal(publicServerSlugFromHost('xn--bcher-kva.example.test'), 'bücher');
});

test('hosts that are not a server subdomain resolve to nothing', () => {
	assert.equal(publicServerSlugFromHost('example.test'), null);
	assert.equal(publicServerSlugFromHost('other.com'), null);
	assert.equal(publicServerSlugFromHost('dansday.other.com'), null);
	assert.equal(publicServerSlugFromHost('a.b.example.test'), null);
	assert.equal(publicServerSlugFromHost('my-server.example.test'), null);
	assert.equal(publicServerSlugFromHost('xn--!!!.example.test'), null);
	assert.equal(publicServerSlugFromHost(null), null);
	assert.equal(publicServerSlugFromHost(''), null);
});

test('reserved names are never treated as a server', () => {
	for (const label of ['www', 'api', 'admin', 'mail', 'cdn', 's3']) {
		assert.equal(publicServerSlugFromHost(`${label}.example.test`), null, label);
	}
	assert.equal(publicServerSubdomainOrigin('www'), null);
});

test('a subdomain origin is offered only when it resolves back to the same slug', () => {
	assert.equal(publicServerSubdomainOrigin('dansday'), 'https://dansday.example.test');
	assert.equal(publicServerSubdomainOrigin('server_1'), 'https://server-1.example.test');
	assert.equal(publicServerSubdomainOrigin('my_server'), null);
	assert.equal(publicServerSubdomainOrigin(''), null);
	assert.equal(publicServerSubdomainOrigin('a'.repeat(64)), null);
	assert.equal(publicServerSubdomainUrl('dansday', 'members'), 'https://dansday.example.test/members');
	assert.equal(publicServerSubdomainUrl('my_server', 'members'), null);
});

test('only the public server pages are served on a subdomain', () => {
	assert.equal(isPublicServerSubpath(''), true);
	assert.equal(isPublicServerSubpath('/'), true);
	assert.equal(isPublicServerSubpath('/leaderboard'), true);
	assert.equal(isPublicServerSubpath('/members/'), true);
	assert.equal(isPublicServerSubpath('/account/items/abc'), true);
	assert.equal(isPublicServerSubpath('/admin'), false);
	assert.equal(isPublicServerSubpath('/shop'), false);
});

test('links leave a server subdomain for the main site and stay relative elsewhere', () => {
	assert.equal(apexLink('/shop', 'dansday.example.test'), 'https://example.test/shop');
	assert.equal(apexLink('/shop', 'example.test'), '/shop');
	assert.equal(apexLink('/shop'), '/shop');
});

test('the server base path is empty on that server’s own subdomain', () => {
	assert.equal(publicServerBasePath('dansday', 'dansday.example.test'), '');
	assert.equal(publicServerBasePath('dansday', 'other.example.test'), '/server/dansday');
	assert.equal(publicServerBasePath('dansday', 'example.test'), '/server/dansday');
	assert.equal(publicServerBasePath('dansday'), '/server/dansday');
});
