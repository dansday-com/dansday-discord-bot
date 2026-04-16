import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { logger } from '$lib/utils/index.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

function embedFilenameBelongsToBot(filename: string, botId: number): boolean {
	const safe = basename(filename);
	const m = safe.match(/^bot-(\d+)-(\d+)-[a-z0-9]+\.[a-z0-9]+$/i);
	return m != null && Number(m[1]) === botId;
}

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const botId = parseInt(params.id ?? '', 10);
	if (!botId) {
		return json({ success: false, error: 'Invalid bot ID' }, { status: 400 });
	}

	if (!locals.user.authenticated || !(await accountOwnsBot(locals, botId))) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const { path: filename } = await request.json();
		if (!filename) {
			return json({ success: false, error: 'No filename provided' }, { status: 400 });
		}

		if (!embedFilenameBelongsToBot(filename, botId)) {
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
