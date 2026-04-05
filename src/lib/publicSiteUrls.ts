export function publicSiteOrigin(): string | null {
	const o = process.env.BASE_URL?.replace(/\/$/, '');
	return o || null;
}

/** `/server/{slug}` (slug encoded). */
export function publicServerPath(slug: string): string {
	return `/server/${encodeURIComponent(slug)}`;
}

/** Full URL for a public page, or null if BASE_URL or slug is missing. */
export function publicServerUrl(slug: string, page?: 'leaderboard' | 'members'): string | null {
	const origin = publicSiteOrigin();
	if (!origin || !slug) return null;
	return origin + publicServerPath(slug) + (page ? `/${page}` : '');
}
