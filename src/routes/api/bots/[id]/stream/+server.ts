import type { RequestHandler } from '@sveltejs/kit';
import { subscribeBotStatus, getBotUptimeMs } from '$lib/botControl.js';
import db from '$lib/database.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async ({ params }) => {
	const botId = Number(params.id);

	return eventStream((send) => {
		db.getBot(botId)
			.then((bot) => {
				if (!bot) {
					return;
				}
				send({ status: bot.status, process_id: bot.process_id ?? null, uptime_ms: getBotUptimeMs(bot) });
			})
			.catch((_) => {});

		return subscribeBotStatus('official', botId, (e) => {
			const uptime_ms = e.status === 'running' && e.uptime_started_at ? Date.now() - e.uptime_started_at : 0;
			send({ status: e.status, process_id: e.process_id, uptime_ms });
		});
	});
};
