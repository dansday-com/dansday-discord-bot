import type { ImageFormat } from '../../images.js';

export type ConvertedImage = { data: Buffer; extension: ImageFormat };

const STILL_MAX_EDGE = 1600;
const ANIMATED_MAX_EDGE = 1000;
const QUALITY = 82;
const STILL_EFFORT = 5;
const ANIMATED_EFFORT = 4;

export async function themeImageToWebp(data: Buffer, extension: ImageFormat): Promise<ConvertedImage> {
	const animated = extension === 'gif';

	try {
		const sharp = (await import('sharp')).default;
		const pipeline = sharp(data, animated ? { animated: true } : {}).rotate();

		const maxEdge = animated ? ANIMATED_MAX_EDGE : STILL_MAX_EDGE;
		pipeline.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });

		const encoded = await pipeline
			.webp(animated ? { quality: QUALITY, effort: ANIMATED_EFFORT, loop: 0 } : { quality: QUALITY, effort: STILL_EFFORT })
			.toBuffer();

		if (encoded.length >= data.length && extension === 'webp') return { data, extension };
		if (encoded.length >= data.length && animated) return { data, extension };
		return { data: encoded, extension: 'webp' };
	} catch {
		return { data, extension };
	}
}
