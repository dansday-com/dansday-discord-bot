import db from '$lib/database.js';
import { getSession, isUtcSqlExpired, newSessionId, setSession } from '$lib/utils/index.js';
import { SECOND_MS } from '$lib/utils/time.js';

type AccountInvite = NonNullable<Awaited<ReturnType<typeof db.getAccountInviteByToken>>>;
type InviteServer = NonNullable<Awaited<ReturnType<typeof db.getServer>>>;

export type InviteProblem = 'invite_not_found' | 'invite_used' | 'invite_expired';

export const INVITE_PROBLEM_MESSAGES: Record<InviteProblem, string> = {
	invite_not_found: 'This invite link could not be found. Ask a server owner for a new one.',
	invite_used: 'This invite link has already been used. Ask a server owner for a new one.',
	invite_expired: 'This invite link has expired. Ask a server owner for a new one.'
};

export async function findOpenInvite(token: string): Promise<{ invite: AccountInvite; server: InviteServer } | { problem: InviteProblem }> {
	const invite = await db.getAccountInviteByToken(token);
	if (!invite) {
		return { problem: 'invite_not_found' };
	}
	if (invite.used_by || invite.used_at) {
		return { problem: 'invite_used' };
	}
	if (invite.expires_at && isUtcSqlExpired(invite.expires_at)) {
		return { problem: 'invite_expired' };
	}
	const server = await db.getServer(invite.server_id);
	if (!server || server.deleted_at) {
		return { problem: 'invite_not_found' };
	}
	return { invite, server };
}

export async function acceptAccountInvite(invite: AccountInvite, account: { id: number; username: string }): Promise<string | null> {
	const existing = await db.getAccountServer(account.id, invite.server_id);
	if (existing?.is_frozen) {
		return 'Your access to this server is frozen. Ask a server owner to unfreeze you.';
	}
	if (existing && (existing.account_type === 'owner' || invite.account_type === 'staff')) {
		return 'You already have access to this server.';
	}
	if (!(await db.claimAccountInvite(invite.id, account.id))) {
		return INVITE_PROBLEM_MESSAGES.invite_used;
	}
	await db.createAccountServer({ account_id: account.id, server_id: invite.server_id, account_type: invite.account_type });
	await db
		.createServerPanelLog(
			Number(invite.server_id),
			{ account_id: account.id },
			{
				action: 'account_invite',
				changes: [{ key: 'invite link', before: `${invite.account_type}, open`, after: `${invite.account_type}, used by ${account.username}` }]
			}
		)
		.catch(() => null);
	return null;
}

export async function openAccountSession(accountId: number, serverId?: number): Promise<string> {
	const sessionId = newSessionId();
	await setSession(sessionId, { authenticated: true, account_id: accountId, server_id: serverId });
	return sessionId;
}

export async function switchSessionServer(sessionId: string, serverId: number): Promise<boolean> {
	const session = await getSession(sessionId);
	if (!session) {
		return false;
	}
	const remainingSeconds = session.expires_at ? (session.expires_at - Date.now()) / SECOND_MS : undefined;
	await setSession(sessionId, { ...session, server_id: serverId }, remainingSeconds);
	return true;
}
