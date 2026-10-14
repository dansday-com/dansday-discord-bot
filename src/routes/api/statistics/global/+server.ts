import type { RequestHandler } from '@sveltejs/kit';
import { subscribeGlobalStatistics } from '$lib/frontend/public/statistics/global.js';
import { eventStream } from '$lib/frontend/eventStream.server.js';

export const GET: RequestHandler = async () => {
	return eventStream((send) => subscribeGlobalStatistics((snapshot) => send(snapshot)), { 'Cache-Control': 'no-store' });
};
