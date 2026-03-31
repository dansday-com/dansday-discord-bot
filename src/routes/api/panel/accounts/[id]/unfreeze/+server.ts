import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import { sanitizeInteger } from '$lib/server/utils.js';
import { sendAccountUnfrozenEmail } from '$lib/server/email.js';
import logger from '$lib/server/logger.js';

export const PUT: RequestHandler = async ({ locals, params }) => {
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

		await db.updatePanelAccount(accountId, { is_frozen: false });
		logger.log(`${locals.user.username} unfroze account: ${account.username} (ID: ${accountId})`);

		try {
			await sendAccountUnfrozenEmail(account.email, account.username);
		} catch (_) {}

		return json({ success: true, message: 'Account unfrozen successfully' });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
