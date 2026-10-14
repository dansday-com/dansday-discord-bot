import { BYTES_PER_KB, BYTES_PER_MB, HEX_RADIX } from './utils/numbers.js';

const MEMBER_THEME_MAX_MB = 10;
const BOT_AVATAR_MAX_MB = 2;
const BOT_BANNER_MAX_MB = 4;
const IMAGE_MIME_PREFIX = 'image/';
const CROP_IMAGE_QUALITY = 0.9;
const SIGNATURE_SNIFF_BYTES = 8;

export const IMAGE_FORMATS = ['png', 'jpg', 'gif', 'webp'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const IMAGE_FILENAME_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
export const IMAGE_FORMATS_LABEL = 'PNG, JPG, GIF, WEBP';

export const MEMBER_THEME_MAX_BYTES = MEMBER_THEME_MAX_MB * BYTES_PER_MB;

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

export function imageExtension(value: unknown): ImageFormat | null {
	let ext = String(value ?? '')
		.toLowerCase()
		.trim();
	if (ext.startsWith(IMAGE_MIME_PREFIX)) {
		ext = ext.slice(IMAGE_MIME_PREFIX.length);
	}
	if (ext === 'jpeg') {
		ext = 'jpg';
	}
	return (IMAGE_FORMATS as readonly string[]).includes(ext) ? (ext as ImageFormat) : null;
}

export function imageFilenamePattern(stem: string): RegExp {
	return new RegExp(`^(?:${stem})\\.(${IMAGE_FILENAME_EXTENSIONS.join('|')})$`, 'i');
}

export function imageSizeLabel(bytes: number): string {
	if (bytes >= BYTES_PER_MB) {
		const mb = bytes / BYTES_PER_MB;
		return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
	}
	return `${Math.round(bytes / BYTES_PER_KB)}KB`;
}

export function unsupportedFormatMessage(): string {
	return `Unsupported image format. Supported: ${IMAGE_FORMATS_LABEL}`;
}

export function tooLargeMessage(maxBytes: number): string {
	return `Image file is too large. Maximum size is ${imageSizeLabel(maxBytes)}`;
}

export const BOT_PROFILE_IMAGE = {
	avatar: { label: 'Avatar', width: 512, height: 512, maxBytes: BOT_AVATAR_MAX_MB * BYTES_PER_MB },
	banner: { label: 'Banner', width: 1200, height: 480, maxBytes: BOT_BANNER_MAX_MB * BYTES_PER_MB }
} as const;
export type BotProfileImageKind = keyof typeof BOT_PROFILE_IMAGE;

export const BOT_PROFILE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif';
export const BOT_PROFILE_IMAGE_FORMATS_LABEL = 'PNG, JPG or GIF';

export const IMAGE_SIGNATURE_HEX = { png: '89504e47', jpeg: 'ffd8ff', gif: '47494638' } as const;

const BOT_PROFILE_SIGNATURES = [
	{ type: 'image/png', hex: IMAGE_SIGNATURE_HEX.png },
	{ type: 'image/jpeg', hex: IMAGE_SIGNATURE_HEX.jpeg },
	{ type: 'image/gif', hex: IMAGE_SIGNATURE_HEX.gif }
];
const HEX_DIGITS_PER_BYTE = 2;
const LONGEST_SIGNATURE_BYTES = Math.max(...BOT_PROFILE_SIGNATURES.map((s) => s.hex.length / HEX_DIGITS_PER_BYTE));

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0')).join('');

export function sniffBotProfileImage(bytes: Uint8Array): string | null {
	const header = toHex(bytes.subarray(0, LONGEST_SIGNATURE_BYTES));
	return BOT_PROFILE_SIGNATURES.find((s) => header.startsWith(s.hex))?.type ?? null;
}

function readDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
		reader.readAsDataURL(blob);
	});
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Could not read the image'));
		img.src = src;
	});
}

async function cropBotProfileImage(file: File, kind: BotProfileImageKind, type: string): Promise<Blob> {
	const spec = BOT_PROFILE_IMAGE[kind];
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
		const aspect = spec.width / spec.height;
		const srcW = img.naturalWidth || img.width;
		const srcH = img.naturalHeight || img.height;
		const cropW = Math.min(srcW, srcH * aspect);
		const cropH = cropW / aspect;
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(Math.min(spec.width, cropW)));
		canvas.height = Math.max(1, Math.round(canvas.width / aspect));
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Could not read the image');
		}
		ctx.drawImage(img, (srcW - cropW) / 2, (srcH - cropH) / 2, cropW, cropH, 0, 0, canvas.width, canvas.height);
		const outType = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, CROP_IMAGE_QUALITY));
		if (!blob) {
			throw new Error('Could not read the image');
		}
		return blob;
	} finally {
		URL.revokeObjectURL(url);
	}
}

export async function prepareBotProfileImage(file: File, kind: BotProfileImageKind): Promise<string> {
	const spec = BOT_PROFILE_IMAGE[kind];
	const type = sniffBotProfileImage(new Uint8Array(await file.slice(0, SIGNATURE_SNIFF_BYTES).arrayBuffer()));
	if (!type) {
		throw new Error(`${spec.label} must be ${BOT_PROFILE_IMAGE_FORMATS_LABEL}`);
	}
	if (type === 'image/gif' && file.size <= spec.maxBytes) {
		return readDataUrl(new Blob([file], { type }));
	}
	const blob = await cropBotProfileImage(file, kind, type);
	if (blob.size > spec.maxBytes) {
		throw new Error(`${spec.label}: ${tooLargeMessage(spec.maxBytes)}`);
	}
	return readDataUrl(blob);
}
