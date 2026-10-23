import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { sendAccountDeletedEmail, sendAccountFrozenEmail, sendAccountUnfrozenEmail } from '$lib/frontend/email.js';

function authorize(locals: App.Locals) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED }) };
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return { error: json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN }) };
	}

	const panelId = Number(locals.user.panel_id);
	if (!Number.isFinite(panelId) || panelId <= 0) {
		return { error: json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND }) };
	}

	return { panelId, username: locals.user.username };
}

const ALL_SERVERS_LABEL = 'all your servers';

function accountIdFrom(params: Partial<Record<string, string>>): number | null {
	const accountId = Number(params.accountId);
	return Number.isInteger(accountId) && accountId > 0 ? accountId : null;
}

function notFound(): Response {
	return json({ success: false, error: 'Account not found on your servers' }, { status: HTTP.NOT_FOUND });
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}
	const accountId = accountIdFrom(params);
	const body = await request.json().catch(() => null);
	if (!accountId || typeof body?.is_frozen !== 'boolean') {
		return json({ success: false, error: 'A valid account and is_frozen boolean are required' }, { status: HTTP.BAD_REQUEST });
	}
	const isFrozen: boolean = body.is_frozen;

	const account = await db.getAccountById(accountId);
	if (!account || (await db.setPanelAccountFrozen(auth.panelId!, accountId, isFrozen)) === 0) {
		return notFound();
	}
	logger.log(`${auth.username} ${isFrozen ? 'froze' : 'unfroze'} account ${account.username} on every server`);

	try {
		if (isFrozen) {
			await sendAccountFrozenEmail(account.email, account.username, ALL_SERVERS_LABEL);
		} else {
			await sendAccountUnfrozenEmail(account.email, account.username, ALL_SERVERS_LABEL);
		}
	} catch (err) {
		logger.log(`⚠️ Failed to send ${isFrozen ? 'frozen' : 'unfrozen'} email to ${account.email}: ${(err as Error)?.message ?? String(err)}`);
	}
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}
	const accountId = accountIdFrom(params);
	if (!accountId) {
		return json({ success: false, error: 'A valid account is required' }, { status: HTTP.BAD_REQUEST });
	}

	const account = await db.getAccountById(accountId);
	if (!account || (await db.deletePanelAccount(auth.panelId!, accountId)) === 0) {
		return notFound();
	}
	logger.log(`${auth.username} deleted account ${account.username} from every server`);

	try {
		await sendAccountDeletedEmail(account.email, account.username, ALL_SERVERS_LABEL);
	} catch (err) {
		logger.log(`⚠️ Failed to send deleted email to ${account.email}: ${(err as Error)?.message ?? String(err)}`);
	}
	return json({ success: true });
};
