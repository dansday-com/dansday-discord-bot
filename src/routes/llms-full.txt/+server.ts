import type { RequestHandler } from './$types';
import { llmsFull } from '$lib/llms.js';

const body = llmsFull();

export const GET: RequestHandler = async () => {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
};
