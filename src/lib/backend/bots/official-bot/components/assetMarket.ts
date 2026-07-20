import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { evaluateMemberLevelAndRank } from './leveling.js';
import { getSpendableXp, spendXp } from './items.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const POLL_INTERVAL_MS = 60_000;
const MARKETS_TTL_MS = 5 * 60_000;
const SEARCH_TTL_MS = 10 * 60_000;
const POLL_LOCK_TTL_S = Math.ceil(POLL_INTERVAL_MS / 1000) + 20;
const MARKETS_PER_PAGE = 50;
export const MIN_BUY_XP = 1000;

const MARKETS_KEY = 'assets:markets';
const priceKey = (assetType: string, assetId: string) => `assets:price:${assetType}:${assetId}`;
const searchKey = (q: string) => `assets:search:${q.toLowerCase()}`;

function apiKey(): string | null {
	return process.env.COINGECKO_API_KEY || null;
}

function apiHeaders(): Record<string, string> {
	const key = apiKey();
	return key ? { 'x-cg-demo-api-key': key } : {};
}

async function cgFetch(path: string): Promise<any> {
	const res = await fetch(`${COINGECKO_BASE}${path}`, { headers: apiHeaders() });
	if (!res.ok) throw new Error(`coingecko ${res.status} ${path}`);
	return res.json();
}

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

async function cacheSet(key: string, value: any, ttlMs: number): Promise<void> {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return;
	try {
		await redis.set(key, JSON.stringify(value), { PX: ttlMs });
	} catch {}
}

function shapeMarketRow(row: any) {
	return {
		asset_type: 'crypto',
		asset_id: String(row.id),
		symbol: String(row.symbol || '').toUpperCase(),
		name: row.name,
		image: row.image ?? null,
		price: Number(row.current_price) || 0,
		change24h: Number(row.price_change_percentage_24h) || 0,
		market_cap_rank: row.market_cap_rank != null ? Number(row.market_cap_rank) : null,
		sparkline: Array.isArray(row.sparkline_in_7d?.price) ? row.sparkline_in_7d.price.map((n: any) => Number(n) || 0) : []
	};
}

async function fetchTopMarkets() {
	const path = `/coins/markets?vs_currency=idr&order=market_cap_desc&per_page=${MARKETS_PER_PAGE}` + `&page=1&sparkline=true&price_change_percentage=24h`;
	const rows = await cgFetch(path);
	return Array.isArray(rows) ? rows.map(shapeMarketRow) : [];
}

