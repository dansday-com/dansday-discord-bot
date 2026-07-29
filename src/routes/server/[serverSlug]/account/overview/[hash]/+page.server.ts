import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import db from '$lib/database.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadAssetPriceMap } from '$lib/frontend/public/assets/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, accountEnabled, assetsEnabled } = await parent();
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	if (!accountEnabled) redirect(303, '/');

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, '/');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const toSql = (v: any) => {
		if (!v) return null;
		const d = v instanceof Date ? v : new Date(v);
		if (Number.isNaN(d.getTime())) return null;
		return d.toISOString().slice(0, 19).replace('T', ' ');
	};

	const m = shared.member;

	const levelingRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const ls = (levelingRow as any)?.settings ?? {};
	const rateMsg = Math.max(0, Number(ls.MESSAGE?.XP) || 0);
	const rateVoice = Math.max(0, Number(ls.VOICE?.XP_PER_MINUTE) || 0);
	const rateAfk = Math.max(0, Number(ls.VOICE?.AFK_XP_PER_MINUTE) || 0);
	const rateVideo = Math.max(0, Number(ls.VIDEO?.XP_PER_MINUTE) || 0);
	const rateStream = Math.max(0, Number(ls.STREAMING?.XP_PER_MINUTE) || 0);

	const chatTotal = Number(m.chat_total) || 0;
	const voiceActive = Number(m.voice_minutes_active) || 0;
	const voiceAfk = Number(m.voice_minutes_afk) || 0;
	const voiceVideo = Number(m.voice_minutes_video) || 0;
	const voiceStreaming = Number(m.voice_minutes_streaming) || 0;
	const totalXp = Number(m.xp) || 0;

	const xpSources = [
		{ key: 'chat', label: 'Messages', icon: 'fa-comments', color: '#245f73', xp: chatTotal * rateMsg },
		{ key: 'voice', label: 'Voice', icon: 'fa-microphone', color: '#1f8a4c', xp: voiceActive * rateVoice },
		{ key: 'video', label: 'Video', icon: 'fa-video', color: '#6d5bd0', xp: voiceVideo * rateVideo },
		{ key: 'stream', label: 'Streaming', icon: 'fa-desktop', color: '#c8911a', xp: voiceStreaming * rateStream },
		{ key: 'afk', label: 'AFK voice', icon: 'fa-moon', color: '#b23b3b', xp: voiceAfk * rateAfk }
	]
		.map((s) => ({ ...s, xp: Math.round(s.xp) }))
		.filter((s) => s.xp > 0);

	const profile = {
		joined: toSql(m.member_since),
		discordSince: toSql(m.profile_created_at),
		isBooster: !!m.is_booster,
		boosterSince: toSql(m.booster_since),
		isAfk: !!m.is_afk,
		afkMessage: m.afk_message ?? null,
		totalXp,
		chatTotal,
		voiceActive,
		voiceAfk,
		voiceVideo,
		voiceStreaming,
		xpSources,
		roles: (m.roles ?? []).map((r: any) => ({ name: r.name, color: r.color }))
	};

	const priceMap = assetsEnabled ? await loadAssetPriceMap().catch(() => ({})) : {};
	const [dashboard, insights, levelFriends, positionRows] = await Promise.all([
		db.getMemberDashboard(shared.member.id, priceMap as any).catch(() => null),
		db.getMemberInsights(shared.member.id, server.id).catch(() => null),
		db.getMemberLevelFriends(shared.member.id, 5).catch(() => []),
		assetsEnabled ? db.getOpenAssetPositions(shared.member.id).catch(() => []) : []
	]);

	const holdingMap = new Map<string, any>();
	for (const pos of (positionRows as any[]) || []) {
		const key = `${pos.asset_type}:${pos.asset_id}`;
		const invested = Number(pos.xp_invested) || 0;
		const buyPrice = Number(pos.buy_price) || 0;
		const market = (priceMap as any)[key];
		const price = Number(market?.price) > 0 ? Number(market.price) : buyPrice;
		const preciseValue = buyPrice > 0 ? invested * (price / buyPrice) : invested;
		const value = Math.round(preciseValue);
		const existing = holdingMap.get(key);
		if (existing) {
			existing.invested += invested;
			existing.value += value;
			existing.preciseValue += preciseValue;
		} else {
			holdingMap.set(key, {
				symbol: pos.symbol || pos.asset_name || 'Asset',
				name: pos.asset_name || pos.symbol || 'Asset',
				image: pos.asset_image ?? null,
				change24h: Number(market?.change24h) || 0,
				invested,
				value,
				preciseValue
			});
		}
	}
	const positions = [...holdingMap.values()]
		.map(({ preciseValue, ...h }) => ({
			...h,
			pnl: h.value - h.invested,
			pnlPercent: h.invested > 0 ? ((preciseValue - h.invested) / h.invested) * 100 : 0
		}))
		.sort((a, b) => b.value - a.value);

	return { ...shared, profile, dashboard, insights, levelFriends, positions };
};
