import type { RequestHandler } from '@sveltejs/kit';
import { readServerTheme, serverThemeContentType, serverThemeKey } from '$lib/backend/storage/serverThemes.js';
import { attemptSync } from '$lib/utils/attempt.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params }) => {
	const resolved = attemptSync(() => serverThemeKey(params.serverId ?? '', params.filename ?? ''));
	if (!resolved.ok) {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: HTTP.BAD_REQUEST });
	}
	const key = resolved.value;

	const data = await readServerTheme(key);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: HTTP.NOT_FOUND });
	}

	return new Response(data as Uint8Array<ArrayBuffer>, {
		headers: {
			'Content-Type': serverThemeContentType(key),
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
