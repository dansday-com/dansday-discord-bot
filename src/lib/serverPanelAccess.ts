import db from '$lib/database.js';

// Account is the top-level owner: account -> panel -> bots -> servers.
// When multi-panel per account is introduced, these checks will need to verify
// the account owns the panel, not just match panel_id directly.
// For now: 1 account = 1 panel, so panel_id match == account-level ownership.

function getAccountPanelId(locals: App.Locals): number | null {
	if (!locals.user.authenticated) return null;
	if (locals.user.account_source === 'accounts') return locals.user.panel_id;
	return null;
}

export async function accountOwnsServer(locals: App.Locals, serverId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'server_accounts') return true;
	const panelId = getAccountPanelId(locals);
	if (panelId == null) return false;
	const serverPanelId = await db.getServerPanelId(serverId);
	return serverPanelId === panelId;
}

export async function accountOwnsBot(locals: App.Locals, botId: number): Promise<boolean> {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'server_accounts') return true;
	const panelId = getAccountPanelId(locals);
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
		return locals.user.account_type === 'owner' || locals.user.account_type === 'moderator';
	}
	return false;
}

export function isGuildModeratorUser(user: App.Locals['user']): boolean {
	return user.authenticated && user.account_source === 'server_accounts' && user.account_type === 'moderator';
}

export function isServerConfigReadOnly(locals: App.Locals): boolean {
	return isGuildModeratorUser(locals.user);
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
