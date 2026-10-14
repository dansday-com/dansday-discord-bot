import { BRAND_PRIMARY } from './brand.js';
import { type EffectFamily, normalizeEffect, normalizeSeed } from './effects.js';
import { RGB_MAX } from './utils/numbers.js';
import { type Rgb, hexToRgb, rgbToHex, relativeLuminance as rgbLuminance, weightedLightness } from './utils/rgb.js';

export type MemberTheme = {
	image: string | null;
	accent: string;
	accentAuto: boolean;
	effect: EffectFamily;
	ownedEffect: EffectFamily;
	effectEnabled: boolean;
	effectSeed: number;
};

export type MemberThemeRow = {
	image?: string | null;
	accent_color?: string | null;
	accent_auto?: boolean | number | null;
	effect?: string | null;
	effect_seed?: number | null;
	effect_enabled?: boolean | number | null;
};

export const DEFAULT_ACCENT = BRAND_PRIMARY;

const ACCENT_MIN_L = 0.3;
const ACCENT_MAX_L = 0.62;
const ACCENT_BLACK_L = 0.01;
const INK_LUMINANCE_THRESHOLD = 0.45;
const SECONDARY_SHIFT = 0.2;
const ACCENT_SHIFT = -0.25;
const DEEP_SHIFT = -0.45;
const SOFT_SHIFT = 0.35;
const ACCENT_SAMPLE_EDGE_PX = 32;
const RGBA_STRIDE = 4;
const ALPHA_OFFSET = 3;
const MIN_OPAQUE_ALPHA = 128;
const SAMPLE_MIN_LIGHTNESS = 0.12;
const SAMPLE_MAX_LIGHTNESS = 0.92;
const SATURATION_WEIGHT = 3;
const BUCKET_BITS = 4;

export function normalizeAccent(value: unknown): string | null {
	if (value == null) {
		return null;
	}
	const raw = String(value).trim();
	const withHash = raw.startsWith('#') ? raw : `#${raw}`;
	if (!/^#[0-9a-f]{6}$/i.test(withHash)) {
		return null;
	}
	return withHash.toLowerCase();
}

const towardWhite = ([r, g, b]: Rgb, amount: number): Rgb => [r + (RGB_MAX - r) * amount, g + (RGB_MAX - g) * amount, b + (RGB_MAX - b) * amount];

export function relativeLuminance(hex: string): number {
	return rgbLuminance(hexToRgb(hex));
}

export function accentInk(hex: unknown): string {
	const accent = normalizeAccent(hex) ?? DEFAULT_ACCENT;
	return relativeLuminance(accent) > INK_LUMINANCE_THRESHOLD ? '#241a16' : '#ffffff';
}

export function shiftAccent(hex: unknown, amount: number): string {
	const accent = normalizeAccent(hex) ?? DEFAULT_ACCENT;
	const [r, g, b] = hexToRgb(accent);
	if (amount >= 0) {
		return rgbToHex(towardWhite([r, g, b], amount));
	}
	const k = 1 + amount;
	return rgbToHex([r * k, g * k, b * k]);
}

function clampAccentLightness([r, g, b]: Rgb): string {
	const l = weightedLightness([r, g, b]);
	if (l >= ACCENT_MIN_L && l <= ACCENT_MAX_L) {
		return rgbToHex([r, g, b]);
	}
	if (l <= ACCENT_BLACK_L) {
		return DEFAULT_ACCENT;
	}
	const target = l < ACCENT_MIN_L ? ACCENT_MIN_L : ACCENT_MAX_L;
	if (l < ACCENT_MIN_L) {
		return rgbToHex(towardWhite([r, g, b], (target - l) / (1 - l)));
	}
	return rgbToHex([(r * target) / l, (g * target) / l, (b * target) / l]);
}

export function resolveMemberTheme(row: MemberThemeRow | null | undefined): MemberTheme | null {
	if (!row) {
		return null;
	}
	const image = row.image ? String(row.image) : null;
	const accent = normalizeAccent(row.accent_color);
	const ownedEffect = normalizeEffect(row.effect);
	const isEffectEnabled = row.effect_enabled !== false && row.effect_enabled !== 0;
	if (!image && !accent && ownedEffect === 'none') {
		return null;
	}
	return {
		image,
		accent: accent ?? DEFAULT_ACCENT,
		accentAuto: row.accent_auto !== false && row.accent_auto !== 0,
		effect: isEffectEnabled ? ownedEffect : 'none',
		ownedEffect,
		effectEnabled: isEffectEnabled,
		effectSeed: normalizeSeed(row.effect_seed)
	};
}