async function fetchPricesFor(assetIds: string[]): Promise<Record<string, { price: number; change24h: number }>> {
	if (assetIds.length === 0) return {};
	const ids = encodeURIComponent(assetIds.join(','));
	const data = await cgFetch(`/simple/price?ids=${ids}&vs_currencies=idr&include_24hr_change=true`);
	const out: Record<string, { price: number; change24h: number }> = {};
	for (const [id, val] of Object.entries<any>(data || {})) {
		out[id] = { price: Number(val?.idr) || 0, change24h: Number(val?.idr_24h_change) || 0 };
	}
	return out;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function distinctHeldCryptoIds(): Promise<string[]> {
	const rows = await db.getDistinctHeldAssetIds('crypto').catch(() => []);
	return ((rows as any[]) || []).map((r) => String(r.asset_id)).filter(Boolean);
}

async function pollOnce(botId: string): Promise<void> {
	const redis = await getRedisClient().catch(() => null);
	if (redis) {
		const token = `${process.pid}:${botId}`;
		const got = await redis.set('assets:poll:lock', token, { NX: true, EX: POLL_LOCK_TTL_S }).catch(() => null);
		if (got !== 'OK') return;
	}

	if (!apiKey()) {
		logger.warn('Asset market poll skipped: COINGECKO_API_KEY not set');
		return;
	}

	try {
		const markets = await fetchTopMarkets();
		if (markets.length > 0) {
			await cacheSet(MARKETS_KEY, { rows: markets, ts: Date.now() }, MARKETS_TTL_MS);
			for (const m of markets) {
				await cacheSet(priceKey('crypto', m.asset_id), { price: m.price, change24h: m.change24h, ts: Date.now() }, MARKETS_TTL_MS);
			}
		}

		const held = await distinctHeldCryptoIds();
		const inBoard = new Set(markets.map((m) => m.asset_id));
		const missing = held.filter((id) => !inBoard.has(id));
		if (missing.length > 0) {
			const prices = await fetchPricesFor(missing);
			for (const [id, p] of Object.entries(prices)) {
				await cacheSet(priceKey('crypto', id), { price: p.price, change24h: p.change24h, ts: Date.now() }, MARKETS_TTL_MS);
			}
		}
	} catch (err: any) {
		logger.warn(`Asset market poll failed: ${err?.message || err}`);
	}
}

export function startAssetMarketPoller(botId: string): void {
	if (pollTimer) return;
	void pollOnce(botId);
	pollTimer = setInterval(() => void pollOnce(botId), POLL_INTERVAL_MS);
	pollTimer.unref?.();
}

export function stopAssetMarketPoller(): void {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

export async function getMarketsBoard(): Promise<any[]> {
	const cached = await cacheGet(MARKETS_KEY);
	if (cached?.rows?.length) return cached.rows;
	try {
		const markets = await fetchTopMarkets();
		if (markets.length > 0) await cacheSet(MARKETS_KEY, { rows: markets, ts: Date.now() }, MARKETS_TTL_MS);
		return markets;
	} catch {
		return [];
	}
}

export async function getAssetPrice(assetType: string, assetId: string): Promise<{ price: number; change24h: number } | null> {
	const cached = await cacheGet(priceKey(assetType, assetId));
	if (cached && Number(cached.price) > 0) return { price: Number(cached.price), change24h: Number(cached.change24h) || 0 };
	if (assetType !== 'crypto') return null;
	try {
		const prices = await fetchPricesFor([assetId]);
		const p = prices[assetId];
		if (p && p.price > 0) {
			await cacheSet(priceKey(assetType, assetId), { price: p.price, change24h: p.change24h, ts: Date.now() }, MARKETS_TTL_MS);
			return p;
		}
	} catch {}
	return null;
}

export async function searchAssets(query: string): Promise<any[]> {
	const q = String(query || '').trim();
	if (!q) return [];
	const cached = await cacheGet(searchKey(q));
	if (cached) return cached;
	try {
		const data = await cgFetch(`/search?query=${encodeURIComponent(q)}`);
		const coins = Array.isArray(data?.coins) ? data.coins : [];
		const results = coins.slice(0, 25).map((c: any) => ({
			asset_type: 'crypto',
			asset_id: String(c.id),
			symbol: String(c.symbol || '').toUpperCase(),
			name: c.name,
			image: c.thumb ?? c.large ?? null,
			market_cap_rank: c.market_cap_rank != null ? Number(c.market_cap_rank) : null
		}));
		await cacheSet(searchKey(q), results, SEARCH_TTL_MS);
		return results;
	} catch (err: any) {
		logger.warn(`Asset search failed: ${err?.message || err}`);
		return [];
	}
}

async function resolveServerMemberId(serverId: any, discordMemberId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordMemberId)).catch(() => null);
	return member?.id ?? null;
}

async function finalize(guildId: any, memberId: any, before: any, reason: string) {
	await evaluateMemberLevelAndRank(guildId, memberId, {
		previousLevel: before?.level != null ? Number(before.level) : null,
		previousRank: before?.rank != null ? Number(before.rank) : null,
		previousExperience: before?.experience != null ? Number(before.experience) : null,
		reason
	}).catch(() => null);
}

