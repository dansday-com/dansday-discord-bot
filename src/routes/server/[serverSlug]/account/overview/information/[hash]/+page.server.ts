import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	if (!itemsEnabled && !assetsEnabled && !minigamesEnabled) error(404, 'Account not available');
	const gate = itemsEnabled ? SERVER_SETTINGS.component.items : assetsEnabled ? SERVER_SETTINGS.component.assets : SERVER_SETTINGS.component.minigames;

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, gate);
	if ('notFound' in shared) error(404, 'Account not available');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const m = shared.member;
	const profile = {
		joined: m.member_since ? new Date(m.member_since).toISOString() : null,
		discordSince: m.profile_created_at ? new Date(m.profile_created_at).toISOString() : null,
		isBooster: !!m.is_booster,
		boosterSince: m.booster_since ? new Date(m.booster_since).toISOString() : null,
		isAfk: !!m.is_afk,
		afkMessage: m.afk_message ?? null,
		chatTotal: Number(m.chat_total) || 0,
		voiceActive: Number(m.voice_minutes_active) || 0,
		voiceAfk: Number(m.voice_minutes_afk) || 0,
		voiceVideo: Number(m.voice_minutes_video) || 0,
		voiceStreaming: Number(m.voice_minutes_streaming) || 0,
		roles: (m.roles ?? []).map((r: any) => ({ name: r.name, color: r.color }))
	};

	return { ...shared, profile };
};
