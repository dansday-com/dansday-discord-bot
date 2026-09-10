import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/utils/index.js';
import { EMBED_IMAGE_MAX_BYTES } from '$lib/images.js';
import { readUploadedImage, uploadFilename } from '$lib/backend/storage/imageUpload.js';
import { saveEmbedImage, embedImageUrl } from '$lib/backend/storage/embedImages.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const upload = await readUploadedImage(request, EMBED_IMAGE_MAX_BYTES);
		if (!upload.ok) return json({ success: false, error: upload.error }, { status: upload.status });

		const prefix = locals.user.panel_id ? `global-${locals.user.panel_id}` : 'global';
		const filename = uploadFilename(prefix, upload.extension);
		await saveEmbedImage(filename, upload.data);

		return json({ success: true, url: embedImageUrl(filename), path: filename });
	} catch (error: any) {
		logger.log(`❌ Error uploading embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
