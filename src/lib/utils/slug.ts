const LETTERFORM_FOLD: Record<string, string> = {
	ɢ: 'g',
	ʙ: 'b',
	ʜ: 'h',
	ɪ: 'i',
	ʟ: 'l',
	ɴ: 'n',
	ʀ: 'r',
	ᴀ: 'a',
	ᴄ: 'c',
	ᴅ: 'd',
	ᴇ: 'e',
	ᴊ: 'j',
	ᴋ: 'k',
	ᴍ: 'm',
	ᴏ: 'o',
	ᴘ: 'p',
	ᴛ: 't',
	ᴜ: 'u',
	ᴠ: 'v',
	ᴡ: 'w',
	ʏ: 'y',
	ᴢ: 'z',
	ꜰ: 'f',
	ǫ: 'q',
	ѕ: 's',
	х: 'x',
	ᴠ̇: 'v',
	ø: 'o',
	đ: 'd',
	ł: 'l',
	ħ: 'h',
	ŧ: 't',
	ı: 'i',
	œ: 'oe',
	æ: 'ae',
	ß: 'ss',
	ð: 'd',
	þ: 'th'
};

const CYRILLIC_LOOKALIKES = new Set(['ѕ', 'х']);

const LATIN_LETTERS = 26;
const DECIMAL_DIGITS = 10;
const ASCII_UPPER_A = 0x41;
const ASCII_LOWER_A = 0x61;
const ASCII_ZERO = 0x30;
const MATH_ALPHANUMERIC_START = 0x1d400;
const MATH_ALPHANUMERIC_END = 0x1d7ff;
const MATH_LETTER_STYLES = 13;
const MATH_LETTER_BLOCK = 2 * LATIN_LETTERS;
const MATH_LETTERS_END = MATH_ALPHANUMERIC_START + MATH_LETTER_STYLES * MATH_LETTER_BLOCK - 1;
const MATH_DIGITS_START = 0x1d7ce;
const FULLWIDTH_OFFSET = 0xfee0;
const FULLWIDTH_LETTERS = { from: 0xff21, to: 0xff5a };
const FULLWIDTH_DIGITS = { from: 0xff10, to: 0xff19 };

const inRange = (code: number, range: { from: number; to: number }) => code >= range.from && code <= range.to;

function foldLetterforms(input: string): string {
	const hasCyrillicText = /[\u0400-\u04ff]/.test(input.replace(/[ѕх]/g, ''));
	let out = '';
	for (const ch of input) {
		const mapped = LETTERFORM_FOLD[ch];
		if (mapped !== undefined && !(hasCyrillicText && CYRILLIC_LOOKALIKES.has(ch))) {
			out += mapped;
			continue;
		}
		const code = ch.codePointAt(0)!;
		if (code >= MATH_ALPHANUMERIC_START && code <= MATH_ALPHANUMERIC_END) {
			const folded = foldMathAlphanumeric(code);
			if (folded) {
				out += folded;
				continue;
			}
		}
		if (inRange(code, FULLWIDTH_LETTERS) || inRange(code, FULLWIDTH_DIGITS)) {
			out += String.fromCharCode(code - FULLWIDTH_OFFSET);
			continue;
		}
		out += ch;
	}
	return out;
}

function foldMathAlphanumeric(code: number): string | null {
	if (code >= MATH_ALPHANUMERIC_START && code <= MATH_LETTERS_END) {
		const offset = (code - MATH_ALPHANUMERIC_START) % MATH_LETTER_BLOCK;
		return offset < LATIN_LETTERS ? String.fromCharCode(ASCII_UPPER_A + offset) : String.fromCharCode(ASCII_LOWER_A + (offset - LATIN_LETTERS));
	}
	if (code >= MATH_DIGITS_START && code <= MATH_ALPHANUMERIC_END) {
		return String.fromCharCode(ASCII_ZERO + ((code - MATH_DIGITS_START) % DECIMAL_DIGITS));
	}
	return null;
}

const SLUG_UNIT = /[a-z]|\p{Nd}|(?![\p{Script=Latin}\u02b0-\u02ff])[\p{Ll}\p{Lm}\p{Lo}]\p{M}*/gu;

export function slugifyDisplayName(input: string, emptyFallback = 'item'): string {
	const units = foldLetterforms(String(input ?? ''))
		.toLowerCase()
		.normalize('NFKD')
		.replace(/\p{Default_Ignorable_Code_Point}/gu, '')
		.replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
		.match(SLUG_UNIT);
	const s = (units ?? []).join('').normalize('NFC');
	return s || emptyFallback;
}

export function parseIndexedSlug(slug: string): { base: string; index: number } {
	const s = String(slug ?? '')
		.trim()
		.toLowerCase()
		.normalize('NFC');
	if (!s) {
		return { base: '', index: 1 };
	}
	const m = s.match(/^(.*?)(?:_(\d+))$/);
	if (!m) {
		return { base: s, index: 1 };
	}
	const base = (m[1] || '').trim();
	const idx = Number(m[2]);
	if (!base || !Number.isFinite(idx) || idx < 1) {
		return { base: s, index: 1 };
	}
	return { base, index: idx + 1 };
}

export function formatIndexedSlug(base: string, index: number): string {
	if (index <= 1) {
		return base;
	}
	return `${base}_${index - 1}`;
}

type WithId = { id: number };

export function resolveIndexedSlugToItem<T extends WithId>(
	requestedSlug: string,
	items: T[],
	slugKey: (row: T) => string
): { item: T; computedSlug: string } | null {
	const { base, index } = parseIndexedSlug(requestedSlug);
	if (!base) {
		return null;
	}
	const matches = items
		.map((row) => ({ row, base: slugifyDisplayName(slugKey(row), 'item') }))
		.filter((x) => x.base === base)
		.sort((a, b) => Number(a.row.id) - Number(b.row.id));
	const picked = matches[index - 1];
	if (!picked) {
		return null;
	}
	return { item: picked.row, computedSlug: formatIndexedSlug(base, index) };
}

export function computeIndexedSlugForItemId<T extends WithId>(itemId: number, items: T[], slugKey: (row: T) => string): string | null {
	const current = items.find((s) => Number(s.id) === Number(itemId));
	if (!current) {
		return null;
	}
	const base = slugifyDisplayName(slugKey(current), 'item');
	const matches = items.filter((s) => slugifyDisplayName(slugKey(s), 'item') === base).sort((a, b) => Number(a.id) - Number(b.id));
	const idx = matches.findIndex((s) => Number(s.id) === Number(itemId));
	if (idx < 0) {
		return null;
	}
	return formatIndexedSlug(base, idx + 1);
}

export function listIndexedSlugsForItems<T extends WithId>(
	items: T[],
	slugKey: (row: T) => string,
	updatedAt: (row: T) => unknown = (row) => (row as { updated_at?: unknown }).updated_at
): { slug: string; updated_at: unknown; item: T }[] {
	const groups = new Map<string, T[]>();
	for (const row of items) {
		const base = slugifyDisplayName(slugKey(row), 'item');
		if (!groups.has(base)) {
			groups.set(base, []);
		}
		groups.get(base)!.push(row);
	}
	const out: { slug: string; updated_at: unknown; item: T }[] = [];
	for (const [base, list] of groups) {
		list.sort((a, b) => Number(a.id) - Number(b.id));
		for (let i = 0; i < list.length; i++) {
			out.push({ slug: formatIndexedSlug(base, i + 1), updated_at: updatedAt(list[i]), item: list[i] });
		}
	}
	return out;
}
