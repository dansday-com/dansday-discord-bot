import type { RequestHandler } from '@sveltejs/kit';
import { readServerMessageFile, serverMessageFileContentType, serverMessageFileKeyFor } from '$lib/backend/storage/serverMessages.js';

export const GET: RequestHandler = async ({ params, request }) => {
	let key: string;
	try {
		key = serverMessageFileKeyFor(params.serverId, params.filename ?? '');
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
	}

	const data = await readServerMessageFile(key);
	if (!data) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });

	const headers = {
		'Content-Type': serverMessageFileContentType(key),
		'Cache-Control': 'public, max-age=31536000, immutable',
		'Accept-Ranges': 'bytes',
		'X-Content-Type-Options': 'nosniff'
	};

	const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
	if (range && (range[1] || range[2])) {
		const size = data.length;
		const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
		return new Response(new Uint8Array(data.subarray(start, end + 1)), {
			status: 206,
			headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) }
		});
	}

	return new Response(new Uint8Array(data), { headers: { ...headers, 'Content-Length': String(data.length) } });
};
