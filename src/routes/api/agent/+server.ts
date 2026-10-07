import type { RequestHandler } from '@sveltejs/kit';
import { answerAssistant, describeAssistant } from '$lib/frontend/agent/assistant.server.js';

const HEARTBEAT_MS = 15_000;

export const GET: RequestHandler = ({ locals, url }) => describeAssistant(locals, url);

export const POST: RequestHandler = async ({ locals, request }) => {
	const body = await request.json().catch(() => null);
	const encoder = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval>;

	const stream = new ReadableStream({
		start(controller) {
			const send = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch (_) {}
			};
			const answer = (status: number, payload: unknown) => send(`data: ${JSON.stringify({ status, body: payload })}\n\n`);

			send(': working\n\n');
			heartbeat = setInterval(() => send(': working\n\n'), HEARTBEAT_MS);
			answerAssistant(locals, body)
				.then(async (response) => answer(response.status, await response.json()))
				.catch(() => answer(500, { ok: false, error: 'The assistant request failed. Try again in a moment.' }))
				.finally(() => {
					clearInterval(heartbeat);
					try {
						controller.close();
					} catch (_) {}
				});
		},
		cancel() {
			clearInterval(heartbeat);
		}
	});

	return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' } });
};
