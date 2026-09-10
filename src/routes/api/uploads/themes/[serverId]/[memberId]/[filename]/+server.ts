import type { RequestHandler } from '@sveltejs/kit';
import { memberThemeContentType, memberThemeKey, readMemberTheme } from '$lib/backend/storage/memberThemes.js';

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename ?? '';

	let key: string;
	try {
		key = memberThemeKey(params.serverId, params.memberId, filename);
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
	}

	const data = await readMemberTheme(key);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
	}

	return new Response(data, {
		headers: {
			'Content-Type': memberThemeContentType(key),
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
