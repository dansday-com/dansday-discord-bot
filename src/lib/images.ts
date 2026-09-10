export const IMAGE_FORMATS = ['png', 'jpg', 'gif', 'webp'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const IMAGE_FILENAME_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
export const IMAGE_FORMATS_LABEL = 'PNG, JPG, GIF, WEBP';

export const EMBED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MEMBER_THEME_MAX_BYTES = 1024 * 1024;
export const MEMBER_THEME_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp'
};

export function imageContentType(filename: string): string {
	const ext = String(filename).split('.').pop()?.toLowerCase() ?? '';
	return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export function imageExtension(value: any): ImageFormat | null {
	let ext = String(value ?? '')
		.toLowerCase()
		.trim();
	if (ext.startsWith('image/')) ext = ext.slice(6);
	if (ext === 'jpeg') ext = 'jpg';
	return (IMAGE_FORMATS as readonly string[]).includes(ext) ? (ext as ImageFormat) : null;
}

export function imageFilenamePattern(stem: string): RegExp {
	return new RegExp(`^(?:${stem})\\.(${IMAGE_FILENAME_EXTENSIONS.join('|')})$`, 'i');
}

export function imageSizeLabel(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		const mb = bytes / (1024 * 1024);
		return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
	}
	return `${Math.round(bytes / 1024)}KB`;
}

export function unsupportedFormatMessage(): string {
	return `Unsupported image format. Supported: ${IMAGE_FORMATS_LABEL}`;
}

export function tooLargeMessage(maxBytes: number): string {
	return `Image file is too large. Maximum size is ${imageSizeLabel(maxBytes)}`;
}
