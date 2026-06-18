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

// Deep link to a member's personal items shop/bag (the page is keyed by their card token).
export function publicItemsUrl(slug: string, cardToken: string): string | null {
	const origin = publicSiteOrigin();
	if (!origin || !slug || !cardToken) return null;
	return `${origin}${publicServerPath(slug)}/items/${encodeURIComponent(cardToken)}`;
}
