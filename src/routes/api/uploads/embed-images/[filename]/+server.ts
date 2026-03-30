import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

const CONTENT_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp'
};

const FILENAME_PATTERN = /^\d+-[a-z0-9]+\.(jpg|jpeg|png|gif|webp)$/i;

export const GET: RequestHandler = ({ params }) => {
	const filename = params.filename ?? '';

	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		return new Response(JSON.stringify({ error: 'Invalid filename' }), { status: 400 });
	}

	if (!FILENAME_PATTERN.test(filename)) {
		return new Response(JSON.stringify({ error: 'Invalid filename format' }), { status: 400 });
	}

	const filePath = join(uploadsDir, filename);
	if (!existsSync(filePath)) {
		return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
	}

	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

	const data = readFileSync(filePath);
	return new Response(data, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'no-store, no-cache, must-revalidate, private',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
