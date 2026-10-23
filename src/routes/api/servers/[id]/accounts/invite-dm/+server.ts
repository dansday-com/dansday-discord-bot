import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { randomBytes } from 'crypto';
import { logger } from '$lib/utils/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';
import { guardAccountAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { invitableAccountTypes, panelActorOf } from '$lib/panelHierarchy.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { INVITE_TOKEN_BYTES } from '$lib/accounts.js';

const MEMBER_ID_MIN_LENGTH = 5;
const MAX_INVITES_PER_REQUEST = 50;

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

type InviteFailure = { discord_member_id: string; error: string };
type InviteContext = {
	locals: App.Locals;
	server: NonNullable<Awaited<ReturnType<typeof db.getServer>>>;
	bot: Pick<NonNullable<Awaited<ReturnType<typeof db.getBot>>>, 'id' | 'port' | 'secret_key'>;
	accountType: 'owner' | 'staff';
	origin: string;
};
type InviteSent = { ok: true; inviteUrl: string; token: string } | { ok: false; error: string };

function requestedMemberIds(body: Record<string, unknown>): string[] {
	const rawMulti = body.discord_member_ids;
	const singleId = body.discord_member_id;
	if (Array.isArray(rawMulti)) {
		return [...new Set(rawMulti.map((x: unknown) => String(x ?? '').trim()).filter((id) => id.length >= MEMBER_ID_MIN_LENGTH))];
	}
	return singleId != null && String(singleId).trim().length >= MEMBER_ID_MIN_LENGTH ? [String(singleId).trim()] : [];
}

async function inviteBot(serverId: number): Promise<Pick<InviteContext, 'server' | 'bot'> | Response> {
	const server = await db.getServer(serverId);
	if (!server) {
		return json({ success: false, error: 'Server not found' }, { status: HTTP.NOT_FOUND });
	}
	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	const bot = officialBotId ? await db.getBot(officialBotId) : null;
	if (!bot) {
		return json({ success: false, error: 'Bot not found' }, { status: HTTP.NOT_FOUND });
	}
	if (bot.status !== 'running') {
		return json({ success: false, error: 'Bot is not running' }, { status: HTTP.BAD_REQUEST });
	}
	if (!bot.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot webhook not configured' }, { status: HTTP.BAD_REQUEST });
	}
	return { server, bot };
}

async function sendInviteDm(ctx: InviteContext, discordMemberId: string): Promise<InviteSent> {
	const { server, accountType } = ctx;
	const member = await db.getMemberByDiscordId(server.id, discordMemberId);
	if (!member) {
		return { ok: false, error: 'Member not found (sync may be required)' };
	}

	const token = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
	await db.createAccountInvite({ token, server_id: server.id, account_type: accountType });

	const inviteUrl = `${ctx.origin}/register?token=${token}`;
	const displayName = member.server_display_name || member.display_name || member.username || 'there';
	const result = await postBotWebhook(ctx.bot, {
		type: 'send_dm',
		guild_id: server.discord_server_id,
		user_id: discordMemberId,
		embed_title: "You're invited",
		embed_description: `Hi ${displayName}! You've been invited to join **${server.name || 'this server'}** as **${accountType}**.\n\n[**Click here to register**](${inviteUrl})`,
		link_url: inviteUrl,
		link_label: 'Register'
	});
	if (result.status === HTTP.BAD_GATEWAY) {
		logger.log(`❌ Error calling bot webhook (send_dm) for server ${server.id}`);
	}
	if (result.status !== HTTP.OK || !result.body?.success) {
		return { ok: false, error: messageFromBotWebhookPayload(result.body) };
	}
	logger.log(
		`${ctx.locals.user.authenticated ? ctx.locals.user.username : 'unknown'} sent server invite DM to ${discordMemberId} (${accountType}) for server ${server.id}`
	);
	return { ok: true, inviteUrl, token };
}

async function logInvites(locals: App.Locals, serverId: number, { accountType, sentIds }: { accountType: string; sentIds: string[] }) {
	await db
		.createServerPanelLog(serverId, panelActorIds(locals), {
			action: 'account_invite',
			changes: [
				{ key: 'invite link', before: null, after: `${accountType}, sent by DM` },
				{ key: 'sent to', before: null, after: sentIds.join(', ') }
			]
		})
		.catch(() => null);
}

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	const serverId = Number(params.id);
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}
	if (!(await canManageAccounts(locals, serverId))) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body = await readJsonObject(request);
	const accountType = body.account_type === 'owner' || body.account_type === 'staff' ? body.account_type : null;
	const memberIds = requestedMemberIds(body);

	const denied = guardAccountAction(locals, accountType ?? 'staff');
	if (denied) {
		return denied;
	}
	const validTypes: string[] = invitableAccountTypes(panelActorOf(locals.user));
	if (!accountType || !validTypes.includes(accountType)) {
		return json({ success: false, error: `Valid account type required: ${validTypes.join(', ')}` }, { status: HTTP.BAD_REQUEST });
	}
	if (memberIds.length === 0) {
		return json({ success: false, error: 'Provide discord_member_id or discord_member_ids[]' }, { status: HTTP.BAD_REQUEST });
	}
	if (memberIds.length > MAX_INVITES_PER_REQUEST) {
		return json({ success: false, error: 'At most 50 members per request' }, { status: HTTP.BAD_REQUEST });
	}

	const target = await inviteBot(serverId);
	if (target instanceof Response) {
		return target;
	}

	const ctx: InviteContext = { locals, ...target, accountType, origin: url.origin };
	const failed: InviteFailure[] = [];
	const sentIds: string[] = [];
	let last: InviteSent | null = null;
	for (const discordMemberId of memberIds) {
		const sent = await sendInviteDm(ctx, discordMemberId);
		if (sent.ok) {
			sentIds.push(discordMemberId);
			last = sent;
		} else {
			failed.push({ discord_member_id: discordMemberId, error: sent.error });
		}
	}

	if (sentIds.length === 0) {
		return json({ success: false, error: failed[0]?.error ?? 'All invites failed', failed }, { status: HTTP.BAD_REQUEST });
	}

	await logInvites(locals, serverId, { accountType, sentIds });
	const isSingle = memberIds.length === 1 && last?.ok === true;
	return json({
		success: true,
		sent_count: sentIds.length,
		failed,
		invite_link: isSingle && last?.ok ? last.inviteUrl : null,
		token: isSingle && last?.ok ? last.token : null
	});
};
