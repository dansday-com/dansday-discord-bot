import axios from 'axios';
import { fetchApi } from 'rozod';
import { getSearchItemsDetails } from 'rozod/lib/endpoints/catalogv2.js';
import { ROBLOX_CATALOG_ABORT_MS, ROBLOX_CATALOG_NEXT_PAGE_MS, ROBLOX_CATALOG_POLL_MS } from '../config.js';
import { logger } from '../../utils/index.js';

export type RobloxCatalogItem = {
	id: number;
	assetType?: number;
	category?: string;
	name?: string;
	description?: string;
	creatorName?: string;
	creatorHasVerifiedBadge?: boolean;
	price?: number;
	lowestResalePrice?: number;
	unitsAvailable?: number;
	totalQuantity?: number;
	favoriteCount?: number;
	hasResellers?: boolean;
	offSaleDeadline?: string | null;
	itemCreatedUtc?: string;
	thumbnailUrl?: string | null;
};

const ROBLOX_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	Accept: 'application/json'
};

function taxonomyCategory(tax: unknown): string | undefined {
	if (!Array.isArray(tax) || tax.length === 0) return undefined;
	const names = tax.map((t: { taxonomyName?: string }) => (typeof t?.taxonomyName === 'string' ? t.taxonomyName.trim() : '')).filter(Boolean);
	return names.length ? names.join(', ') : undefined;
}

function mapCatalogRow(x: Record<string, unknown>): RobloxCatalogItem | null {
	if (!Number.isFinite(Number(x?.id))) return null;
	const offRaw = x.offSaleDeadline;
	const offSaleDeadline = typeof offRaw === 'string' && offRaw.length > 0 ? offRaw : null;
	return {
		id: Number(x.id),
		assetType: Number.isFinite(Number(x?.assetType)) ? Number(x.assetType) : undefined,
		category: taxonomyCategory(x.taxonomy),
		name: typeof x.name === 'string' ? x.name : undefined,
		description: typeof x.description === 'string' ? x.description : undefined,
		creatorName: typeof x.creatorName === 'string' ? x.creatorName : undefined,
		creatorHasVerifiedBadge: x.creatorHasVerifiedBadge === true,
		price: Number.isFinite(Number(x?.price)) ? Number(x.price) : undefined,
		lowestResalePrice: Number.isFinite(Number(x?.lowestResalePrice)) ? Number(x.lowestResalePrice) : undefined,
		unitsAvailable: Number.isFinite(Number(x?.unitsAvailableForConsumption)) ? Number(x.unitsAvailableForConsumption) : undefined,
		totalQuantity: Number.isFinite(Number(x?.totalQuantity)) ? Number(x.totalQuantity) : undefined,
		favoriteCount: Number.isFinite(Number(x?.favoriteCount)) ? Number(x.favoriteCount) : undefined,
		hasResellers: x.hasResellers === true,
		offSaleDeadline,
		itemCreatedUtc: typeof x.itemCreatedUtc === 'string' ? x.itemCreatedUtc : undefined,
		thumbnailUrl: null
	};
}

async function fetchCatalogJson(params: Record<string, unknown>): Promise<{ data: Record<string, unknown>[]; nextPageCursor: string | null }> {
	while (true) {
		try {
			const data = await fetchApi(getSearchItemsDetails, params as any, {
				throwOnError: true,
				retries: 0,
				signal: AbortSignal.timeout(ROBLOX_CATALOG_ABORT_MS)
			});
			const rows = Array.isArray(data?.data) ? data.data : [];
			const next = typeof data?.nextPageCursor === 'string' ? data.nextPageCursor : null;
			return { data: rows as Record<string, unknown>[], nextPageCursor: next };
		} catch (err: unknown) {
			const status = (err as { response?: { status?: number } })?.response?.status;
			const msg = err instanceof Error ? err.message : String(err);
			logger.log(`⚠️ [roblox-api] catalog fetch failed ${status ?? '?'} — ${msg}, retrying in ${ROBLOX_CATALOG_POLL_MS / 1000}s...`);
			await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_POLL_MS));
		}
	}
}

function filterVerifiedCreators(items: RobloxCatalogItem[]): RobloxCatalogItem[] {
	return items.filter((x) => x.creatorHasVerifiedBadge === true);
}

export async function fetchCatalogFirstPage(extraParams: Record<string, unknown>): Promise<RobloxCatalogItem[]> {
	const { data } = await fetchCatalogJson({ limit: 120, ...extraParams });
	const items = filterVerifiedCreators(data.map((row) => mapCatalogRow(row)).filter((x): x is RobloxCatalogItem => x != null));
	if (items.length > 0) {
		const thumbMap = await fetchThumbnailUrls(items);
		for (const item of items) item.thumbnailUrl = thumbMap.get(item.id) ?? null;
	}
	return items;
}

export async function streamCatalogPages(extraParams: Record<string, unknown>, onPage: (items: RobloxCatalogItem[]) => Promise<void>): Promise<void> {
	let cursor: string | undefined;

	while (true) {
		const params: Record<string, unknown> = { limit: 120, ...extraParams };
		if (cursor) params.cursor = cursor;

		const { data, nextPageCursor } = await fetchCatalogJson(params);
		const items = filterVerifiedCreators(data.map((row) => mapCatalogRow(row)).filter((x): x is RobloxCatalogItem => x != null));

		if (items.length > 0) {
			const thumbMap = await fetchThumbnailUrls(items);
			for (const item of items) item.thumbnailUrl = thumbMap.get(item.id) ?? null;
			await onPage(items);
		}

		cursor = nextPageCursor ?? undefined;
		if (!cursor) break;
		await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_NEXT_PAGE_MS));
	}
}

async function fetchThumbnailUrls(items: RobloxCatalogItem[]): Promise<Map<number, string>> {
	const out = new Map<number, string>();
	const ids = items.map((x) => x.id);
	if (ids.length === 0) return out;

	for (let i = 0; i < ids.length; i += 100) {
		const chunk = ids.slice(i, i + 100);
		const data = await fetchWithRetry('https://thumbnails.roblox.com/v1/assets', {
			assetIds: chunk.join(','),
			size: '420x420',
			format: 'Png',
			isCircular: 'false'
		});
		for (const r of Array.isArray(data?.data) ? data.data : []) {
			const id = Number(r?.targetId);
			const url = typeof r?.imageUrl === 'string' ? r.imageUrl.trim() : '';
			if (Number.isFinite(id) && url.startsWith('http')) out.set(id, url);
		}
	}

	return out;
}

async function fetchWithRetry(url: string, params: Record<string, unknown>): Promise<any> {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await axios.get(url, { params, headers: ROBLOX_HEADERS, timeout: 15_000 });
			return res.data;
		} catch (err: any) {
			const status = err?.response?.status;
			const body = err?.response?.data ? JSON.stringify(err.response.data) : err?.message;
			if ((status === 503 || status === 429) && attempt < 2) {
				await new Promise((r) => setTimeout(r, 30_000 * (attempt + 1)));
				continue;
			}
			throw new Error(`[roblox-api] thumbnails failed ${status} — ${body}`);
		}
	}
}

export function robloxCatalogItemUrl(id: number): string {
	return `https://www.roblox.com/catalog/${id}`;
}
