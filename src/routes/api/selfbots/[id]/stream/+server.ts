import type { RequestHandler } from '@sveltejs/kit';
import { subscribeBotStatus, getBotUptimeMs } from '$lib/botControl.js';
import db from '$lib/database.js';
import { canManagePanelSelfbots } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	const selfbotId = Number(params.id);
	const sb = await db.getSelfbotById(selfbotId);
	if (!sb) {
		return new Response('Not found', { status: HTTP.NOT_FOUND });
	}
	if (!(await canManagePanelSelfbots(locals, selfbotId))) {
		return new Response('Access denied', { status: HTTP.FORBIDDEN });
	}

	return eventStream((send) => {
		db.getSelfbotById(selfbotId)
			.then((row) => {
				if (!row) {
					return;
				}
				send({ status: row.status, process_id: row.process_id ?? null, uptime_ms: getBotUptimeMs(row) });
			})
			.catch((_) => {});

		return subscribeBotStatus('selfbot', selfbotId, (e) => {
			const uptime_ms = e.status === 'running' && e.uptime_started_at ? Date.now() - e.uptime_started_at : 0;
			send({ status: e.status, process_id: e.process_id, uptime_ms });
		});
	});
};
