import axios from 'axios';

export type RobloxCatalogItem = {
	id: number;
	assetType?: number;
	name?: string;
	description?: string;
	creatorName?: string;
	creatorHasVerifiedBadge?: boolean;
	price?: number;
	lowestPrice?: number;
	lowestResalePrice?: number;
	totalQuantity?: number;
	itemCreatedUtc?: string;
	thumbnailUrl?: string | null;
};

export async function fetchCatalogPage(cursor?: string): Promise<{ items: RobloxCatalogItem[]; nextCursor: string | null }> {
	const params: Record<string, any> = { Limit: 120, SortType: 3 };
	if (cursor) params.Cursor = cursor;

	const res = await axios.get('https://catalog.roblox.com/v2/search/items/details', {
		params,
		headers: { 'User-Agent': 'dansday-discord-bot/roblox-catalog-notifier' },
		timeout: 15_000
	});

	const data = Array.isArray(res.data?.data) ? res.data.data : [];
	const items: RobloxCatalogItem[] = data
		.filter((x: any) => Number.isFinite(Number(x?.id)))
		.map((x: any) => ({
			id: Number(x.id),
			assetType: Number.isFinite(Number(x?.assetType)) ? Number(x.assetType) : undefined,
			name: typeof x.name === 'string' ? x.name : undefined,
			description: typeof x.description === 'string' ? x.description : undefined,
			creatorName: typeof x.creatorName === 'string' ? x.creatorName : undefined,
			creatorHasVerifiedBadge: x.creatorHasVerifiedBadge === true,
			price: Number.isFinite(Number(x?.price)) ? Number(x.price) : undefined,
			lowestPrice: Number.isFinite(Number(x?.lowestPrice)) ? Number(x.lowestPrice) : undefined,
			lowestResalePrice: Number.isFinite(Number(x?.lowestResalePrice)) ? Number(x.lowestResalePrice) : undefined,
			totalQuantity: Number.isFinite(Number(x?.totalQuantity)) ? Number(x.totalQuantity) : undefined,
			itemCreatedUtc: typeof x.itemCreatedUtc === 'string' ? x.itemCreatedUtc : undefined,
			thumbnailUrl: null
		}));

	return {
		items,
		nextCursor: typeof res.data?.nextPageCursor === 'string' ? res.data.nextPageCursor : null
	};
}

export async function fetchThumbnailUrls(items: RobloxCatalogItem[]): Promise<Map<number, string>> {
	const out = new Map<number, string>();
	const ids = items.map((x) => x.id);
	if (ids.length === 0) return out;

	const res = await axios.get('https://thumbnails.roblox.com/v1/assets', {
		params: { assetIds: ids.join(','), size: '420x420', format: 'Png', isCircular: 'false' },
		headers: { 'User-Agent': 'dansday-discord-bot/roblox-catalog-notifier' },
		timeout: 15_000
	});

	for (const r of Array.isArray(res.data?.data) ? res.data.data : []) {
		const id = Number(r?.targetId);
		const url = typeof r?.imageUrl === 'string' ? r.imageUrl.trim() : '';
		if (Number.isFinite(id) && url.startsWith('http')) out.set(id, url);
	}

	return out;
}

export async function fetchAllCatalogVerifiedCreators(): Promise<RobloxCatalogItem[]> {
	const all: RobloxCatalogItem[] = [];
	let cursor: string | undefined = undefined;
	let first = true;

	while (true) {
		const { items, nextCursor } = await fetchCatalogPage(cursor);
		const verified = items.filter((x) => x.creatorHasVerifiedBadge);

		if (verified.length > 0) {
			const thumbMap = await fetchThumbnailUrls(verified);
			for (const item of verified) {
				item.thumbnailUrl = thumbMap.get(item.id) ?? null;
			}
			all.push(...verified);
		}

		if (!nextCursor) break;
		cursor = nextCursor;
		if (!first) await new Promise((r) => setTimeout(r, 5_000));
		first = false;
	}

	return all;
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
