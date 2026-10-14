const MULBERRY_INCREMENT = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_MIX = 61;
const UINT32_RANGE = 4294967296;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + MULBERRY_INCREMENT) >>> 0;
		let t = Math.imul(a ^ (a >>> MULBERRY_SHIFT_A), 1 | a);
		t = (t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), MULBERRY_MIX | t)) ^ t;
		return ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
	};
}

export function fnv1a(text: string) {
	let h = FNV_OFFSET_BASIS;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, FNV_PRIME);
	}
	return h >>> 0;
}
