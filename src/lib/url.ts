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
	if (!slug) {
		return null;
	}
	return publicSiteOrigin() + publicServerPath(slug) + (page ? `/${page}` : '');
}

const APP_PROTOCOL = APP_URL.startsWith('http://') ? 'http:' : 'https:';

const PUNYCODE_PREFIX = 'xn--';
const PUNYCODE_BASE = 36;
const PUNYCODE_TMIN = 1;
const PUNYCODE_TMAX = 26;
const PUNYCODE_SKEW = 38;
const PUNYCODE_DAMP = 700;
const PUNYCODE_INITIAL_N = 128;
const PUNYCODE_INITIAL_BIAS = 72;
const ALPHABET_LETTERS = 26;
const CHAR_CODE_DIGIT_0 = 48;
const CHAR_CODE_DIGIT_9 = 57;
const CHAR_CODE_LOWER_A = 97;
const CHAR_CODE_LOWER_Z = 122;
const MAX_CODE_POINT = 0x10ffff;
const DNS_LABEL_MAX_LENGTH = 63;

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
	let n = PUNYCODE_INITIAL_N;
	let bias = PUNYCODE_INITIAL_BIAS;
	let i = 0;
	for (let pos = cut > 0 ? cut + 1 : 0; pos < input.length;) {
		const start = i;
		for (let w = 1, k = PUNYCODE_BASE; ; k += PUNYCODE_BASE) {
			if (pos >= input.length) {
				return null;
			}
			const c = input.charCodeAt(pos++);
			const digit =
				c >= CHAR_CODE_DIGIT_0 && c <= CHAR_CODE_DIGIT_9
					? c - CHAR_CODE_DIGIT_0 + ALPHABET_LETTERS
					: c >= CHAR_CODE_LOWER_A && c <= CHAR_CODE_LOWER_Z
						? c - CHAR_CODE_LOWER_A
						: -1;
			if (digit < 0) {
				return null;
			}
			i += digit * w;
			const t = k <= bias ? PUNYCODE_TMIN : k >= bias + PUNYCODE_TMAX ? PUNYCODE_TMAX : k - bias;
			if (digit < t) {
				break;
			}
			w *= PUNYCODE_BASE - t;
		}
		const len = out.length + 1;
		let delta = Math.floor((i - start) / (start === 0 ? PUNYCODE_DAMP : 2));
		delta += Math.floor(delta / len);
		let k = 0;
		for (; delta > ((PUNYCODE_BASE - PUNYCODE_TMIN) * PUNYCODE_TMAX) / 2; k += PUNYCODE_BASE) {
			delta = Math.floor(delta / (PUNYCODE_BASE - PUNYCODE_TMIN));
		}
		bias = k + Math.floor((PUNYCODE_BASE * delta) / (delta + PUNYCODE_SKEW));
		n += Math.floor(i / len);
		i %= len;
		if (n > MAX_CODE_POINT) {
			return null;
		}
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
	if (!host || !root || !host.endsWith(`.${root}`)) {
		return null;
	}
	const label = host.slice(0, -(root.length + 1));
	if (!label || label.includes('.')) {
		return null;
	}
	const decoded = label.startsWith(PUNYCODE_PREFIX) ? punycodeDecode(label.slice(PUNYCODE_PREFIX.length)) : label;
	if (!decoded || !/^[\p{L}\p{M}\p{Nd}]+(?:-[0-9]+)?$/u.test(decoded)) {
		return null;
	}
	if (RESERVED_SUBDOMAIN_LABELS.has(label)) {
		return null;
	}
	return subdomainLabelToServerSlug(decoded);
}

export function publicServerSubdomainOrigin(slug: string): string | null {
	const label = serverSlugToSubdomainLabel(slug);
	if (!label || !APP_DOMAIN) {
		return null;
	}
	try {
		const url = new URL(`${APP_PROTOCOL}//${label}.${APP_DOMAIN}`);
		if (url.hostname.split('.')[0].length > DNS_LABEL_MAX_LENGTH || publicServerSlugFromHost(url.hostname) !== slug) {
			return null;
		}
		return url.origin;
	} catch {
		return null;
	}
}

export function publicServerSubdomainUrl(slug: string, page?: 'leaderboard' | 'members' | 'account'): string | null {
	const origin = publicServerSubdomainOrigin(slug);
	if (!origin) {
		return null;
	}
	return origin + (page ? `/${page}` : '');
}

export function apexHome(): string {
	return `${publicSiteOrigin()}/`;
}

const PUBLIC_SERVER_SUBPATHS = ['leaderboard', 'members', 'account'];

export function isPublicServerSubpath(pathname: string): boolean {
	const path = String(pathname ?? '').replace(/\/+$/, '');
	if (path === '') {
		return true;
	}
	return PUBLIC_SERVER_SUBPATHS.includes(path.slice(1).split('/')[0]);
}

export function apexLink(path: string, hostname?: string | null): string {
	if (hostname && publicServerSlugFromHost(hostname)) {
		return publicSiteOrigin() + path;
	}
	return path;
}

export function publicServerBasePath(slug: string, hostname?: string | null): string {
	if (hostname && publicServerSlugFromHost(hostname) === slug) {
		return '';
	}
	return publicServerPath(slug);
}
