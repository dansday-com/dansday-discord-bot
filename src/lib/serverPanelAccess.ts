import db from '$lib/database.js';

// ─── Core permission helpers ───────────────────────────────────────────────

function getPanelId(locals: App.Locals): number | null {
	if (!locals.user.authenticated) return null;
	if (locals.user.account_source === 'accounts') return locals.user.panel_id ?? null;
	return null;
}

export async function accountOwnsServer(locals: App.Locals, serverId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'server_accounts') return locals.user.server_id === serverId;
	const panelId = getPanelId(locals);
	if (panelId == null) return false;
	const serverPanelId = await db.getServerPanelId(serverId);
	return serverPanelId === panelId;
}

export async function accountOwnsBot(locals: App.Locals, botId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'server_accounts') return false; // server_accounts never own panel bots
	const panelId = getPanelId(locals);
	if (panelId == null) return false;
	const botPanelId = await db.getBotPanelId(botId);
	return botPanelId === panelId;
}

// ─── Named permission levels ───────────────────────────────────────────────
// superadmin  = accounts only (panel owner)
// owner       = server_accounts with account_type 'owner', or superadmin
// member      = any authenticated user scoped to the correct server
// embed       = owner + moderator (server_accounts), or superadmin
// selfbot_view = any server_accounts on own server, or superadmin
// selfbot_manage = owner (server_accounts) on own server, or superadmin

export async function canEditServerSettings(locals: App.Locals, serverId: string | number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return accountOwnsServer(locals, Number(serverId));
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}

export async function canUseEmbedBuilder(locals: App.Locals, serverId: string | number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return accountOwnsServer(locals, Number(serverId));
	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== Number(serverId)) return false;
		return locals.user.account_type === 'owner' || locals.user.account_type === 'moderator';
	}
	return false;
}

export async function canViewSelfbots(locals: App.Locals, serverId: string | number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return accountOwnsServer(locals, Number(serverId));
	if (locals.user.account_source === 'server_accounts') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}

export async function canManageSelfbots(locals: App.Locals, serverId: string | number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return accountOwnsServer(locals, Number(serverId));
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}

export function isGuildModeratorUser(user: App.Locals['user']): boolean {
	return user.authenticated && user.account_source === 'server_accounts' && user.account_type === 'moderator';
}

export function isServerConfigReadOnly(locals: App.Locals): boolean {
	return isGuildModeratorUser(locals.user);
}

// ─── Route guard table ────────────────────────────────────────────────────
// One place. Each entry declares which API paths require which permission.
// Patterns use :botId, :serverId as named segments.
// Checked in order — first match wins.

type RouteGuard = {
	pattern: RegExp;
	// extract IDs from the URL match groups
	check: (locals: App.Locals, match: RegExpMatchArray) => Promise<boolean>;
	// superadmin-only routes additionally require account_source === 'accounts'
	superadminOnly?: boolean;
};

const ROUTE_GUARDS: RouteGuard[] = [
	// Public / auth routes — no guard needed (skip them early in guardApiRoute)

	// Bot-scoped API routes
	{
		pattern: /^\/api\/bots\/(\d+)(\/.*)?$/,
		check: async (locals, match) => accountOwnsBot(locals, Number(match[1])),
		superadminOnly: true
	},

	// Server-scoped: categories, channels, roles, overview, members, settings, selfbot, embed
	{
		pattern: /^\/api\/servers\/(\d+)\/categories/,
		check: async (locals, match) => {
			const id = Number(match[1]);
			if (!locals.user.authenticated) return false;
			return locals.user.account_source === 'accounts'
				? accountOwnsServer(locals, id)
				: locals.user.account_source === 'server_accounts' && locals.user.server_id === id;
		}
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/channels/,
		check: async (locals, match) => {
			const id = Number(match[1]);
			if (!locals.user.authenticated) return false;
			return locals.user.account_source === 'accounts'
				? accountOwnsServer(locals, id)
				: locals.user.account_source === 'server_accounts' && locals.user.server_id === id;
		}
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/roles/,
		check: async (locals, match) => {
			const id = Number(match[1]);
			if (!locals.user.authenticated) return false;
			return locals.user.account_source === 'accounts'
				? accountOwnsServer(locals, id)
				: locals.user.account_source === 'server_accounts' && locals.user.server_id === id;
		}
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/overview/,
		check: async (locals, match) => accountOwnsServer(locals, Number(match[1]))
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/members/,
		check: async (locals, match) => {
			const id = Number(match[1]);
			if (!locals.user.authenticated) return false;
			return locals.user.account_source === 'accounts'
				? accountOwnsServer(locals, id)
				: locals.user.account_source === 'server_accounts' && locals.user.server_id === id;
		}
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/settings/,
		check: async (locals, match) => canEditServerSettings(locals, match[1])
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/quest-notifier/,
		check: async (locals, match) => canEditServerSettings(locals, match[1])
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/selfbot/,
		check: async (locals, match) => canViewSelfbots(locals, match[1])
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/(send-embed|upload-embed-image|delete-embed-image)/,
		check: async (locals, match) => canUseEmbedBuilder(locals, match[1])
	},
	{
		pattern: /^\/api\/servers\/(\d+)\/accounts/,
		check: async (locals, match) => {
			const id = Number(match[1]);
			if (!locals.user.authenticated) return false;
			return locals.user.account_source === 'accounts'
				? accountOwnsServer(locals, id)
				: locals.user.account_source === 'server_accounts' && locals.user.server_id === id;
		}
	},

	// start / stop / restart — body-based bot_id, can't pattern match here, handled in route
	// leaderboards — public, no guard
	// uploads/embed-images/[filename] — public static serving
	// panel/* — auth routes, no guard
];

// Routes that are fully public — skip guard entirely
const PUBLIC_PREFIXES = [
	'/api/leaderboards/',
	'/api/uploads/',
	'/api/panel/',
	'/api/start',   // body-based check inside route
	'/api/stop',    // body-based check inside route
	'/api/restart', // body-based check inside route
	'/api/bots/+server.ts' // handled via superadminOnly in bot pattern but POST creates bot
];

const PUBLIC_EXACT = new Set(['/api/panel/login', '/api/panel/register', '/api/panel/verify-otp', '/api/panel/resend-otp', '/api/panel/logout', '/api/panel/auth', '/api/panel/invite-link', '/api/panel/register-with-token', '/api/panel/demo-login']);

/**
 * Call this in hooks.server.ts BEFORE resolve().
 * Returns a 401/403 Response if access is denied, or null to continue.
 */
export async function guardApiRoute(locals: App.Locals, pathname: string): Promise<Response | null> {
	// Only guard /api/ routes
	if (!pathname.startsWith('/api/')) return null;

	// Skip public routes
	if (PUBLIC_EXACT.has(pathname)) return null;
	for (const prefix of PUBLIC_PREFIXES) {
		if (pathname.startsWith(prefix)) return null;
	}

	// Must be authenticated for all non-public API routes
	if (!locals.user.authenticated) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	// Find matching guard
	for (const guard of ROUTE_GUARDS) {
		const match = pathname.match(guard.pattern);
		if (!match) continue;

		if (guard.superadminOnly && locals.user.account_source !== 'accounts') {
			return new Response(JSON.stringify({ error: 'Access denied' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const allowed = await guard.check(locals, match);
		if (!allowed) {
			return new Response(JSON.stringify({ error: 'Access denied' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return null; // allowed
	}

	// No guard matched — allow through (unguarded route, handled by route itself)
	return null;
}
