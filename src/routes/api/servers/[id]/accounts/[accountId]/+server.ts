import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

function canManageAccounts(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_type === 'superadmin') return true;
	if (locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const accountId = Number(params.accountId);
	const account = await db.getServerAccountById(accountId);
	if (!account || account.server_id !== serverId) {
		return json({ success: false, error: 'Account not found' }, { status: 404 });
	}

	if (account.id === locals.user.account_id) {
		return json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
	}

	await db.deleteServerAccount(accountId);
	logger.log(`${locals.user.username} deleted server account ${account.username} (server ${serverId})`);

	return json({ success: true });
};
