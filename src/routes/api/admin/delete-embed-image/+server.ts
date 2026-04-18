import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { logger } from '$lib/utils/index.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

function isGlobalEmbedFilename(filename: string): boolean {
	const safe = basename(filename);
	return /^global-\d+-[a-z0-9]+\.[a-z0-9]+$/i.test(safe);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { path: filename } = await request.json();
		if (!filename) {
			return json({ success: false, error: 'No filename provided' }, { status: 400 });
		}

		if (!isGlobalEmbedFilename(filename)) {
			return json({ success: false, error: 'Invalid or unsupported image path' }, { status: 400 });
		}

		const filePath = join(uploadsDir, basename(filename));
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}

		return json({ success: true });
	} catch (error: any) {
		logger.log(`❌ Error deleting embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
