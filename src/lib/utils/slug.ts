/** URL slug helpers. DB-backed leaderboard URLs: `$lib/leaderboard/slugs.ts`. */

export function slugifyDisplayName(input: string, emptyFallback = 'item'): string {
	const s = String(input ?? '')
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
): { slug: string; updated_at: unknown }[] {
	const groups = new Map<string, T[]>();
	for (const row of items) {
		const base = slugifyDisplayName(slugKey(row), 'item');
		if (!groups.has(base)) groups.set(base, []);
		groups.get(base)!.push(row);
	}
	const out: { slug: string; updated_at: unknown }[] = [];
	for (const [base, list] of groups) {
		list.sort((a, b) => Number(a.id) - Number(b.id));
		for (let i = 0; i < list.length; i++) {
			out.push({ slug: formatIndexedSlug(base, i + 1), updated_at: updatedAt(list[i]) });
		}
	}
	return out;
}

export function slugifyName(input: string) {
	const s = String(input || '')
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
