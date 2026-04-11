/**
 * Panel server: configurable components (`SERVER_SETTINGS`) and authorization / API guards.
 * Database is loaded lazily so `$lib/database` can import `SERVER_SETTINGS` without a circular dependency.
 */

const REGISTRY = [
	{ id: 'main', label: 'Main', featureSwitch: false, hrefSuffix: '', icon: 'fa-gear', iconClass: 'text-emerald-400' },
	{
		id: 'permissions',
		label: 'Permissions',
		featureSwitch: false,
		hrefSuffix: '/permissions',
		icon: 'fa-shield-halved',
		iconClass: 'text-blue-400'
	},
	{
		id: 'welcomer',
		label: 'Welcomer',
		featureSwitch: true,
		hrefSuffix: '/welcomer',
		icon: 'fa-hand',
		iconClass: 'text-sky-400'
	},
	{
		id: 'booster',
		label: 'Booster',
		featureSwitch: true,
		hrefSuffix: '/booster',
		icon: 'fa-gem',
		iconClass: 'text-purple-400'
	},
	{
		id: 'notifications',
		label: 'Channel notification',
		featureSwitch: true,
		hrefSuffix: '/notifications',
		icon: 'fa-bell',
		iconClass: 'text-rose-400'
	},
	{
		id: 'forwarder',
		label: 'Forwarder',
		featureSwitch: true,
		hrefSuffix: '/forwarder',
		icon: 'fa-forward',
		iconClass: 'text-violet-400'
	},
	{
		id: 'leveling',
		label: 'Leveling',
		featureSwitch: true,
		hrefSuffix: '/leveling',
		icon: 'fa-chart-line',
		iconClass: 'text-lime-400'
	},
	{
		id: 'custom_supporter_role',
		label: 'Custom Supporter Role',
		featureSwitch: true,
		hrefSuffix: '/custom-supporter-role',
		icon: 'fa-star',
		iconClass: 'text-yellow-400'
	},
	{
		id: 'giveaway',
		label: 'Giveaway',
		featureSwitch: true,
		hrefSuffix: '/giveaway',
		icon: 'fa-gift',
		iconClass: 'text-pink-400'
	},
	{
		id: 'afk',
		label: 'AFK',
		featureSwitch: true,
		hrefSuffix: '/afk',
		icon: 'fa-moon',
		iconClass: 'text-indigo-400'
	},
	{
		id: 'feedback',
		label: 'Feedback',
		featureSwitch: true,
		hrefSuffix: '/feedback',
		icon: 'fa-comment-dots',
		iconClass: 'text-cyan-400'
	},
	{
		id: 'moderation',
		label: 'Moderation',
		featureSwitch: true,
		hrefSuffix: '/moderation',
		icon: 'fa-gavel',
		iconClass: 'text-red-400'
	},
	{
		id: 'staff_rating',
		label: 'Staff Rating',
		featureSwitch: true,
		hrefSuffix: '/staff-rating',
		icon: 'fa-clipboard-check',
		iconClass: 'text-orange-400'
	},
	{
		id: 'content_creator',
		label: 'Content Creator',
		featureSwitch: true,
		hrefSuffix: '/content-creator',
		icon: 'fa-video',
		iconClass: 'text-pink-400'
	},
	{
		id: 'discord_quest_notifier',
		label: 'Discord Quest',
		featureSwitch: true,
		hrefSuffix: '/discord-quest-notifier',
		icon: 'fa-gem',
		iconClass: 'text-sky-400'
	},
	{
		id: 'roblox_catalog_notifier',
		label: 'Roblox Catalog',
		featureSwitch: true,
		hrefSuffix: '/roblox-catalog-notifier',
		icon: 'fa-cube',
		iconClass: 'text-emerald-400'
	},
	{
		id: 'public_statistics',
		label: 'Public statistics',
		featureSwitch: true,
		hrefSuffix: '/public-statistics',
		icon: 'fa-chart-pie',
		iconClass: 'text-amber-400'
	}
] as const;

type RegistryId = (typeof REGISTRY)[number]['id'];

const component = Object.fromEntries(REGISTRY.map((e) => [e.id, e.id])) as {
	[K in RegistryId]: K;
};

const withFeatureSwitch = REGISTRY.filter((e) => e.featureSwitch).map((e) => e.id) as RegistryId[];

const configNavTabs: {
	label: string;
	icon: string;
	iconClass: string;
	href: string;
	featureComponent: RegistryId | null;
}[] = REGISTRY.map((e) => ({
	label: e.label,
	icon: e.icon,
	iconClass: e.iconClass,
	href: e.hrefSuffix,
	featureComponent: e.featureSwitch ? e.id : null
}));

function featureLabel(componentId: string): string {
	return REGISTRY.find((e) => e.id === componentId)?.label ?? componentId;
}

export const SERVER_SETTINGS = {
	component,
	withFeatureSwitch,
	configNavTabs,
	featureLabel
};

export type ServerSettingsComponentName = keyof typeof SERVER_SETTINGS.component;

/* Lazy DB — avoids circular import when database.ts imports SERVER_SETTINGS from this file */
let dbCache: (typeof import('$lib/database.js'))['default'] | null = null;
async function getDb() {
	if (!dbCache) dbCache = (await import('$lib/database.js')).default;
	return dbCache;
}

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
	const db = await getDb();
	const serverPanelId = await db.getServerPanelId(serverId);
	return serverPanelId === panelId;
}

export async function accountOwnsBot(locals: App.Locals, botId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'server_accounts') return false;
	const panelId = getPanelId(locals);
	if (panelId == null) return false;
	const db = await getDb();
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
		pattern: /^\/api\/bots\/(\d+)\/servers(\/.*)?$/,
		check: async () => true
	},
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
