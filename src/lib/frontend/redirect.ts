export const ADMIN_BASE = '/admin' as const;

export const DASHBOARD_PATH = `${ADMIN_BASE}/overview` as const;

const BOTS_ROOT = `${ADMIN_BASE}/bots` as const;

export const ADMIN_TAB_PATHS = {
	overview: DASHBOARD_PATH,
	bots: BOTS_ROOT,
	selfbots: `${ADMIN_BASE}/selfbots`,
	globalMessages: `${ADMIN_BASE}/global-messages`,
	items: `${ADMIN_BASE}/items`,
	settings: `${ADMIN_BASE}/settings`
} as const;

export function adminBotPath(botId: string | number): string {
	return `${BOTS_ROOT}/${botId}`;
}

export function adminServerPath(botId: string | number, serverId: string | number): string {
	return `${adminBotPath(botId)}/servers/${serverId}`;
}

export function adminServerSectionPath(botId: string | number, serverId: string | number, section: string): string {
	const suffix = section.replace(/^\/+/, '');
	return suffix ? `${adminServerPath(botId, serverId)}/${suffix}` : adminServerPath(botId, serverId);
}

const BOT_SECTION_RE = new RegExp(`^${BOTS_ROOT}/[^/]+(?:/(?:presence|ai|wikis))?/?$`);
const BOT_SERVERS_ROOT_RE = new RegExp(`^${BOTS_ROOT}/[^/]+/servers$`);

const BOT_ID_RE = new RegExp(`^${BOTS_ROOT}/([^/]+)`);

export function isBotSectionPath(pathname: string): boolean {
	return BOT_SECTION_RE.test(pathname);
}

export function parentPathname(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	if (p === '/') return '/';
	const i = p.lastIndexOf('/');
	const out = i <= 0 ? '/' : p.slice(0, i);
	if (out === BOTS_ROOT || out === ADMIN_BASE) return '/';
	return out;
}

export function webRouteUp(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	let up = parentPathname(p);
	if (BOT_SERVERS_ROOT_RE.test(up)) {
		up = parentPathname(up);
	}
	return up;
}

export function webBotHome(pathname: string): string {
	const m = pathname.match(BOT_ID_RE);
	if (m) return adminBotPath(m[1]);
	return webRouteUp(pathname);
}
