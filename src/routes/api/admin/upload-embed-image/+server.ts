import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '$lib/utils/index.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const supportedFormats = ['jpg', 'png', 'gif', 'webp'];
		const contentType = request.headers.get('content-type') || '';
		let fileExtension = '';
		let imageData: Buffer | null = null;

		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData();
			const file = form.get('image');
			if (!(file instanceof File)) return json({ success: false, error: 'No image file provided' }, { status: 400 });
			const mime = (file.type || '').toLowerCase();
			if (!mime.startsWith('image/')) return json({ success: false, error: 'Invalid image format' }, { status: 400 });
			fileExtension = mime.replace('image/', '').toLowerCase();
			if (fileExtension === 'jpeg') fileExtension = 'jpg';
			if (!supportedFormats.includes(fileExtension))
				return json({ success: false, error: `Unsupported image format. Supported: ${supportedFormats.join(', ')}` }, { status: 400 });
			imageData = Buffer.from(await file.arrayBuffer());
		} else {
			const body = await request.json();
			if (!body?.image) return json({ success: false, error: 'No image file provided' }, { status: 400 });
			if (!body.image.startsWith('data:image/')) return json({ success: false, error: 'Invalid image format' }, { status: 400 });
			const matches = body.image.match(/^data:image\/(\w+);base64,(.+)$/);
			if (!matches) return json({ success: false, error: 'Invalid image data format' }, { status: 400 });
			fileExtension = String(matches[1]).toLowerCase();
			if (fileExtension === 'jpeg') fileExtension = 'jpg';
			if (!supportedFormats.includes(fileExtension))
				return json({ success: false, error: `Unsupported image format. Supported: ${supportedFormats.join(', ')}` }, { status: 400 });
			imageData = Buffer.from(matches[2], 'base64');
		}

		if (!imageData) return json({ success: false, error: 'No image file provided' }, { status: 400 });
		if (imageData.length > 10 * 1024 * 1024) return json({ success: false, error: 'Image file is too large. Maximum size is 10MB' }, { status: 400 });

		if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
		const filename = `global-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
		writeFileSync(join(uploadsDir, filename), imageData);

		return json({ success: true, url: `/api/uploads/embed-images/${filename}`, path: filename });
	} catch (error: any) {
		logger.log(`❌ Error uploading embed image: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
