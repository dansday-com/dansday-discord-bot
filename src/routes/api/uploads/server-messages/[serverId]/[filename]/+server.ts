import type { RequestHandler } from '@sveltejs/kit';
import { serveMessageFile } from '$lib/frontend/messageFiles.server.js';

export const GET: RequestHandler = ({ params, request }) => serveMessageFile(request, { scope: 'server', id: params.serverId ?? '' }, params.filename ?? '');
