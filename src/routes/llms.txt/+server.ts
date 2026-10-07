import type { RequestHandler } from './$types';
import { llmsIndex } from '$lib/llms.js';

const body = llmsIndex();

export const GET: RequestHandler = async () => {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
};
