import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canUseEmbedBuilder } from '$lib/frontend/panelServer.js';

const MAX_ADJUST = 10_000;

async function guard(locals: App.Locals, rawId: string | undefined) {
	if (!locals.user.authenticated) return { error: json({ ok: false, error: 'Authentication required' }, { status: 401 }) };
	const serverId = parseInt(rawId ?? '');
	if (isNaN(serverId)) return { error: json({ ok: false, error: 'Invalid server ID' }, { status: 400 }) };
	if (!(await canUseEmbedBuilder(locals, serverId))) return { error: json({ ok: false, error: 'Access denied' }, { status: 403 }) };
	return { serverId };
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const g = await guard(locals, params.id);
	if (g.error) return g.error;

	const discordId = String(url.searchParams.get('member') ?? '').trim();
	if (!discordId) return json({ ok: false, error: 'member is required' }, { status: 400 });
	const member = await db.getMemberByDiscordId(g.serverId, discordId, { includeDeleted: true });
	if (!member) return json({ ok: false, error: 'Member not found' }, { status: 404 });

	const [stats, inviter, invitees, logs] = await Promise.all([
		db.getMemberInviteStats(Number(member.id)),
		db.getMemberInviter(Number(member.id)),
		db.getMemberInvitees(Number(member.id), 100),
		db.getMemberInviteLogs(Number(member.id), 50)
	]);
	return json({ ok: true, stats, inviter, invitees, logs });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const g = await guard(locals, params.id);
	if (g.error) return g.error;

	const body = await request.json().catch(() => null);
	const action = String(body?.action ?? '');
	const discordId = String(body?.member ?? '').trim();
	const member = discordId ? await db.getMemberByDiscordId(g.serverId, discordId, { includeDeleted: true }) : null;
	if (!member) return json({ ok: false, error: 'Member not found' }, { status: 404 });

	if (action === 'adjust') {
		const amount = Math.trunc(Number(body?.amount));
		const reason = String(body?.reason ?? '')
			.trim()
			.slice(0, 500);
		if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUST) {
			return json({ ok: false, error: `Amount must be a whole number between -${MAX_ADJUST} and ${MAX_ADJUST}, not 0` }, { status: 400 });
		}
		if (!reason) return json({ ok: false, error: 'Enter a reason' }, { status: 400 });
		const actor = locals.user.authenticated
			? locals.user.account_source === 'server_accounts'
				? { server_account_id: locals.user.account_id }
				: { account_id: locals.user.account_id }
			: {};
		await db.addMemberInviteAdjustment(Number(member.id), actor, amount, reason);
		return json({ ok: true, stats: await db.getMemberInviteStats(Number(member.id)) });
	}

	if (action === 'assign') {
		if (member.deleted_at) return json({ ok: false, error: 'This member has left the server' }, { status: 409 });
		const inviterDiscordId = String(body?.inviter ?? '').trim();
		if (!inviterDiscordId || inviterDiscordId === discordId) return json({ ok: false, error: 'Pick a different member as the inviter' }, { status: 400 });
		const inviter = await db.getMemberByDiscordId(g.serverId, inviterDiscordId);
		if (!inviter || inviter.is_bot) return json({ ok: false, error: 'Inviter not found' }, { status: 404 });
		const assigned = await db.assignMemberInviter(Number(member.id), Number(inviter.id));
		if (!assigned) return json({ ok: false, error: 'This join already has an inviter or was not tracked' }, { status: 409 });
		return json({ ok: true, inviter: await db.getMemberInviter(Number(member.id)) });
	}

	return json({ ok: false, error: 'Unknown action' }, { status: 400 });
};
