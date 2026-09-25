import { APP_DOMAIN, APP_URL } from './frontend/panelServer.js';

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
	if (!/^[a-z0-9]+(?:-[0-9]+)?$/.test(label)) return null;
	if (RESERVED_SUBDOMAIN_LABELS.has(label)) return null;
	return subdomainLabelToServerSlug(label);
}

export function publicServerSubdomainOrigin(slug: string): string | null {
	const label = serverSlugToSubdomainLabel(slug);
	if (!label || !APP_DOMAIN) return null;
	return `${APP_PROTOCOL}//${label}.${APP_DOMAIN}`;
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
