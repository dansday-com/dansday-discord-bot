import db from '$lib/database.js';
import { getRedisClient } from '$lib/redis.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

const MARKETS_KEY = 'assets:markets';
const MOVERS_KEY = 'assets:movers';
const PRICES_KEY = 'assets:prices';

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

export async function loadAssetPriceMap(): Promise<Record<string, { price: number; change24h: number }>> {
	return (await cacheGet(PRICES_KEY))?.map ?? {};
}

export async function loadMarketsBoard(): Promise<any[]> {
	const cached = await cacheGet(MARKETS_KEY);
	return cached?.rows ?? [];
}

type MarketSnapshot = { board: any[]; gainers: any[]; losers: any[] };
type BoardListener = (snap: MarketSnapshot) => void;

const boardListeners = new Set<BoardListener>();
let boardTimer: ReturnType<typeof setInterval> | null = null;
let boardLastJson = '';

async function loadSnapshot(): Promise<MarketSnapshot> {
	const [board, movers] = await Promise.all([loadMarketsBoard(), loadMovers()]);
	return { board, gainers: movers.gainers, losers: movers.losers };
}

export function subscribeAssetsBoard(fn: BoardListener): () => void {
	boardListeners.add(fn);
	loadSnapshot().then((snap) => {
		if (snap.board.length) fn(snap);
	});

	if (!boardTimer) {
		boardTimer = setInterval(async () => {
			if (boardListeners.size === 0) return;
			const snap = await loadSnapshot();
			const json = JSON.stringify(snap);
			if (json === boardLastJson) return;
			boardLastJson = json;
			for (const l of boardListeners) l(snap);
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

export async function loadMovers(): Promise<{ gainers: any[]; losers: any[] }> {
	const cached = await cacheGet(MOVERS_KEY);
	return { gainers: cached?.gainers ?? [], losers: cached?.losers ?? [] };
}

export async function loadAssetsShared(server: any, hash: string) {
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');
	const shared = await loadItemsShared(server, hash, SERVER_SETTINGS.component.assets);
	if ('notFound' in shared || 'guest' in shared) return shared;

	const board = await loadMarketsBoard();
	const { gainers, losers } = await loadMovers();
	const priceMap = (await cacheGet(PRICES_KEY))?.map ?? {};

	const positions: any[] = [];
	let totalInvested = 0;
	let totalValue = 0;

	if (shared.member) {
		const rows = await db.getOpenAssetPositions(shared.member.id).catch(() => []);
		for (const p of (rows as any[]) || []) {
			const invested = Number(p.xp_invested) || 0;
			const buyPrice = Number(p.buy_price) || 0;
			const market = priceMap[`${p.asset_type}:${p.asset_id}`];
			const price = Number(market?.price) > 0 ? Number(market.price) : buyPrice;
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
