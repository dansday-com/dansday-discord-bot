import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/backend/panelServer.js';
import { guardMemberAction, panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { HTTP, readJsonObject } from '$lib/http.js';

const MAX_ADJUST = 10_000;
const INVITEES_LIMIT = 100;
const INVITE_LOGS_LIMIT = 50;
const REASON_MAX_LENGTH = 500;

async function guard(locals: App.Locals, rawId: string | undefined) {
	if (!locals.user.authenticated) {
		return { error: json({ ok: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED }) };
	}
	const serverId = parseInt(rawId ?? '');
	if (isNaN(serverId)) {
		return { error: json({ ok: false, error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST }) };
	}
	if (!(await canUseEmbedBuilder(locals, serverId))) {
		return { error: json({ ok: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN }) };
	}
	return { serverId };
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const g = await guard(locals, params.id);
	if (g.error) {
		return g.error;
	}

	const discordId = String(url.searchParams.get('member') ?? '').trim();
	if (!discordId) {
		return json({ ok: false, error: 'member is required' }, { status: HTTP.BAD_REQUEST });
	}
	const member = await db.getMemberByDiscordId(g.serverId, discordId, { includeDeleted: true });
	if (!member) {
		return json({ ok: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	const [stats, inviter, invitees, logs] = await Promise.all([
		db.getMemberInviteStats(Number(member.id)),
		db.getMemberInviter(Number(member.id)),
		db.getMemberInvitees(Number(member.id), INVITEES_LIMIT),
		db.getMemberInviteLogs(Number(member.id), INVITE_LOGS_LIMIT)
	]);
	return json({ ok: true, stats, inviter, invitees, logs });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const g = await guard(locals, params.id);
	if (g.error) {
		return g.error;
	}

	const body = await readJsonObject(request);
	const action = typeof body.action === 'string' ? body.action : '';
	const discordId = typeof body.member === 'string' ? body.member.trim() : '';
	const member = discordId ? await db.getMemberByDiscordId(g.serverId, discordId, { includeDeleted: true }) : null;
	if (!member) {
		return json({ ok: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	const memberDenied = await guardMemberAction(locals, g.serverId, discordId);
	if (memberDenied) {
		return memberDenied;
	}

	if (action === 'adjust') {
		const amount = Math.trunc(typeof body.amount === 'number' || typeof body.amount === 'string' ? Number(body.amount) : Number.NaN);
		const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, REASON_MAX_LENGTH) : '';
		if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUST) {
			return json({ ok: false, error: `Amount must be a whole number between -${MAX_ADJUST} and ${MAX_ADJUST}, not 0` }, { status: HTTP.BAD_REQUEST });
		}
		if (!reason) {
			return json({ ok: false, error: 'Enter a reason' }, { status: HTTP.BAD_REQUEST });
		}
		const actor = panelActorIds(locals);
		const before = await db.getMemberInviteStats(Number(member.id));
		await db.addMemberInviteAdjustment(Number(member.id), actor, { amount, reason });
		const stats = await db.getMemberInviteStats(Number(member.id));
		await db
			.createServerPanelLog(g.serverId, actor, {
				action: 'invite_bonus',
				changes: [
					{ key: 'member', before: null, after: discordId },
					{ key: 'bonus invites', before: String(before.bonus), after: String(stats.bonus) },
					{ key: 'reason', before: null, after: reason }
				]
			})
			.catch(() => null);
		return json({ ok: true, stats });
	}

	if (action === 'assign') {
		if (member.deleted_at) {
			return json({ ok: false, error: 'This member has left the server' }, { status: HTTP.CONFLICT });
		}
		const inviterDiscordId = typeof body.inviter === 'string' ? body.inviter.trim() : '';
		if (!inviterDiscordId || inviterDiscordId === discordId) {
			return json({ ok: false, error: 'Pick a different member as the inviter' }, { status: HTTP.BAD_REQUEST });
		}
		const inviter = await db.getMemberByDiscordId(g.serverId, inviterDiscordId);
		if (!inviter || inviter.is_bot) {
			return json({ ok: false, error: 'Inviter not found' }, { status: HTTP.NOT_FOUND });
		}
		const inviterDenied = await guardMemberAction(locals, g.serverId, inviterDiscordId);
		if (inviterDenied) {
			return inviterDenied;
		}
		const isAssigned = await db.assignMemberInviter(Number(member.id), Number(inviter.id));
		if (!isAssigned) {
			return json({ ok: false, error: 'This join already has an inviter or was not tracked' }, { status: HTTP.CONFLICT });
		}
		await db
			.createServerPanelLog(g.serverId, panelActorIds(locals), {
				action: 'invite_assign',
				changes: [
					{ key: 'member', before: null, after: discordId },
					{ key: 'inviter', before: 'Unknown', after: inviterDiscordId }
				]
			})
			.catch(() => null);
		return json({ ok: true, inviter: await db.getMemberInviter(Number(member.id)) });
	}

	return json({ ok: false, error: 'Unknown action' }, { status: HTTP.BAD_REQUEST });
};
