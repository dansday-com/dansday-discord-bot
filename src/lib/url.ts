import { APP_URL } from './frontend/panelServer.js';

export const COMMUNITY_DISCORD_URL = 'https://discord.gg/7fEqEDSur3';

export const OFFICIAL_BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

export const DISCORD_APP_DIRECTORY_URL = 'https://discord.com/discovery/applications/1446572985849876640';

export const MAINTAINER_DISCORD_ID = '473430221211697162';

export const SOURCE_REPO_URL = 'https://github.com/dansday-com/dansday-discord-bot';

export function publicSiteOrigin(): string {
	return APP_URL;
}

export function publicServerPath(slug: string): string {
	return `/server/${encodeURIComponent(slug)}`;
}

export function publicServerUrl(slug: string, page?: 'leaderboard' | 'members' | 'account'): string | null {
	if (!slug) return null;
	return publicSiteOrigin() + publicServerPath(slug) + (page ? `/${page}` : '');
}
