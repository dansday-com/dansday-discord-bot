import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/utils/index.js';
import { EMBED_IMAGE_MAX_BYTES } from '$lib/images.js';
import { readUploadedImage } from '$lib/backend/storage/imageUpload.js';
import { embedImageFilename, embedImageKey, embedImageUrl, embedScope, saveEmbedImage } from '$lib/backend/storage/embedImages.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverId = parseInt(params.id ?? '');
	if (!serverId) {
		return json({ success: false, error: 'Invalid server ID' }, { status: 400 });
	}

	try {
		const upload = await readUploadedImage(request, EMBED_IMAGE_MAX_BYTES);
		if (!upload.ok) return json({ success: false, error: upload.error }, { status: upload.status });

		const key = embedImageKey(embedScope(serverId), embedImageFilename(upload.extension));
		await saveEmbedImage(key, upload.data);

		return json({ success: true, url: embedImageUrl(key), path: key });
	} catch (error: any) {
		logger.log(`❌ Error uploading embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
