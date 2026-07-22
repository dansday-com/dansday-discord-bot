import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { evaluateMemberLevelAndRank } from './leveling.js';
import { getSpendableXp, spendXp } from './xp-economy.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const POLL_INTERVAL_MS = 15 * 60_000;
const MARKETS_TTL_MS = 15 * 60_000;
const SEARCH_TTL_MS = 15 * 60_000;
const POLL_LOCK_TTL_S = Math.ceil(POLL_INTERVAL_MS / 1000) + 20;
const MARKETS_PER_PAGE = 50;
const UNIVERSE_PER_PAGE = 250;
const UNIVERSE_PAGES = 4;
const MOVERS_COUNT = 50;
export const MIN_BUY_XP = 10_000;

const MARKETS_KEY = 'assets:markets';
const MOVERS_KEY = 'assets:movers';
const PRICES_KEY = 'assets:prices';
const searchKey = (q: string) => `assets:search:${q.toLowerCase()}`;

function apiKey(): string | null {
	return process.env.COINGECKO_API_KEY || null;
}

function apiHeaders(): Record<string, string> {
	const key = apiKey();
	return key ? { 'x-cg-demo-api-key': key } : {};
}

const RATE_LIMIT_COOLDOWN_MS = 60_000;
let rateLimitedUntil = 0;

async function cgFetch(path: string): Promise<any> {
	if (Date.now() < rateLimitedUntil) throw new Error(`coingecko rate-limited, cooling down ${path}`);
	const res = await fetch(`${COINGECKO_BASE}${path}`, { headers: apiHeaders() });
	if (res.status === 429) {
		const retryAfterS = Number(res.headers.get('retry-after')) || 0;
		rateLimitedUntil = Date.now() + Math.max(RATE_LIMIT_COOLDOWN_MS, retryAfterS * 1000);
		logger.warn(`coingecko 429 ${path}; backing off until ${new Date(rateLimitedUntil).toISOString()}`);
	}
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

async function fetchUniverse() {
	const all: any[] = [];
	for (let page = 1; page <= UNIVERSE_PAGES; page++) {
		const sparkline = page === 1 ? 'true' : 'false';
		const path =
			`/coins/markets?vs_currency=idr&order=market_cap_desc&per_page=${UNIVERSE_PER_PAGE}` + `&page=${page}&sparkline=${sparkline}&price_change_percentage=24h`;
		const rows = await cgFetch(path).catch(() => null);
		if (!Array.isArray(rows) || rows.length === 0) break;
		for (const r of rows) all.push(shapeMarketRow(r));
	}
	return all;
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

async function pollOnce(botId: string, force = false): Promise<void> {
	const redis = await getRedisClient().catch(() => null);
	if (redis) {
		const token = `${process.pid}:${botId}`;
		const got = force
			? await redis.set('assets:poll:lock', token, { EX: POLL_LOCK_TTL_S }).catch(() => null)
			: await redis.set('assets:poll:lock', token, { NX: true, EX: POLL_LOCK_TTL_S }).catch(() => null);
		if (!force && got !== 'OK') return;
	}

	if (!apiKey()) {
		logger.warn('Asset market poll skipped: COINGECKO_API_KEY not set');
		return;
	}

	try {
		const universe = await fetchUniverse();
		const priceMap: Record<string, { price: number; change24h: number }> = {};
		if (universe.length > 0) {
			const board = universe.slice(0, MARKETS_PER_PAGE);
			await cacheSet(MARKETS_KEY, { rows: board, ts: Date.now() }, MARKETS_TTL_MS);

			const withChange = universe.filter((m) => Number.isFinite(m.change24h) && m.change24h !== 0);
			const gainers = [...withChange].sort((a, b) => b.change24h - a.change24h).slice(0, MOVERS_COUNT);
			const losers = [...withChange].sort((a, b) => a.change24h - b.change24h).slice(0, MOVERS_COUNT);
			await cacheSet(MOVERS_KEY, { gainers, losers, ts: Date.now() }, MARKETS_TTL_MS);

			for (const m of universe) priceMap[`crypto:${m.asset_id}`] = { price: m.price, change24h: m.change24h };
		}

		const held = await distinctHeldCryptoIds();
		const inUniverse = new Set(universe.map((m) => m.asset_id));
		const missing = held.filter((id) => !inUniverse.has(id));
		if (missing.length > 0) {
			const prices = await fetchPricesFor(missing);
			for (const [id, p] of Object.entries(prices)) priceMap[`crypto:${id}`] = { price: p.price, change24h: p.change24h };
		}

		if (Object.keys(priceMap).length > 0) await cacheSet(PRICES_KEY, { map: priceMap, ts: Date.now() }, MARKETS_TTL_MS);
	} catch (err: any) {
		logger.warn(`Asset market poll failed: ${err?.message || err}`);
	}
}

export function startAssetMarketPoller(botId: string): void {
	if (pollTimer) return;
	void pollOnce(botId, true);
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
	const cached = await cacheGet(PRICES_KEY);
	const hit = cached?.map?.[`${assetType}:${assetId}`];
	if (hit && Number(hit.price) > 0) return { price: Number(hit.price), change24h: Number(hit.change24h) || 0 };
	if (assetType !== 'crypto') return null;
	try {
		const prices = await fetchPricesFor([assetId]);
		const p = prices[assetId];
		if (p && p.price > 0) return p;
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
			market_cap_rank: c.market_cap_rank != null ? Number(c.market_cap_rank) : null,
			price: 0,
			change24h: 0
		}));

		const cachedPrices = (await cacheGet(PRICES_KEY))?.map ?? {};
		const needFetch: string[] = [];
		for (const r of results) {
			const hit = cachedPrices[`crypto:${r.asset_id}`];
			if (hit && Number(hit.price) > 0) {
				r.price = Number(hit.price);
				r.change24h = Number(hit.change24h) || 0;
			} else {
				needFetch.push(r.asset_id);
			}
		}
		if (needFetch.length > 0) {
			const prices = await fetchPricesFor(needFetch);
			for (const r of results) {
				const p = prices[r.asset_id];
				if (p) {
					r.price = p.price;
					r.change24h = p.change24h;
				}
			}
		}

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

	await db
		.logAssetEvent({
			member_id: memberId,
			action: 'buy',
			asset_type: type,
			asset_id: String(asset_id),
			symbol: meta.symbol,
			asset_name: meta.name,
			asset_image: meta.image,
			xp_amount: amount,
			price: market.price
		})
		.catch(() => null);

	await finalize(guild_id, memberId, before, 'asset-buy');
	return { ok: true, position, price: market.price };
}

