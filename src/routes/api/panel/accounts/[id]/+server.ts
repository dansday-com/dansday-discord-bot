import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { destroySessionsForAccount } from '$lib/server/session.js';
import { sanitizeInteger } from '$lib/server/utils.js';
import { sendAccountDeletedEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const accountId = sanitizeInteger(params.id, 1, null);
		if (!accountId) {
			return json({ success: false, error: 'Invalid account ID' }, { status: 400 });
		}

		const account = await db.getPanelAccountById(accountId);
		if (!account) {
			return json({ success: false, error: 'Account not found' }, { status: 404 });
		}

		if (accountId === locals.user.account_id) {
			return json({ success: false, error: 'You cannot delete your own account' }, { status: 400 });
		}

		try {
			await sendAccountDeletedEmail(account.email, account.username);
		} catch (_) {}

		await db.deletePanelAccount(accountId);
		logger.log(`${locals.user.username} deleted account: ${account.username} (ID: ${accountId})`);

		return json({ success: true, message: 'Account deleted successfully' });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
