/** Helpers for safe redirects inside the SvelteKit **web dashboard** (`src/routes/(app)/…`). */

/** Drop the last path segment. `/a/b/c` → `/a/b`. `/bots/3` → `/` (no bare `/bots` route). */
export function parentPathname(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	if (p === '/') return '/';
	const i = p.lastIndexOf('/');
	const out = i <= 0 ? '/' : p.slice(0, i);
	if (out === '/bots') return '/';
	return out;
}

/**
 * One directory up in the dashboard URL. If that would be `/bots/:id/servers` (invalid),
 * go up again to `/bots/:id`.
 */
export function webRouteUp(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	let up = parentPathname(p);
	if (/\/bots\/[^/]+\/servers$/.test(up)) {
		up = parentPathname(up);
	}
	return up;
}

/** Leave `/config` and subpaths; land on `/bots/:id/servers/:guildId`. */
export function exitConfigToGuildOverview(pathname: string): string {
	const p = pathname.replace(/\/+$/, '') || '/';
	const m = p.match(/^(\/bots\/[^/]+\/servers\/[^/]+)\/config(?:\/|$)/);
	return m ? m[1] : webRouteUp(p);
}

/** From any `/bots/:botId/…` URL, jump to that bot’s dashboard (above `servers/`). */
export function webBotHome(pathname: string): string {
	const m = pathname.match(/^\/bots\/([^/]+)/);
	if (m) return `/bots/${m[1]}`;
	return webRouteUp(pathname);
}
