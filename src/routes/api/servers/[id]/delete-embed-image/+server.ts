import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { logger } from '$lib/utils/index.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

function embedFilenameBelongsToServer(filename: string, serverId: number): boolean {
	const safe = basename(filename);
	const m = safe.match(/^(\d+)-(\d+)-[a-z0-9]+\.[a-z0-9]+$/i);
	return m != null && Number(m[1]) === serverId;
}

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

		if (!embedFilenameBelongsToServer(filename, serverId)) {
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
