import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canEditServerSettings } from '$lib/frontend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canEditServerSettings(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json().catch(() => null);
	const earningId = String(body?.id ?? '');
	if (!/^\d+$/.test(earningId)) return json({ ok: false, error: 'Invalid reward' }, { status: 400 });

	const done = await db.markRewardDelivered(serverId, earningId);
	if (!done) return json({ ok: false, error: 'That reward was already delivered.' }, { status: 404 });

	await db
		.createServerPanelLog(serverId, panelActorIds(locals), 'rewards', [{ key: 'reward delivered', before: null, after: `${done.reward} → ${done.member}` }])
		.catch(() => null);
	return json({ ok: true });
};
