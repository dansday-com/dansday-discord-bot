const LETTERFORM_FOLD: Record<string, string> = {
	\u0262: 'g',
	\u0299: 'b',
	\u029c: 'h',
	\u026a: 'i',
	\u029f: 'l',
	\u0274: 'n',
	\u0280: 'r',
	\u1d00: 'a',
	\u1d04: 'c',
	\u1d05: 'd',
	\u1d07: 'e',
	\u1d0a: 'j',
	\u1d0b: 'k',
	\u1d0d: 'm',
	\u1d0f: 'o',
	\u1d18: 'p',
	\u1d1b: 't',
	\u1d1c: 'u',
	\u1d20: 'v',
	\u1d21: 'w',
	\u028f: 'y',
	\u1d22: 'z',
	\ua730: 'f',
	\u01eb: 'q',
	\u0455: 's',
	\u0445: 'x',
	\u1d20\u0307: 'v',
	\u00f8: 'o',
	\u0111: 'd',
	\u0142: 'l',
	\u0127: 'h',
	\u0167: 't',
	\u0131: 'i',
	\u0153: 'oe',
	\u00e6: 'ae',
	\u00df: 'ss',
	\u00f0: 'd',
	\u00fe: 'th'
};

function foldLetterforms(input: string): string {
	let out = '';
	for (const ch of input) {
		const mapped = LETTERFORM_FOLD[ch];
		if (mapped !== undefined) {
			out += mapped;
			continue;
		}
		const code = ch.codePointAt(0)!;
		if (code >= 0x1d400 && code <= 0x1d7ff) {
			const folded = foldMathAlphanumeric(code);
			if (folded) {
				out += folded;
				continue;
			}
		}
		if (code >= 0xff21 && code <= 0xff5a) {
			out += String.fromCharCode(code - 0xfee0);
			continue;
		}
		if (code >= 0xff10 && code <= 0xff19) {
			out += String.fromCharCode(code - 0xfee0);
			continue;
		}
		out += ch;
	}
	return out;
}

function foldMathAlphanumeric(code: number): string | null {
	const blocks: [number, number, string][] = [
		[0x1d400, 0x1d433, 'Aa'],
		[0x1d434, 0x1d467, 'Aa'],
		[0x1d468, 0x1d49b, 'Aa'],
		[0x1d49c, 0x1d4cf, 'Aa'],
		[0x1d4d0, 0x1d503, 'Aa'],
		[0x1d504, 0x1d537, 'Aa'],
		[0x1d538, 0x1d56b, 'Aa'],
		[0x1d56c, 0x1d59f, 'Aa'],
		[0x1d5a0, 0x1d5d3, 'Aa'],
		[0x1d5d4, 0x1d607, 'Aa'],
		[0x1d608, 0x1d63b, 'Aa'],
		[0x1d63c, 0x1d66f, 'Aa'],
		[0x1d670, 0x1d6a3, 'Aa']
	];
	for (const [start, end] of blocks) {
		if (code < start || code > end) continue;
		const offset = code - start;
		if (offset < 26) return String.fromCharCode(0x41 + offset);
		if (offset < 52) return String.fromCharCode(0x61 + (offset - 26));
		return null;
	}
	if (code >= 0x1d7ce && code <= 0x1d7ff) return String.fromCharCode(0x30 + ((code - 0x1d7ce) % 10));
	return null;
}

export function slugifyDisplayName(input: string, emptyFallback = 'item'): string {
	const s = foldLetterforms(String(input ?? ''))
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '')
		.trim();
	return s || emptyFallback;
}

export function slugifyServerName(input: string): string {
	return slugifyDisplayName(input, 'server');
}

export function slugifyBotName(input: string): string {
	return slugifyDisplayName(input, 'bot');
}

export function parseIndexedSlug(slug: string): { base: string; index: number } {
	const s = String(slug ?? '')
		.trim()
		.toLowerCase();
	if (!s) return { base: '', index: 1 };
	const m = s.match(/^(.*?)(?:_(\d+))$/);
	if (!m) return { base: s, index: 1 };
	const base = (m[1] || '').trim();
	const idx = Number(m[2]);
	if (!base || !Number.isFinite(idx) || idx < 1) return { base: s, index: 1 };
	return { base, index: idx + 1 };
}

export function formatIndexedSlug(base: string, index: number): string {
	if (index <= 1) return base;
	return `${base}_${index - 1}`;
}

type WithId = { id: number };

export function resolveIndexedSlugToItem<T extends WithId>(
	requestedSlug: string,
	items: T[],
	slugKey: (row: T) => string
): { item: T; computedSlug: string } | null {
	const { base, index } = parseIndexedSlug(requestedSlug);
	if (!base) return null;
	const matches = items
		.map((row) => ({ row, base: slugifyDisplayName(slugKey(row), 'item') }))
		.filter((x) => x.base === base)
		.sort((a, b) => Number(a.row.id) - Number(b.row.id));
	const picked = matches[index - 1];
	if (!picked) return null;
	return { item: picked.row, computedSlug: formatIndexedSlug(base, index) };
}

export function computeIndexedSlugForItemId<T extends WithId>(itemId: number, items: T[], slugKey: (row: T) => string): string | null {
	const current = items.find((s) => Number(s.id) === Number(itemId));
	if (!current) return null;
	const base = slugifyDisplayName(slugKey(current), 'item');
	const matches = items.filter((s) => slugifyDisplayName(slugKey(s), 'item') === base).sort((a, b) => Number(a.id) - Number(b.id));
	const idx = matches.findIndex((s) => Number(s.id) === Number(itemId));
	if (idx < 0) return null;
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
		if (!groups.has(base)) groups.set(base, []);
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

export function slugifyName(input: string) {
	const s = foldLetterforms(String(input || ''))
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');
	return s || 'item';
}

export function parseSlugWithIndex(slug: string): { base: string; index: number } {
	const s = String(slug || '')
		.trim()
		.toLowerCase();
	if (!s) return { base: '', index: 1 };
	const m = s.match(/^(.*?)-(\d+)$/);
	if (!m) return { base: s, index: 1 };
	const base = (m[1] || '').trim();
	const idx = Number(m[2]);
	if (!base || !Number.isFinite(idx) || idx < 2) return { base: s, index: 1 };
	return { base, index: idx };
}