export async function handleAssetBuy(_client: any, payload: any) {
	const { guild_id, actor_discord_id, asset_type, asset_id, xp_amount } = payload || {};
	if (!guild_id || !actor_discord_id || !asset_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot } = await import('../../../config.js');
	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch {
		return { ok: false, error: 'server_not_found' };
	}

	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) return { ok: false, error: 'member_not_found' };

	const type = String(asset_type || 'crypto');
	const amount = Math.max(0, Math.floor(Number(xp_amount) || 0));
	if (amount <= 0) return { ok: false, error: 'invalid_amount' };
	if (amount < MIN_BUY_XP) return { ok: false, error: 'below_minimum', min: MIN_BUY_XP };

	const market = await getAssetPrice(type, String(asset_id));
	if (!market || market.price <= 0) return { ok: false, error: 'price_unavailable' };

	const spendable = await getSpendableXp(memberId, guild_id);
	if (spendable.total < amount) return { ok: false, error: 'insufficient_xp' };

	const meta = await resolveAssetMeta(type, String(asset_id));

	const before = await db.getMemberLevel(memberId).catch(() => null);
	const spent = await spendXp(memberId, amount, guild_id);
	if (!spent.ok) return { ok: false, error: 'insufficient_xp' };

	const existing = await db.getOpenAssetPosition(memberId, type, String(asset_id)).catch(() => null);
	let position;
	if (existing) {
		const prevInvested = Number(existing.xp_invested) || 0;
		const prevPrice = Number(existing.buy_price) || market.price;
		const newInvested = prevInvested + amount;
		const avgPrice = newInvested > 0 ? (prevInvested * prevPrice + amount * market.price) / newInvested : market.price;
		await db.mergeAssetPosition(existing.id, { xp_invested: newInvested, buy_price: avgPrice });
		position = await db.getAssetPosition(existing.id);
	} else {
		position = await db.openAssetPosition({
			member_id: memberId,
			asset_type: type,
			asset_id: String(asset_id),
			symbol: meta.symbol,
			asset_name: meta.name,
			asset_image: meta.image,
			xp_invested: amount,
			buy_price: market.price
		});
	}

	await finalize(guild_id, memberId, before, 'asset-buy');
	return { ok: true, position, price: market.price };
}

export async function handleAssetSell(_client: any, payload: any) {
	const { guild_id, actor_discord_id, position_id, percent } = payload || {};
	if (!guild_id || !actor_discord_id || !position_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot } = await import('../../../config.js');
	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch {
		return { ok: false, error: 'server_not_found' };
	}

	const memberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!memberId) return { ok: false, error: 'member_not_found' };

	const position = await db.getAssetPosition(position_id).catch(() => null);
	if (!position || Number(position.member_id) !== Number(memberId)) return { ok: false, error: 'not_owner' };
	if (position.status !== 'open') return { ok: false, error: 'already_closed' };

	const market = await getAssetPrice(position.asset_type, position.asset_id);
	if (!market || market.price <= 0) return { ok: false, error: 'price_unavailable' };

	const buyPrice = Number(position.buy_price) || 0;
	const invested = Number(position.xp_invested) || 0;
	const pct = Math.max(1, Math.min(100, Math.floor(Number(percent) || 100)));
	const soldInvested = pct >= 100 ? invested : Math.max(1, Math.min(invested, Math.floor((invested * pct) / 100)));
	const full = soldInvested >= invested;
	const payout = buyPrice > 0 ? Math.max(0, Math.round(soldInvested * (market.price / buyPrice))) : soldInvested;

	const before = await db.getMemberLevel(memberId).catch(() => null);
	await db.ensureMemberLevel(memberId);
	await db.updateMemberLevelStats(memberId, { experienceIncrement: payout });
	if (full) {
		await db.closeAssetPosition(position_id, { sell_price: market.price, xp_returned: payout });
	} else {
		await db.reduceAssetPosition(position_id, { sold_invested: soldInvested, sell_price: market.price, xp_returned: payout });
	}
	await finalize(guild_id, memberId, before, 'asset-sell');

	return { ok: true, payout, invested: soldInvested, sell_price: market.price, net: payout - soldInvested, full };
}

async function resolveAssetMeta(assetType: string, assetId: string): Promise<{ symbol: string; name: string; image: string | null }> {
	const board = await getMarketsBoard();
	const hit = board.find((m) => m.asset_type === assetType && m.asset_id === assetId);
	if (hit) return { symbol: hit.symbol, name: hit.name, image: hit.image ?? null };
	if (assetType === 'crypto') {
		try {
			const data = await cgFetch(
				`/coins/${encodeURIComponent(assetId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`
			);
			return {
				symbol: String(data?.symbol || assetId).toUpperCase(),
				name: data?.name || assetId,
				image: data?.image?.thumb ?? null
			};
		} catch {}
	}
	return { symbol: assetId.toUpperCase(), name: assetId, image: null };
}

export async function getMemberPortfolio(memberId: any): Promise<{
	positions: any[];
	totalInvested: number;
	totalValue: number;
}> {
	const rows = await db.getOpenAssetPositions(memberId).catch(() => []);
	const positions: any[] = [];
	let totalInvested = 0;
	let totalValue = 0;
	for (const p of (rows as any[]) || []) {
		const invested = Number(p.xp_invested) || 0;
		const buyPrice = Number(p.buy_price) || 0;
		const market = await getAssetPrice(p.asset_type, p.asset_id);
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
	return { positions, totalInvested, totalValue };
}