export async function handleAssetSell(_client: any, payload: any) {
	const { guild_id, actor_discord_id, position_id, amount } = payload || {};
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

	const market = await getAssetPrice(position.asset_type, position.asset_id);
	if (!market || market.price <= 0) return { ok: false, error: 'price_unavailable' };

	const buyPrice = Number(position.buy_price) || 0;
	const invested = Number(position.xp_invested) || 0;
	const currentValue = buyPrice > 0 ? Math.round(invested * (market.price / buyPrice)) : invested;

	const requested = Math.floor(Number(amount) || 0);
	const targetPayout = requested > 0 ? Math.min(requested, currentValue) : currentValue;
	if (targetPayout <= 0) return { ok: false, error: 'invalid_amount' };

	const full = targetPayout >= currentValue;
	const soldInvested = full ? invested : Math.max(1, Math.min(invested, Math.round(invested * (targetPayout / currentValue))));
	const payout = full ? currentValue : buyPrice > 0 ? Math.max(0, Math.round(soldInvested * (market.price / buyPrice))) : soldInvested;

	const before = await db.getMemberLevel(memberId).catch(() => null);
	await db.ensureMemberLevel(memberId);
	await db.updateMemberLevelStats(memberId, { experienceIncrement: payout });
	if (full) {
		await db.closeAssetPosition(position_id);
	} else {
		await db.reduceAssetPosition(position_id, { sold_invested: soldInvested });
	}
	await db
		.logAssetEvent({
			member_id: memberId,
			action: 'sell',
			asset_type: position.asset_type,
			asset_id: position.asset_id,
			symbol: position.symbol,
			asset_name: position.asset_name,
			asset_image: position.asset_image ?? null,
			xp_amount: payout,
			price: market.price,
			net: payout - soldInvested
		})
		.catch(() => null);
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
	const rows = ((await db.getOpenAssetPositions(memberId).catch(() => [])) as any[]) || [];

	const cachedPrices = (await cacheGet(PRICES_KEY))?.map ?? {};
	const marketByKey = new Map<string, { price: number; change24h: number }>();
	const needFetch = new Set<string>();
	for (const p of rows) {
		const key = `${p.asset_type}:${p.asset_id}`;
		const hit = cachedPrices[key];
		if (hit && Number(hit.price) > 0) {
			marketByKey.set(key, { price: Number(hit.price), change24h: Number(hit.change24h) || 0 });
		} else if (p.asset_type === 'crypto') {
			needFetch.add(String(p.asset_id));
		}
	}
	if (needFetch.size > 0) {
		const prices = await fetchPricesFor([...needFetch]).catch(() => ({}));
		for (const [id, p] of Object.entries(prices)) marketByKey.set(`crypto:${id}`, p);
	}

	const positions: any[] = [];
	let totalInvested = 0;
	let totalValue = 0;
	for (const p of rows) {
		const invested = Number(p.xp_invested) || 0;
		const buyPrice = Number(p.buy_price) || 0;
		const market = marketByKey.get(`${p.asset_type}:${p.asset_id}`) ?? null;
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
