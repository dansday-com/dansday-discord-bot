import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import db from '$lib/database.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadAssetPriceMap } from '$lib/frontend/public/assets/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	if (!itemsEnabled && !assetsEnabled && !minigamesEnabled) error(404, 'Account not available');
	const gate = itemsEnabled ? SERVER_SETTINGS.component.items : assetsEnabled ? SERVER_SETTINGS.component.assets : SERVER_SETTINGS.component.minigames;

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, gate);
	if ('notFound' in shared) error(404, 'Account not available');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const toSql = (v: any) => {
		if (!v) return null;
		const d = v instanceof Date ? v : new Date(v);
		if (Number.isNaN(d.getTime())) return null;
		return d.toISOString().slice(0, 19).replace('T', ' ');
	};

	const m = shared.member;
	const profile = {
		joined: toSql(m.member_since),
		discordSince: toSql(m.profile_created_at),
		isBooster: !!m.is_booster,
		boosterSince: toSql(m.booster_since),
		isAfk: !!m.is_afk,
		afkMessage: m.afk_message ?? null,
		chatTotal: Number(m.chat_total) || 0,
		voiceActive: Number(m.voice_minutes_active) || 0,
		voiceAfk: Number(m.voice_minutes_afk) || 0,
		voiceVideo: Number(m.voice_minutes_video) || 0,
		voiceStreaming: Number(m.voice_minutes_streaming) || 0,
		roles: (m.roles ?? []).map((r: any) => ({ name: r.name, color: r.color }))
	};

	const priceMap = assetsEnabled ? await loadAssetPriceMap().catch(() => ({})) : {};
	const [dashboard, insights, levelFriends] = await Promise.all([
		db.getMemberDashboard(shared.member.id, priceMap as any).catch(() => null),
		db.getMemberInsights(shared.member.id).catch(() => null),
		db.getMemberLevelFriends(shared.member.id, 5).catch(() => [])
	]);

	return { ...shared, profile, dashboard, insights, levelFriends };
};
