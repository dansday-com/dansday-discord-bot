import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome } from '$lib/url.js';
import db from '$lib/database.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { loadAssetPriceMap } from '$lib/backend/public/market/index.js';
import type { StoredLevelingSettings } from '$lib/backend/config.js';
import { HTTP } from '$lib/http.js';
import { PERCENT } from '$lib/utils/numbers.js';

const SQL_DATETIME_LENGTH = 19;
const LEVEL_FRIENDS_LIMIT = 5;

type Holding = { symbol: string; name: string; image: string | null; change24h: number; invested: number; value: number; preciseValue: number };

type CardMember = NonNullable<Extract<Awaited<ReturnType<typeof loadItemsShared>>, { member: unknown }>['member']>;
type PriceMap = Record<string, { price: number; change24h: number }>;
type PositionRow = Awaited<ReturnType<typeof db.getOpenAssetPositions>>[number];

function toSql(v: Date | string | null | undefined) {
	if (!v) {
		return null;
	}
	const d = v instanceof Date ? v : new Date(v);
	return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, SQL_DATETIME_LENGTH).replace('T', ' ');
}

function xpRates(ls: StoredLevelingSettings) {
	return {
		chat: Math.max(0, Number(ls.MESSAGE?.XP) || 0),
		voice: Math.max(0, Number(ls.VOICE?.XP_PER_MINUTE) || 0),
		afk: Math.max(0, Number(ls.VOICE?.AFK_XP_PER_MINUTE) || 0),
		video: Math.max(0, Number(ls.VIDEO?.XP_PER_MINUTE) || 0),
		stream: Math.max(0, Number(ls.STREAMING?.XP_PER_MINUTE) || 0)
	};
}

async function memberProfile(serverId: number, m: CardMember, levelingComponent: string) {
	const levelingRow = await db.getServerSettings(serverId, levelingComponent).catch(() => null);
	const rate = xpRates(levelingRow?.settings ?? {});
	const activity = {
		chatTotal: Number(m.chat_total) || 0,
		voiceActive: Number(m.voice_minutes_active) || 0,
		voiceAfk: Number(m.voice_minutes_afk) || 0,
		voiceVideo: Number(m.voice_minutes_video) || 0,
		voiceStreaming: Number(m.voice_minutes_streaming) || 0
	};
	const [inviteStats, inviter] = await Promise.all([
		db.getMemberInviteStats(Number(m.id)).catch(() => null),
		db.getMemberInviter(Number(m.id)).catch(() => null)
	]);

	const xpSources = [
		{ key: 'chat', label: 'Messages', icon: 'fa-comments', color: '#e43d12', xp: activity.chatTotal * rate.chat },
		{ key: 'voice', label: 'Voice', icon: 'fa-microphone', color: '#1f8a4c', xp: activity.voiceActive * rate.voice },
		{ key: 'video', label: 'Video', icon: 'fa-video', color: '#6d5bd0', xp: activity.voiceVideo * rate.video },
		{ key: 'stream', label: 'Streaming', icon: 'fa-desktop', color: '#c8911a', xp: activity.voiceStreaming * rate.stream },
		{ key: 'afk', label: 'AFK voice', icon: 'fa-moon', color: '#b23b3b', xp: activity.voiceAfk * rate.afk },
		{ key: 'invite', label: 'Invites', icon: 'fa-user-plus', color: '#2f7fa8', xp: inviteStats?.xp ?? 0 }
	]
		.map((source) => ({ ...source, xp: Math.round(source.xp) }))
		.filter((source) => source.xp > 0);

	return {
		joined: toSql(m.member_since),
		discordSince: toSql(m.profile_created_at),
		isBooster: !!m.is_booster,
		boosterSince: toSql(m.booster_since),
		isAfk: !!m.is_afk,
		afkMessage: m.afk_message ?? null,
		totalXp: Number(m.xp) || 0,
		...activity,
		xpSources,
		invites: inviteStats,
		invitedBy: inviter?.inviter_name ?? null,
		roles: (m.roles ?? []).map((r: Record<string, unknown>) => ({ name: r.name, color: r.color }))
	};
}

function holdingsFrom(positionRows: PositionRow[], priceMap: PriceMap) {
	const holdingMap = new Map<string, Holding>();
	for (const pos of positionRows) {
		const key = `${pos.asset_type}:${pos.asset_id}`;
		const invested = Number(pos.xp_invested) || 0;
		const buyPrice = Number(pos.buy_price) || 0;
		const market = priceMap[key];
		const price = Number(market?.price) > 0 ? Number(market.price) : buyPrice;
		const preciseValue = buyPrice > 0 ? invested * (price / buyPrice) : invested;
		const value = Math.round(preciseValue);
		const existing = holdingMap.get(key);
		if (existing) {
			existing.invested += invested;
			existing.value += value;
			existing.preciseValue += preciseValue;
			continue;
		}
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
	return [...holdingMap.values()]
		.map(({ preciseValue, ...h }) => ({
			...h,
			pnl: h.value - h.invested,
			pnlPercent: h.invested > 0 ? ((preciseValue - h.invested) / h.invested) * PERCENT : 0
		}))
		.sort((a, b) => b.value - a.value);
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath, marketEnabled: isMarketEnabled } = await parent();
	const { SERVER_SETTINGS } = await import('$lib/backend/panelServer.js');

	const shared = await loadItemsShared(server, itemsCardTokenFromUrl(params.hash), null);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, apexHome());
	}
	if ('guest' in shared || !shared.member) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	const memberId = shared.member.id;
	const profile = await memberProfile(server.id, shared.member, SERVER_SETTINGS.component.leveling);
	const priceMap: PriceMap = isMarketEnabled ? await loadAssetPriceMap().catch(() => ({})) : {};
	const [dashboard, insights, levelFriends, positionRows] = await Promise.all([
		db.getMemberDashboard(memberId, priceMap).catch(() => null),
		db.getMemberInsights(memberId, server.id).catch(() => null),
		db.getMemberLevelFriends(memberId, LEVEL_FRIENDS_LIMIT).catch(() => []),
		isMarketEnabled ? db.getOpenAssetPositions(memberId).catch(() => []) : []
	]);

	return { ...shared, profile, dashboard, insights, levelFriends, positions: holdingsFrom(positionRows, priceMap) };
};
