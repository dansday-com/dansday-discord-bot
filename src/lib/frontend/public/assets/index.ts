import db from '$lib/database.js';
import { getRedisClient } from '$lib/redis.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

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

type BoardListener = (rows: any[]) => void;

const boardListeners = new Set<BoardListener>();
let boardTimer: ReturnType<typeof setInterval> | null = null;
let boardLastJson = '';

export function subscribeAssetsBoard(fn: BoardListener): () => void {
	boardListeners.add(fn);
	loadMarketsBoard().then((rows) => {
		if (rows.length) fn(rows);
	});

	if (!boardTimer) {
		boardTimer = setInterval(async () => {
			if (boardListeners.size === 0) return;
			const rows = await loadMarketsBoard();
			const json = JSON.stringify(rows);
			if (json === boardLastJson) return;
			boardLastJson = json;
			for (const l of boardListeners) l(rows);
		}, 5_000);
		boardTimer.unref?.();
	}

	return () => {
		boardListeners.delete(fn);
		if (boardListeners.size === 0 && boardTimer) {
			clearInterval(boardTimer);
			boardTimer = null;
			boardLastJson = '';
		}
	};
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
	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) return shared;

	const board = await loadMarketsBoard();
	const { gainers, losers } = computeMovers(board);

	const positions: any[] = [];
	let totalInvested = 0;
	let totalValue = 0;

	if (!shared.readOnly && shared.member) {
		const rows = await db.getOpenAssetPositions(shared.member.id).catch(() => []);
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
	}

	return { ...shared, board, gainers, losers, positions, totalInvested, totalValue };
}
