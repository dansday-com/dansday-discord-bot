import type { RequestHandler } from '@sveltejs/kit';
import { subscribeBotStatus, getBotUptimeMs } from '$lib/botProcesses.js';
import db from '$lib/database.js';
import { canViewSelfbots } from '$lib/frontend/panelServer.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	const selfbotId = Number(params.id);
	const sb = await db.getServerBotById(selfbotId);
	if (!sb) return new Response('Not found', { status: 404 });
	if (!(await canViewSelfbots(locals, sb.server_id))) return new Response('Access denied', { status: 403 });

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: object) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};

			db.getServerBotById(selfbotId)
				.then((row) => {
					if (!row) return;
					send({ status: row.status, process_id: row.process_id ?? null, uptime_ms: getBotUptimeMs(row) });
				})
				.catch((_) => {});

			const unsub = subscribeBotStatus('selfbot', selfbotId, (e) => {
				const uptime_ms = e.status === 'running' && e.uptime_started_at ? Date.now() - e.uptime_started_at : 0;
				send({ status: e.status, process_id: e.process_id, uptime_ms });
			});

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch (_) {
					clearInterval(heartbeat);
					unsub();
				}
			}, 15000);

			cleanup = () => {
				clearInterval(heartbeat);
				unsub();
				try {
					controller.close();
				} catch (_) {}
			};
		},
		cancel() {
			cleanup?.();
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' }
	});
};
