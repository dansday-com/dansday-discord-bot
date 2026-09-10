import { BRAND_PRIMARY } from './brand.js';

export type MemberTheme = {
	image: string | null;
	accent: string;
	accentAuto: boolean;
};

export type MemberThemeRow = {
	image?: string | null;
	accent_color?: string | null;
	accent_auto?: boolean | number | null;
};

export const DEFAULT_ACCENT = BRAND_PRIMARY;

const ACCENT_MIN_L = 0.3;
const ACCENT_MAX_L = 0.62;

export function normalizeAccent(value: any): string | null {
	if (value == null) return null;
	const raw = String(value).trim();
	const withHash = raw.startsWith('#') ? raw : `#${raw}`;
	if (!/^#[0-9a-f]{6}$/i.test(withHash)) return null;
	return withHash.toLowerCase();
}

function toRgb(hex: string): [number, number, number] {
	return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex(r: number, g: number, b: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
	return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function channelLuminance(c: number): number {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
	const [r, g, b] = toRgb(hex);
	return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

export function accentInk(hex: any): string {
	const accent = normalizeAccent(hex) ?? DEFAULT_ACCENT;
	return relativeLuminance(accent) > 0.45 ? '#241a16' : '#ffffff';
}

export function shiftAccent(hex: any, amount: number): string {
	const accent = normalizeAccent(hex) ?? DEFAULT_ACCENT;
	const [r, g, b] = toRgb(accent);
	if (amount >= 0) return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
	const k = 1 + amount;
	return toHex(r * k, g * k, b * k);
}

function clampAccentLightness(r: number, g: number, b: number): string {
	const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	if (l >= ACCENT_MIN_L && l <= ACCENT_MAX_L) return toHex(r, g, b);
	if (l <= 0.01) return DEFAULT_ACCENT;
	const target = l < ACCENT_MIN_L ? ACCENT_MIN_L : ACCENT_MAX_L;
	if (l < ACCENT_MIN_L) {
		const t = (target - l) / (1 - l);
		return toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
	}
	return toHex((r * target) / l, (g * target) / l, (b * target) / l);
}

export function resolveMemberTheme(row: MemberThemeRow | null | undefined): MemberTheme | null {
	if (!row) return null;
	const image = row.image ? String(row.image) : null;
	const accent = normalizeAccent(row.accent_color);
	if (!image && !accent) return null;
	return {
		image,
		accent: accent ?? DEFAULT_ACCENT,
		accentAuto: row.accent_auto !== false && row.accent_auto !== 0
	};
}

export function themeVars(theme: MemberTheme | null | undefined): string {
	if (!theme) return '';
	const accent = normalizeAccent(theme.accent) ?? DEFAULT_ACCENT;
	const secondary = shiftAccent(accent, 0.2);
	const deep = shiftAccent(accent, -0.25);
	return [
		`--theme-accent: ${accent}`,
		`--theme-accent-deep: ${shiftAccent(accent, -0.45)}`,
		`--theme-accent-soft: ${shiftAccent(accent, 0.35)}`,
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
		if (!img) return { file, accent: DEFAULT_ACCENT };
		const accent = accentFromImage(img);
		if (file.type === 'image/gif') return { file, accent };
		return { file: (await encodeWebp(img, file)) ?? file, accent };
	} catch {
		return { file, accent: DEFAULT_ACCENT };
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function encodeWebp(img: HTMLImageElement, source: File): Promise<File | null> {
	if (typeof document === 'undefined') return null;
	const width = img.naturalWidth || img.width;
	const height = img.naturalHeight || img.height;
	if (!width || !height) return null;

	const scale = Math.min(1, THEME_WEBP_MAX_EDGE / Math.max(width, height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));

	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', THEME_WEBP_QUALITY));
	if (!blob || blob.type !== 'image/webp') return null;
	if (blob.size >= source.size && scale === 1) return null;

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
	const size = 32;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return DEFAULT_ACCENT;

	try {
		ctx.drawImage(img, 0, 0, size, size);
		const { data } = ctx.getImageData(0, 0, size, size);
		const buckets = new Map<number, { r: number; g: number; b: number; weight: number }>();
		let fallbackR = 0;
		let fallbackG = 0;
		let fallbackB = 0;
		let fallbackN = 0;

		for (let i = 0; i < data.length; i += 4) {
			const a = data[i + 3];
			if (a < 128) continue;
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];

			fallbackR += r;
			fallbackG += g;
			fallbackB += b;
			fallbackN++;

			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const lightness = (max + min) / 510;
			if (lightness < 0.12 || lightness > 0.92) continue;
			const delta = max - min;
			const saturation = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255));

			const weight = 1 + saturation * 3;
			const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
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
			if (!best || bucket.weight > best.weight) best = bucket;
		}

		if (best) return clampAccentLightness(best.r / best.weight, best.g / best.weight, best.b / best.weight);
		if (fallbackN > 0) return clampAccentLightness(fallbackR / fallbackN, fallbackG / fallbackN, fallbackB / fallbackN);
		return DEFAULT_ACCENT;
	} catch {
		return DEFAULT_ACCENT;
	}
}
