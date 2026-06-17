export function publicSiteOrigin(): string | null {
	const o = process.env.BASE_URL?.replace(/\/$/, '');
	return o || null;
}

export function publicServerPath(slug: string): string {
	return `/server/${encodeURIComponent(slug)}`;
}

export function publicServerUrl(slug: string, page?: 'leaderboard' | 'members'): string | null {
	const origin = publicSiteOrigin();
	if (!origin || !slug) return null;
	return origin + publicServerPath(slug) + (page ? `/${page}` : '');
}
