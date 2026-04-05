import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { type LeaderboardMetric, type LeaderboardRange, subscribeLeaderboard } from '$lib/leaderboard/index.js';
import { resolvePublicServerBySlug } from '$lib/publicServerSlug/index.js';

function parseMetric(m: string | null): LeaderboardMetric {
	const v = (m || 'xp').toLowerCase();
	if (v === 'chat') return 'chat';
	if (v === 'voice_total') return 'voice_total';
	if (v === 'voice_active') return 'voice_active';
	if (v === 'voice_afk') return 'voice_afk';
	return 'xp';
}

function parseRange(r: string | null): LeaderboardRange {
	const v = (r || 'all').toLowerCase();
	if (v === '1d') return '1d';
	if (v === '7d') return '7d';
	if (v === '30d') return '30d';
	return 'all';
}

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return new Response('Not found', { status: 404 });
	const server = resolved.server;

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) return new Response('Not found', { status: 404 });

	const metric = parseMetric(url.searchParams.get('metric'));
	const range = parseRange(url.searchParams.get('range'));
	const limit = Math.max(3, Math.min(100, Number(url.searchParams.get('limit') || 50)));

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: object) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};

			const unsub = subscribeLeaderboard(server.id, metric, range, limit, (snap) => send(snap));

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
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
