import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken } from '$lib/backend/public/items/index.js';
import { loadTasksShared } from '$lib/backend/public/tasks/index.js';
import { publicSubfeatureEnabled } from '$lib/backend/panelServer.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const psSettings = (psRow as any)?.settings || {};
	if (!publicSubfeatureEnabled(psSettings, 'tasks')) {
		return json({ success: false, error: 'Tasks are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body?.card) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(body.card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const tasks = await loadTasksShared({
		server,
		member: actor,
		itemsEnabled: publicSubfeatureEnabled(psSettings, 'items'),
		minigamesEnabled: publicSubfeatureEnabled(psSettings, 'minigames'),
		marketEnabled: publicSubfeatureEnabled(psSettings, 'market'),
		tzOffsetMin: Number(body.tz_offset) || 0
	}).catch(() => null);

	if (!tasks) return json({ success: false, error: 'Could not load tasks.' }, { status: 500 });
	return json({ success: true, tasks });
};
