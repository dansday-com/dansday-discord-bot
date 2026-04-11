import type { RequestHandler } from '@sveltejs/kit';
import { subscribeBotStatus, getBotUptimeMs } from '$lib/botProcesses.js';
import db from '$lib/database.js';

export const GET: RequestHandler = async ({ params }) => {
	const botId = Number(params.id);

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: object) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};

			db.getBot(botId)
				.then((bot) => {
					if (!bot) return;
					send({ status: bot.status, process_id: bot.process_id ?? null, uptime_ms: getBotUptimeMs(bot) });
				})
				.catch((_) => {});

			const unsub = subscribeBotStatus('official', botId, (e) => {
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
