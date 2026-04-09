import axios from 'axios';

export type RobloxCatalogItem = {
	id: number;
	assetType?: number;
	name?: string;
	description?: string;
	creatorName?: string;
	price?: number;
	lowestPrice?: number;
	lowestResalePrice?: number;
	totalQuantity?: number;
	itemCreatedUtc?: string;
	thumbnailUrl?: string | null;
};

const ROBLOX_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	'Accept': 'application/json'
};

async function fetchWithRetry(url: string, params: Record<string, any>): Promise<any> {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await axios.get(url, { params, headers: ROBLOX_HEADERS, timeout: 15_000 });
			return res.data;
		} catch (err: any) {
			const status = err?.response?.status;
			if ((status === 503 || status === 429) && attempt < 2) {
				await new Promise((r) => setTimeout(r, 10_000 * (attempt + 1)));
				continue;
			}
			throw err;
		}
	}
}

async function fetchCatalogPages(extraParams: Record<string, any>): Promise<RobloxCatalogItem[]> {
	const all: RobloxCatalogItem[] = [];
	let cursor: string | undefined = undefined;
	let first = true;

	while (true) {
		const params: Record<string, any> = { Limit: 120, SortType: 3, ...extraParams };
		if (cursor) params.Cursor = cursor;

		const data = await fetchWithRetry('https://catalog.roblox.com/v2/search/items/details', params);

		const rows = Array.isArray(data?.data) ? data.data : [];
		for (const x of rows) {
			if (!Number.isFinite(Number(x?.id))) continue;
			all.push({
				id: Number(x.id),
				assetType: Number.isFinite(Number(x?.assetType)) ? Number(x.assetType) : undefined,
				name: typeof x.name === 'string' ? x.name : undefined,
				description: typeof x.description === 'string' ? x.description : undefined,
				creatorName: typeof x.creatorName === 'string' ? x.creatorName : undefined,
				price: Number.isFinite(Number(x?.price)) ? Number(x.price) : undefined,
				lowestPrice: Number.isFinite(Number(x?.lowestPrice)) ? Number(x.lowestPrice) : undefined,
				lowestResalePrice: Number.isFinite(Number(x?.lowestResalePrice)) ? Number(x.lowestResalePrice) : undefined,
				totalQuantity: Number.isFinite(Number(x?.totalQuantity)) ? Number(x.totalQuantity) : undefined,
				itemCreatedUtc: typeof x.itemCreatedUtc === 'string' ? x.itemCreatedUtc : undefined,
				thumbnailUrl: null
			});
		}

		const nextCursor = typeof data?.nextPageCursor === 'string' ? data.nextPageCursor : null;
		if (!nextCursor) break;
		cursor = nextCursor;
		if (!first) await new Promise((r) => setTimeout(r, 5_000));
		first = false;
	}

	return all;
}

async function fetchThumbnailUrls(items: RobloxCatalogItem[]): Promise<Map<number, string>> {
	const out = new Map<number, string>();
	const ids = items.map((x) => x.id);
	if (ids.length === 0) return out;

	const res = await axios.get('https://thumbnails.roblox.com/v1/assets', {
		params: { assetIds: ids.join(','), size: '420x420', format: 'Png', isCircular: 'false' },
		headers: ROBLOX_HEADERS,
		timeout: 15_000
	});

	for (const r of Array.isArray(res.data?.data) ? res.data.data : []) {
		const id = Number(r?.targetId);
		const url = typeof r?.imageUrl === 'string' ? r.imageUrl.trim() : '';
		if (Number.isFinite(id) && url.startsWith('http')) out.set(id, url);
	}

	return out;
}

export async function fetchAllCatalogItems(): Promise<RobloxCatalogItem[]> {
	const robloxItems = await fetchCatalogPages({ CreatorType: 1, CreatorTargetId: 1 });
	await new Promise((r) => setTimeout(r, 5_000));
	const limitedItems = await fetchCatalogPages({ SalesTypeFilter: 2 });

	const seen = new Set<number>();
	const merged: RobloxCatalogItem[] = [];
	for (const item of [...robloxItems, ...limitedItems]) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		merged.push(item);
	}

	if (merged.length > 0) {
		const thumbMap = await fetchThumbnailUrls(merged);
		for (const item of merged) {
			item.thumbnailUrl = thumbMap.get(item.id) ?? null;
		}
	}

	return merged;
}

export function robloxCatalogItemUrl(id: number): string {
	return `https://www.roblox.com/catalog/${id}`;
}

export function assetTypeCategory(assetType: number | undefined | null): string | null {
	if (assetType == null) return null;
	const m: Record<number, string> = {
		8: 'Hat',
		11: 'Shirt',
		12: 'Pants',
		17: 'Head',
		18: 'Face',
		27: 'Torso',
		28: 'Right Arm',
		29: 'Left Arm',
		30: 'Left Leg',
		31: 'Right Leg',
		41: 'Hair',
		42: 'Face Accessory',
		43: 'Neck Accessory',
		44: 'Shoulder Accessory',
		45: 'Front Accessory',
		46: 'Back Accessory',
		47: 'Waist Accessory',
		48: 'Climb Animation',
		50: 'Fall Animation',
		51: 'Idle Animation',
		52: 'Jump Animation',
		53: 'Run Animation',
		54: 'Swim Animation',
		55: 'Walk Animation',
		61: 'Emote',
		65: 'T-Shirt',
		66: 'Shirt',
		67: 'Pants',
		76: 'Eyebrows',
		78: 'Face Mood',
		79: 'Head',
		88: 'Face Makeup'
	};
	return m[assetType] ?? null;
}
