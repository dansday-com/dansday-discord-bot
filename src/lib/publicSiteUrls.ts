export const PUBLIC_WEB_LEADERBOARD_PATH = 'leaderboard';
export const PUBLIC_WEB_MEMBERS_PATH = 'members';

export function publicSiteOrigin(): string | null {
	const o = process.env.BASE_URL?.replace(/\/$/, '');
	return o || null;
}

export function publicServerOverviewUrl(publicServerSlug: string): string | null {
	const origin = publicSiteOrigin();
	if (!origin || !publicServerSlug) return null;
	return `${origin}/${encodeURIComponent(publicServerSlug)}`;
}

export function publicWebLeaderboardUrl(publicServerSlug: string): string | null {
	const base = publicServerOverviewUrl(publicServerSlug);
	if (!base) return null;
	return `${base}/${PUBLIC_WEB_LEADERBOARD_PATH}`;
}

export function publicWebMembersUrl(publicServerSlug: string): string | null {
	const base = publicServerOverviewUrl(publicServerSlug);
	if (!base) return null;
	return `${base}/${PUBLIC_WEB_MEMBERS_PATH}`;
}
