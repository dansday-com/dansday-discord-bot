import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canEditServerSettings } from '$lib/backend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { HTTP, readJsonObject } from '$lib/http.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ ok: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ ok: false, error: 'Invalid server ID' }, { status: HTTP.BAD_REQUEST });
	}
	if (!(await canEditServerSettings(locals, serverId))) {
		return json({ ok: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const { id } = await readJsonObject(request);
	const earningId = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
	if (!/^\d+$/.test(earningId)) {
		return json({ ok: false, error: 'Invalid reward' }, { status: HTTP.BAD_REQUEST });
	}

	const done = await db.markRewardDelivered(serverId, earningId);
	if (!done) {
		return json({ ok: false, error: 'That reward was already delivered.' }, { status: HTTP.NOT_FOUND });
	}

	await db
		.createServerPanelLog(serverId, panelActorIds(locals), {
			action: 'rewards',
			changes: [{ key: 'reward delivered', before: null, after: `${done.reward} → ${done.member}` }]
		})
		.catch(() => null);
	return json({ ok: true });
};
