import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/utils/index.js';
import { embedKeyBelongsTo, embedScope, removeEmbedImage } from '$lib/backend/storage/embedImages.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverId = parseInt(params.id ?? '', 10);
	if (!serverId) {
		return json({ success: false, error: 'Invalid server ID' }, { status: 400 });
	}

	try {
		const { path: filename } = await request.json();
		if (!filename) {
			return json({ success: false, error: 'No filename provided' }, { status: 400 });
		}

		if (!embedKeyBelongsTo(filename, embedScope(serverId))) {
			return json({ success: false, error: 'Invalid or unsupported image path' }, { status: 400 });
		}

		await removeEmbedImage(filename);

		return json({ success: true });
	} catch (error: any) {
		logger.log(`❌ Error deleting embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
