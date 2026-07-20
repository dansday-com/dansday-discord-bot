import db from '$lib/database.js';
import { getRedisClient } from '$lib/redis.js';
import { resolveMemberByCardToken } from '$lib/frontend/public/items/index.js';

const MARKETS_KEY = 'assets:markets';
const priceKey = (assetType: string, assetId: string) => `assets:price:${assetType}:${assetId}`;

async function cacheGet(key: string): Promise<any | null> {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return null;
	try {
		const raw = await redis.get(key);
		return raw != null ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export async function loadMarketsBoard(): Promise<any[]> {
	const cached = await cacheGet(MARKETS_KEY);
	return cached?.rows ?? [];
}

export async function markAssetViewer(): Promise<void> {
	const redis = await getRedisClient().catch(() => null);
	if (redis) await redis.set('assets:viewers', String(Date.now()), { EX: 90 }).catch(() => null);
}

async function priceFor(assetType: string, assetId: string): Promise<{ price: number; change24h: number } | null> {
	const cached = await cacheGet(priceKey(assetType, assetId));
	if (cached && Number(cached.price) > 0) return { price: Number(cached.price), change24h: Number(cached.change24h) || 0 };
	return null;
}

function computeMovers(board: any[]) {
	const withChange = board.filter((r) => Number.isFinite(r.change24h));
	const gainers = [...withChange].sort((a, b) => b.change24h - a.change24h).slice(0, 50);
	const losers = [...withChange].sort((a, b) => a.change24h - b.change24h).slice(0, 50);
	return { gainers, losers };
}

export async function loadAssetsShared(server: any, hash: string) {
	const board = await loadMarketsBoard();
	const { gainers, losers } = computeMovers(board);

	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;

	if (!member) {
		return {
			readOnly: true as const,
			member: null,
			hash: '',
			board,
			gainers,
			losers,
			positions: [],
			totalInvested: 0,
			totalValue: 0,
			memberName: null,
			memberDiscordId: null,
			memberAvatar: null
		};
	}

	const rows = await db.getOpenAssetPositions(member.id).catch(() => []);
	const positions: any[] = [];
	let totalInvested = 0;
	let totalValue = 0;
	for (const p of (rows as any[]) || []) {
		const invested = Number(p.xp_invested) || 0;
		const buyPrice = Number(p.buy_price) || 0;
		const market = await priceFor(p.asset_type, p.asset_id);
		const price = market?.price ?? buyPrice;
		const value = buyPrice > 0 ? Math.round(invested * (price / buyPrice)) : invested;
		totalInvested += invested;
		totalValue += value;
		positions.push({
			id: p.id,
			asset_type: p.asset_type,
			asset_id: p.asset_id,
			symbol: p.symbol,
			asset_name: p.asset_name,
			asset_image: p.asset_image,
			xp_invested: invested,
			buy_price: buyPrice,
			current_price: price,
			change24h: market?.change24h ?? 0,
			value,
			pnl: value - invested,
			pnl_percent: invested > 0 ? ((value - invested) / invested) * 100 : 0
		});
	}

	return {
		readOnly: false as const,
		member,
		hash,
		board,
		gainers,
		losers,
		positions,
		totalInvested,
		totalValue,
		memberName: member.server_display_name || member.display_name || member.username,
		memberDiscordId: String(member.discord_member_id),
		memberAvatar: member.avatar ?? null
	};
}
