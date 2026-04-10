import db from '$lib/database.js';

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
	if (locals.user.account_source === 'server_accounts') return false;
	const panelId = getPanelId(locals);
	if (panelId == null) return false;
	const botPanelId = await db.getBotPanelId(botId);
	return botPanelId === panelId;
}

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
		return locals.user.account_type === 'owner' || locals.user.account_type === 'staff';
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

export function isGuildStaffUser(user: App.Locals['user']): boolean {
	return user.authenticated && user.account_source === 'server_accounts' && user.account_type === 'staff';
}

export function isServerConfigReadOnly(locals: App.Locals): boolean {
	return isGuildStaffUser(locals.user);
}

type RouteGuard = {
	pattern: RegExp;
	check: (locals: App.Locals, match: RegExpMatchArray) => Promise<boolean>;
	superadminOnly?: boolean;
};

const ROUTE_GUARDS: RouteGuard[] = [
	{
		pattern: /^\/api\/bots\/(\d+)(\/.*)?$/,
		check: async (locals, match) => accountOwnsBot(locals, Number(match[1])),
		superadminOnly: true
	},

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
	}
];

const PUBLIC_PREFIXES = ['/api/leaderboards/', '/api/uploads/', '/api/panel/', '/api/start', '/api/stop', '/api/restart', '/api/bots/+server.ts'];

const PUBLIC_EXACT = new Set([
	'/api/panel/login',
	'/api/panel/register',
	'/api/panel/verify-otp',
	'/api/panel/resend-otp',
	'/api/panel/logout',
	'/api/panel/auth',
	'/api/panel/invite-link',
	'/api/panel/register-with-token',
	'/api/panel/demo-login'
]);

export async function guardApiRoute(locals: App.Locals, pathname: string): Promise<Response | null> {
	if (!pathname.startsWith('/api/')) return null;

	if (PUBLIC_EXACT.has(pathname)) return null;
	for (const prefix of PUBLIC_PREFIXES) {
		if (pathname.startsWith(prefix)) return null;
	}

	if (!locals.user.authenticated) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

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

		return null;
	}

	return null;
}
