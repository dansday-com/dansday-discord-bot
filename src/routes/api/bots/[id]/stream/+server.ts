import type { RequestHandler } from '@sveltejs/kit';
import { subscribeBotStatus, getBotUptimeMs, type BotProcessKind } from '$lib/botProcesses.js';
import db from '$lib/database.js';
import { canViewSelfbots } from '$lib/frontend/panelServer.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const botId = Number(params.id);
	const streamKind: BotProcessKind = url.searchParams.get('kind') === 'selfbot' ? 'selfbot' : 'official';

	if (streamKind === 'selfbot') {
		const sb = await db.getServerBotById(botId);
		if (!sb) return new Response('Not found', { status: 404 });
		if (!(await canViewSelfbots(locals, sb.server_id))) return new Response('Access denied', { status: 403 });
	}

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: object) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};

			if (streamKind === 'selfbot') {
				db.getServerBotById(botId)
					.then((sb) => {
						if (!sb) return;
						send({ status: sb.status, process_id: sb.process_id ?? null, uptime_ms: getBotUptimeMs(sb) });
					})
					.catch((_) => {});
			} else {
				db.getBot(botId)
					.then((bot) => {
						if (!bot) return;
						send({ status: bot.status, process_id: bot.process_id ?? null, uptime_ms: getBotUptimeMs(bot) });
					})
					.catch((_) => {});
			}

			const unsub = subscribeBotStatus(streamKind, botId, (e) => {
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
