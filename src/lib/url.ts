export const COMMUNITY_DISCORD_URL = 'https://discord.gg/7fEqEDSur3';

export const OFFICIAL_BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

export const SOURCE_REPO_URL = 'https://github.com/dansday-com/dansday-discord-bot';

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
