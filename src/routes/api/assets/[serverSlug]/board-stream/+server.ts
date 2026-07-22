import type { RequestHandler } from '@sveltejs/kit';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { subscribeAssetsBoard } from '$lib/frontend/public/assets/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_STREAMS = 20;

export const GET: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'asset_board_stream', MAX_STREAMS, RATE_WINDOW_MS);
	if (!rate.allowed) return new Response('Too many requests', { status: 429 });

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return new Response('Not found', { status: 404 });

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (snap: { board: any[]; gainers: any[]; losers: any[] }) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(snap)}\n\n`);
				} catch (_) {}
			};

			const unsub = subscribeAssetsBoard((snap) => send(snap));

			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch (_) {
					clearInterval(heartbeat);
					unsub();
				}
			}, 15_000);

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
		headers: {
			'Content-Type': 'text/event-stream',
			Connection: 'keep-alive'
		}
	});
};
