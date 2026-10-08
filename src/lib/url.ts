import { APP_DOMAIN, APP_URL } from './backend/panelServer.js';

export const COMMUNITY_DISCORD_URL = 'https://discord.gg/7fEqEDSur3';

export const OFFICIAL_BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

export const DISCORD_APP_DIRECTORY_URL = 'https://discord.com/discovery/applications/1446572985849876640';

export const MAINTAINER_DISCORD_ID = '473430221211697162';

export const SOURCE_REPO_URL = 'https://github.com/dansday-com/dansday-discord-bot';

export function publicSiteOrigin(): string {
	return APP_URL;
}

export function publicServerPath(slug: string): string {
	return `/server/${encodeURIComponent(slug)}`;
}

export function publicServerUrl(slug: string, page?: 'leaderboard' | 'members' | 'account'): string | null {
	if (!slug) return null;
	return publicSiteOrigin() + publicServerPath(slug) + (page ? `/${page}` : '');
}

const APP_PROTOCOL = APP_URL.startsWith('http://') ? 'http:' : 'https:';

const RESERVED_SUBDOMAIN_LABELS = new Set([
	'www',
	'api',
	'app',
	'admin',
	'panel',
	'dashboard',
	'mail',
	'email',
	'webmail',
	'smtp',
	'imap',
	'pop',
	'pop3',
	'mx',
	'autodiscover',
	'autoconfig',
	'ftp',
	'sftp',
	'ns',
	'ns1',
	'ns2',
	'dns',
	'cdn',
	'static',
	'assets',
	'media',
	'img',
	'images',
	's3',
	'storage',
	'files',
	'uploads',
	'docs',
	'doc',
	'blog',
	'status',
	'health',
	'metrics',
	'grafana',
	'otel',
	'dev',
	'staging',
	'stage',
	'test',
	'preview',
	'demo',
	'local',
	'localhost',
	'git',
	'ci',
	'vpn',
	'proxy',
	'redis',
	'db',
	'database'
]);

export function serverSlugToSubdomainLabel(slug: string): string {
	return String(slug ?? '').replace(/_/g, '-');
}

export function subdomainLabelToServerSlug(label: string): string {
	return String(label ?? '').replace(/-/g, '_');
}

function subdomainRootHost(): string {
	return APP_DOMAIN.toLowerCase().replace(/:\d+$/, '');
}

function punycodeDecode(input: string): string | null {
	const cut = input.lastIndexOf('-');
	const out = cut > 0 ? Array.from(input.slice(0, cut), (c) => c.charCodeAt(0)) : [];
	let n = 128;
	let bias = 72;
	let i = 0;
	for (let pos = cut > 0 ? cut + 1 : 0; pos < input.length; ) {
		const start = i;
		for (let w = 1, k = 36; ; k += 36) {
			if (pos >= input.length) return null;
			const c = input.charCodeAt(pos++);
			const digit = c >= 48 && c <= 57 ? c - 22 : c >= 97 && c <= 122 ? c - 97 : -1;
			if (digit < 0) return null;
			i += digit * w;
			const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
			if (digit < t) break;
			w *= 36 - t;
		}
		const len = out.length + 1;
		let delta = Math.floor((i - start) / (start === 0 ? 700 : 2));
		delta += Math.floor(delta / len);
		let k = 0;
		for (; delta > 455; k += 36) delta = Math.floor(delta / 35);
		bias = k + Math.floor((36 * delta) / (delta + 38));
		n += Math.floor(i / len);
		i %= len;
		if (n > 0x10ffff) return null;
		out.splice(i++, 0, n);
	}
	return String.fromCodePoint(...out);
}

export function publicServerSlugFromHost(hostname: string | null | undefined): string | null {
	const host = String(hostname ?? '')
		.trim()
		.toLowerCase()
		.replace(/\.$/, '')
		.replace(/:\d+$/, '');
	const root = subdomainRootHost();
	if (!host || !root || !host.endsWith(`.${root}`)) return null;
	const label = host.slice(0, -(root.length + 1));
	if (!label || label.includes('.')) return null;
	const decoded = label.startsWith('xn--') ? punycodeDecode(label.slice(4)) : label;
	if (!decoded || !/^[\p{L}\p{M}\p{Nd}]+(?:-[0-9]+)?$/u.test(decoded)) return null;
	if (RESERVED_SUBDOMAIN_LABELS.has(label)) return null;
	return subdomainLabelToServerSlug(decoded);
}

export function publicServerSubdomainOrigin(slug: string): string | null {
	const label = serverSlugToSubdomainLabel(slug);
	if (!label || !APP_DOMAIN) return null;
	try {
		const url = new URL(`${APP_PROTOCOL}//${label}.${APP_DOMAIN}`);
		if (url.hostname.split('.')[0].length > 63 || publicServerSlugFromHost(url.hostname) !== slug) return null;
		return url.origin;
	} catch {
		return null;
	}
}

export function publicServerSubdomainUrl(slug: string, page?: 'leaderboard' | 'members' | 'account'): string | null {
	const origin = publicServerSubdomainOrigin(slug);
	if (!origin) return null;
	return origin + (page ? `/${page}` : '');
}

export function apexHome(): string {
	return `${publicSiteOrigin()}/`;
}

const PUBLIC_SERVER_SUBPATHS = ['leaderboard', 'members', 'account'];

export function isPublicServerSubpath(pathname: string): boolean {
	const path = String(pathname ?? '').replace(/\/+$/, '');
	if (path === '') return true;
	return PUBLIC_SERVER_SUBPATHS.includes(path.slice(1).split('/')[0]);
}

export function apexLink(path: string, hostname?: string | null): string {
	if (hostname && publicServerSlugFromHost(hostname)) return publicSiteOrigin() + path;
	return path;
}

export function publicServerBasePath(slug: string, hostname?: string | null): string {
	if (hostname && publicServerSlugFromHost(hostname) === slug) return '';
	return publicServerPath(slug);
}
