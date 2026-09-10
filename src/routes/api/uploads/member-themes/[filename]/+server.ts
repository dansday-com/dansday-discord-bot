import type { RequestHandler } from '@sveltejs/kit';
import { imageFilenamePattern } from '$lib/images.js';
import { memberThemeContentType, readMemberTheme } from '$lib/backend/storage/memberThemes.js';

const FILENAME_PATTERN = imageFilenamePattern('\\d+-\\d+-[a-z0-9]+');

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename ?? '';

	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
	}

	if (!FILENAME_PATTERN.test(filename)) {
		return new Response(JSON.stringify({ error: 'Invalid filename format' }), { status: 400 });
	}

	const data = await readMemberTheme(filename);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
	}

	return new Response(data, {
		headers: {
			'Content-Type': memberThemeContentType(filename),
			'Cache-Control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
