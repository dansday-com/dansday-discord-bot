import { type ImageFormat, imageExtension, tooLargeMessage, unsupportedFormatMessage } from '../../images.js';

export type ImageUpload = { ok: true; data: Buffer; extension: ImageFormat; form: FormData | null; body: any } | { ok: false; error: string; status: number };

const DATA_URL_PATTERN = /^data:image\/(\w+);base64,(.+)$/;

export async function readUploadedImage(request: Request, maxBytes: number): Promise<ImageUpload> {
	const contentType = request.headers.get('content-type') || '';

	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const file = form.get('image');
		if (!(file instanceof File)) return { ok: false, error: 'No image file provided', status: 400 };

		const extension = imageExtension(file.type);
		if (!extension) return { ok: false, error: unsupportedFormatMessage(), status: 400 };
		if (file.size > maxBytes) return { ok: false, error: tooLargeMessage(maxBytes), status: 400 };

		const data = Buffer.from(await file.arrayBuffer());
		if (data.length > maxBytes) return { ok: false, error: tooLargeMessage(maxBytes), status: 400 };
		return { ok: true, data, extension, form, body: null };
	}

	const body = await request.json().catch(() => null);
	if (!body?.image) return { ok: false, error: 'No image file provided', status: 400 };

	const matches = String(body.image).match(DATA_URL_PATTERN);
	if (!matches) return { ok: false, error: 'Invalid image data format', status: 400 };

	const extension = imageExtension(matches[1]);
	if (!extension) return { ok: false, error: unsupportedFormatMessage(), status: 400 };

	const data = Buffer.from(matches[2], 'base64');
	if (data.length > maxBytes) return { ok: false, error: tooLargeMessage(maxBytes), status: 400 };
	return { ok: true, data, extension, form: null, body };
}

export function uploadFilename(prefix: string, extension: ImageFormat): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}