export function themeVars(theme: MemberTheme | null | undefined): string {
	if (!theme) {
		return '';
	}
	const accent = normalizeAccent(theme.accent) ?? DEFAULT_ACCENT;
	const secondary = shiftAccent(accent, SECONDARY_SHIFT);
	const deep = shiftAccent(accent, ACCENT_SHIFT);
	return [
		`--theme-accent: ${accent}`,
		`--theme-accent-deep: ${shiftAccent(accent, DEEP_SHIFT)}`,
		`--theme-accent-soft: ${shiftAccent(accent, SOFT_SHIFT)}`,
		`--theme-ink: ${accentInk(accent)}`,
		`--color-primary: ${accent}`,
		`--color-primary-content: ${accentInk(accent)}`,
		`--color-secondary: ${secondary}`,
		`--color-secondary-content: ${accentInk(secondary)}`,
		`--color-accent: ${deep}`,
		`--color-accent-content: ${accentInk(deep)}`
	].join('; ');
}

export const THEME_WEBP_MAX_EDGE = 1600;
export const THEME_WEBP_QUALITY = 0.85;

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

export async function prepareThemeUpload(file: File): Promise<{ file: File; accent: string }> {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImageElement(url);
		if (!img) {
			return { file, accent: DEFAULT_ACCENT };
		}
		const accent = accentFromImage(img);
		if (file.type === 'image/gif') {
			return { file, accent };
		}
		return { file: (await encodeWebp(img, file)) ?? file, accent };
	} catch {
		return { file, accent: DEFAULT_ACCENT };
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function encodeWebp(img: HTMLImageElement, source: File): Promise<File | null> {
	if (typeof document === 'undefined') {
		return null;
	}
	const width = img.naturalWidth || img.width;
	const height = img.naturalHeight || img.height;
	if (!width || !height) {
		return null;
	}

	const scale = Math.min(1, THEME_WEBP_MAX_EDGE / Math.max(width, height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', THEME_WEBP_QUALITY));
	if (!blob || blob.type !== 'image/webp') {
		return null;
	}
	if (blob.size >= source.size && scale === 1) {
		return null;
	}

	const name = `${source.name.replace(/\.[^.]+$/, '') || 'theme'}.webp`;
	return new File([blob], name, { type: 'image/webp' });
}

export async function extractAccentFromFile(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		return await extractAccentFromUrl(url);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function extractAccentFromUrl(src: string): Promise<string> {
	return loadImageElement(src).then((img) => (img ? accentFromImage(img) : DEFAULT_ACCENT));
}

function accentFromImage(img: HTMLImageElement): string {
	const size = ACCENT_SAMPLE_EDGE_PX;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		return DEFAULT_ACCENT;
	}

	try {
		ctx.drawImage(img, 0, 0, size, size);
		const { data } = ctx.getImageData(0, 0, size, size);
		const buckets = new Map<number, { r: number; g: number; b: number; weight: number }>();
		let fallbackR = 0;
		let fallbackG = 0;
		let fallbackB = 0;
		let fallbackN = 0;

		for (let i = 0; i < data.length; i += RGBA_STRIDE) {
			const a = data[i + ALPHA_OFFSET];
			if (a < MIN_OPAQUE_ALPHA) {
				continue;
			}
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];

			fallbackR += r;
			fallbackG += g;
			fallbackB += b;
			fallbackN++;

			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const lightness = (max + min) / (2 * RGB_MAX);
			if (lightness < SAMPLE_MIN_LIGHTNESS || lightness > SAMPLE_MAX_LIGHTNESS) {
				continue;
			}
			const delta = max - min;
			const saturation = delta === 0 ? 0 : delta / (RGB_MAX - Math.abs(max + min - RGB_MAX));

			const weight = 1 + saturation * SATURATION_WEIGHT;
			const key = ((r >> BUCKET_BITS) << (2 * BUCKET_BITS)) | ((g >> BUCKET_BITS) << BUCKET_BITS) | (b >> BUCKET_BITS);
			const bucket = buckets.get(key);
			if (bucket) {
				bucket.r += r * weight;
				bucket.g += g * weight;
				bucket.b += b * weight;
				bucket.weight += weight;
			} else {
				buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, weight });
			}
		}

		let best: { r: number; g: number; b: number; weight: number } | null = null;
		for (const bucket of buckets.values()) {
			if (!best || bucket.weight > best.weight) {
				best = bucket;
			}
		}

		if (best) {
			return clampAccentLightness([best.r / best.weight, best.g / best.weight, best.b / best.weight]);
		}
		if (fallbackN > 0) {
			return clampAccentLightness([fallbackR / fallbackN, fallbackG / fallbackN, fallbackB / fallbackN]);
		}
		return DEFAULT_ACCENT;
	} catch {
		return DEFAULT_ACCENT;
	}
}
