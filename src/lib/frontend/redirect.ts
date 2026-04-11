export const DASHBOARD_PATH = '/dashboard' as const;

export function parentPathname(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	if (p === '/') return '/';
	const i = p.lastIndexOf('/');
	const out = i <= 0 ? '/' : p.slice(0, i);
	if (out === '/bots') return '/';
	return out;
}

export function webRouteUp(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	let up = parentPathname(p);
	if (/\/bots\/[^/]+\/servers$/.test(up)) {
		up = parentPathname(up);
	}
	return up;
}

export function exitConfigToGuildOverview(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	const m = p.match(/^(\/bots\/[^/]+\/servers\/[^/]+)\/config(?:\/|$)/);
	return m ? m[1] : webRouteUp(p);
}

export function webBotHome(pathname: string): string {
	const m = pathname.match(/^\/bots\/([^/]+)/);
	if (m) return `/bots/${m[1]}`;
	return webRouteUp(pathname);
}
