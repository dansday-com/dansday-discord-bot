import type { RequestHandler } from '@sveltejs/kit';
import { embedImageContentType, readEmbedImage } from '$lib/backend/storage/embedImages.js';

const FILENAME_PATTERN = /^(?:global-\d+-\d+-[a-z0-9]+|global-\d+-[a-z0-9]+|\d+-\d+-[a-z0-9]+|\d+-[a-z0-9]+)\.(jpg|jpeg|png|gif|webp)$/i;

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename ?? '';

	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
	}

	if (!FILENAME_PATTERN.test(filename)) {
		return new Response(JSON.stringify({ error: 'Invalid filename format' }), { status: 400 });
	}

	const data = await readEmbedImage(filename);
	if (!data) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
	}

	return new Response(data, {
		headers: {
			'Content-Type': embedImageContentType(filename),
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
