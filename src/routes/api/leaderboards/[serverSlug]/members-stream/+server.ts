import type { RequestHandler } from '@sveltejs/kit';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { resolvePublicServerBySlug } from '$lib/publicServerSlug/index.js';
import db from '$lib/database.js';
import { subscribePublicMembersList } from '$lib/publicMembers/index.js';

export const GET: RequestHandler = async ({ params }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return new Response('Not found', { status: 404 });

	const settingsRow = await db.getServerSettings(resolved.server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) return new Response('Not found', { status: 404 });

	const serverId = resolved.server.id;

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: object) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};

			const unsub = subscribePublicMembersList(serverId, (payload) => send(payload));

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
