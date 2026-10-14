import { SECOND_MS } from '$lib/utils/time.js';

const HEARTBEAT_INTERVAL_SECONDS = 15;

export type SendEvent = (data: object) => void;

export function eventStream(subscribe: (send: SendEvent) => () => void, headers: Record<string, string> = {}) {
	let cleanup: (() => void) | null = null;
	const stream = new ReadableStream({
		start(controller) {
			const send: SendEvent = (data) => {
				try {
					controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
				} catch (_) {}
			};
			const unsub = subscribe(send);
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch (_) {
					clearInterval(heartbeat);
					unsub();
				}
			}, HEARTBEAT_INTERVAL_SECONDS * SECOND_MS);
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
	return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', ...headers } });
}
