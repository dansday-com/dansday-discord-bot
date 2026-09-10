import type { RequestHandler } from '@sveltejs/kit';
import { embedImageContentType, embedImageKey, readEmbedImage } from '$lib/backend/storage/embedImages.js';

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename ?? '';

	let key: string;
	try {
		key = embedImageKey(params.scope ?? '', filename);
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400 });
	}

	const data = await readEmbedImage(key);
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
