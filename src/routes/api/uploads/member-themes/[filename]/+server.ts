import type { RequestHandler } from '@sveltejs/kit';
import { imageFilenamePattern } from '$lib/images.js';
import { memberThemeContentType, readMemberTheme } from '$lib/backend/storage/memberThemes.js';
import { HTTP } from '$lib/http.js';

const FILENAME_PATTERN = imageFilenamePattern('\\d+-\\d+-[a-z0-9]+');

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename ?? '';

	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: HTTP.BAD_REQUEST });
	}

	if (!FILENAME_PATTERN.test(filename)) {
		return new Response(JSON.stringify({ error: 'Invalid filename format' }), { status: HTTP.BAD_REQUEST });
	}

	const data = await readMemberTheme(filename);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: HTTP.NOT_FOUND });
	}

	return new Response(data as Uint8Array<ArrayBuffer>, {
		headers: {
			'Content-Type': memberThemeContentType(filename),
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
