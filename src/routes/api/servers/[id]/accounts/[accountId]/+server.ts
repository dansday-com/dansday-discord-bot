import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';
import { sendAccountDeletedEmail, sendAccountFrozenEmail, sendAccountUnfrozenEmail } from '$lib/server/email.js';

function canManageAccounts(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_source === 'accounts';
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
	if (!canManageAccounts(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const accountId = Number(params.accountId);
	const account = await db.getServerAccountById(accountId);
	if (!account || account.server_id !== serverId) {
		return json({ success: false, error: 'Account not found' }, { status: 404 });
	}

	if (account.id === locals.user.account_id) {
		return json({ success: false, error: 'Cannot modify your own account' }, { status: 400 });
	}

	// Only superadmin can freeze/unfreeze an owner account
	if (account.account_type === 'owner' && !isSuperadmin(locals)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const { is_frozen } = await request.json();
	if (typeof is_frozen !== 'boolean') {
		return json({ success: false, error: 'is_frozen must be a boolean' }, { status: 400 });
	}

	await db.updateServerAccount(accountId, { is_frozen });
	const action = is_frozen ? 'froze' : 'unfroze';
	logger.log(`${locals.user.username} ${action} server account ${account.username} (server ${serverId})`);

	try {
		if (is_frozen) {
			await sendAccountFrozenEmail(account.email, account.username);
		} else {
			await sendAccountUnfrozenEmail(account.email, account.username);
		}
	} catch (err: any) {
		// Do not fail the request if email sending fails
		logger.log(`⚠️ Failed to send ${is_frozen ? 'frozen' : 'unfrozen'} email to ${account.email}: ${err?.message ?? String(err)}`);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'moderator') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}
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

	// Only superadmin can delete an owner account
	if (account.account_type === 'owner' && !isSuperadmin(locals)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	await db.deleteServerAccount(accountId);
	logger.log(`${locals.user.username} deleted server account ${account.username} (server ${serverId})`);

	try {
		await sendAccountDeletedEmail(account.email, account.username);
	} catch (err: any) {
		// Do not fail the request if email sending fails
		logger.log(`⚠️ Failed to send deleted email to ${account.email}: ${err?.message ?? String(err)}`);
	}

	return json({ success: true });
};
