import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/utils/index.js';
import { embedAdminScope, embedKeyBelongsTo, removeEmbedImage } from '$lib/backend/storage/embedImages.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { path: filename } = await request.json();
		if (!filename) {
			return json({ success: false, error: 'No filename provided' }, { status: 400 });
		}

		if (!embedKeyBelongsTo(filename, embedAdminScope(locals.user.panel_id))) {
			return json({ success: false, error: 'Invalid or unsupported image path' }, { status: 400 });
		}

		await removeEmbedImage(filename);

		return json({ success: true });
	} catch (error: any) {
		logger.log(`❌ Error deleting embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
