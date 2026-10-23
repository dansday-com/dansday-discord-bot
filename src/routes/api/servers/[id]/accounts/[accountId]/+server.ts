import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { sendAccountDeletedEmail, sendAccountFrozenEmail, sendAccountUnfrozenEmail } from '$lib/frontend/email.js';
import { guardAccountAction } from '$lib/frontend/panelGuards.server.js';
import { HTTP } from '$lib/http.js';

async function canManageAccounts(locals: App.Locals, serverId: number): Promise<boolean> {
	if (!locals.user.authenticated) {
		return false;
	}
	if (locals.user.account_source === 'accounts') {
		const { accountOwnsServer } = await import('$lib/backend/panelServer.js');
		return accountOwnsServer(locals, serverId);
	}
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') {
		return locals.user.server_id === serverId;
	}
	return false;
}

function isTargetSelfServerAccount(locals: App.Locals, targetAccountId: number): boolean {
	return locals.user.authenticated && locals.user.account_source === 'server_accounts' && locals.user.account_id === targetAccountId;
}

type Target = { account: NonNullable<Awaited<ReturnType<typeof db.getAccountById>>>; serverName: string };

async function findTarget(
	locals: App.Locals,
	{ serverId, accountId, verb }: { serverId: number; accountId: number; verb: string }
): Promise<Target | Response> {
	if (!(await canManageAccounts(locals, serverId))) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}
	const [account, accountServer, server] = await Promise.all([db.getAccountById(accountId), db.getAccountServer(accountId, serverId), db.getServer(serverId)]);
	if (!account || !accountServer) {
		return json({ success: false, error: 'Account not found' }, { status: HTTP.NOT_FOUND });
	}
	if (isTargetSelfServerAccount(locals, account.id)) {
		return json({ success: false, error: `Cannot ${verb} your own account` }, { status: HTTP.BAD_REQUEST });
	}
	return guardAccountAction(locals, accountServer.account_type) ?? { account, serverName: server?.name || 'this server' };
}

function actorName(locals: App.Locals): string {
	return (locals.user as Extract<App.Locals['user'], { authenticated: true }>).username;
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	const target = await findTarget(locals, { serverId, accountId: Number(params.accountId), verb: 'modify' });
	if (target instanceof Response) {
		return target;
	}
	const { account, serverName } = target;

	const { is_frozen } = await request.json();
	if (typeof is_frozen !== 'boolean') {
		return json({ success: false, error: 'is_frozen must be a boolean' }, { status: HTTP.BAD_REQUEST });
	}

	await db.updateAccountServer(account.id, serverId, { is_frozen });
	logger.log(`${actorName(locals)} ${is_frozen ? 'froze' : 'unfroze'} server account ${account.username} (server ${serverId})`);

	try {
		if (is_frozen) {
			await sendAccountFrozenEmail(account.email, account.username, serverName);
		} else {
			await sendAccountUnfrozenEmail(account.email, account.username, serverName);
		}
	} catch (err) {
		logger.log(`⚠️ Failed to send ${is_frozen ? 'frozen' : 'unfrozen'} email to ${account.email}: ${(err as Error)?.message ?? String(err)}`);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	const target = await findTarget(locals, { serverId, accountId: Number(params.accountId), verb: 'delete' });
	if (target instanceof Response) {
		return target;
	}
	const { account, serverName } = target;

	await db.deleteAccountServer(account.id, serverId);
	logger.log(`${actorName(locals)} removed server account ${account.username} (server ${serverId})`);

	try {
		await sendAccountDeletedEmail(account.email, account.username, serverName);
	} catch (err) {
		logger.log(`⚠️ Failed to send deleted email to ${account.email}: ${(err as Error)?.message ?? String(err)}`);
	}

	return json({ success: true });
};
