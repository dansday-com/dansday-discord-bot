export function canEditServerSettings(locals: App.Locals, serverId: string | number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}

export function canUseEmbedBuilder(locals: App.Locals, serverId: string | number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
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

export function canViewSelfbots(locals: App.Locals, serverId: string | number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}

export function canManageSelfbots(locals: App.Locals, serverId: string | number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === Number(serverId);
	}
	return false;
}
