import axios from 'axios';

export type RobloxCatalogSearchItem = {
	id: number;
	itemType?: string;
	assetType?: number;
	name?: string;
	description?: string;
	creatorType?: string;
	creatorTargetId?: number;
	creatorName?: string;
	creatorHasVerifiedBadge?: boolean;
	price?: number;
	lowestPrice?: number;
	lowestResalePrice?: number;
	totalQuantity?: number;
	collectibleItemId?: string | null;
	hasResellers?: boolean;
	itemCreatedUtc?: string | null;
};

type RobloxCatalogDetailsResponse = {
	previousPageCursor?: string | null;
	nextPageCursor?: string | null;
	data?: any[];
};

type RobloxThumbV1Response = {
	data?: { targetId?: number; imageUrl?: string | null; state?: string | null }[];
};

export function robloxCatalogItemUrl(assetId: number): string {
	return `https://www.roblox.com/catalog/${assetId}`;
}

export function isRobloxOfficialCreator(creatorName?: string | null, creatorTargetId?: number | null): boolean {
	if (typeof creatorTargetId === 'number' && creatorTargetId === 1) return true;
	return typeof creatorName === 'string' && creatorName.trim().toLowerCase() === 'roblox';
}

export function inferIsLimitedFromSearch(it: Partial<RobloxCatalogSearchItem>): boolean {
	if (it.hasResellers === true) return true;
	if (typeof it.lowestResalePrice === 'number' && it.lowestResalePrice > 0) return true;
	if (typeof it.totalQuantity === 'number' && it.totalQuantity > 0 && typeof it.price === 'number' && it.price > 0) return true;
	return false;
}

export function inferIsFreeFromSearch(it: Partial<RobloxCatalogSearchItem>): boolean {
	return typeof it.price === 'number' && it.price === 0;
}

export function robloxAssetTypeLabel(assetType: number | null | undefined): string | null {
	const id = typeof assetType === 'number' && Number.isFinite(assetType) ? assetType : null;
	if (id == null) return null;
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
		48: 'Animation (Climb)',
		50: 'Animation (Fall)',
		51: 'Animation (Idle)',
		52: 'Animation (Jump)',
		53: 'Animation (Run)',
		54: 'Animation (Swim)',
		55: 'Animation (Walk)',
		61: 'Emote',
		65: 'T-Shirt',
		66: 'Shirt',
		67: 'Pants',
		76: 'Eyebrows',
		78: 'Face Mood',
		79: 'Head',
		88: 'Face Makeup'
	};
	return m[id] || null;
}

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

export async function fetchRobloxThumbnailUrls(items: { id: number; itemType?: string | null }[]): Promise<Map<number, string>> {
	const assets = items.filter((x) => Number.isFinite(Number(x.id)) && String(x.itemType || 'Asset') === 'Asset').map((x) => Number(x.id));
	const bundles = items.filter((x) => Number.isFinite(Number(x.id)) && String(x.itemType || '') === 'Bundle').map((x) => Number(x.id));

	const out = new Map<number, string>();

	for (const ids of chunk(assets, 100)) {
		const res = await axios.get<RobloxThumbV1Response>('https://thumbnails.roblox.com/v1/assets', {
			params: { assetIds: ids.join(','), size: '420x420', format: 'Png', isCircular: 'false' },
			headers: { 'User-Agent': 'dansday-discord-bot/roblox-catalog-notifier' },
			timeout: 15_000
		});
		const rows = Array.isArray(res.data?.data) ? res.data!.data! : [];
		for (const r of rows) {
			const id = Number(r?.targetId);
			const url = typeof r?.imageUrl === 'string' ? r.imageUrl.trim() : '';
			if (Number.isFinite(id) && url.startsWith('http')) out.set(id, url);
		}
	}

	for (const ids of chunk(bundles, 100)) {
		const res = await axios.get<RobloxThumbV1Response>('https://thumbnails.roblox.com/v1/bundles', {
			params: { bundleIds: ids.join(','), size: '420x420', format: 'Png', isCircular: 'false' },
			headers: { 'User-Agent': 'dansday-discord-bot/roblox-catalog-notifier' },
			timeout: 15_000
		});
		const rows = Array.isArray(res.data?.data) ? res.data!.data! : [];
		for (const r of rows) {
			const id = Number(r?.targetId);
			const url = typeof r?.imageUrl === 'string' ? r.imageUrl.trim() : '';
			if (Number.isFinite(id) && url.startsWith('http')) out.set(id, url);
		}
	}

	return out;
}

export async function fetchRobloxCatalogSearchDetails(opts?: {
	category?: number;
	limit?: number;
	sortType?: number;
	cursor?: string;
}): Promise<{ items: RobloxCatalogSearchItem[]; nextCursor: string | null }> {
	const limit = Math.max(1, Math.min(120, Number(opts?.limit ?? 30)));
	const sortType = Number.isFinite(Number(opts?.sortType)) ? Number(opts?.sortType) : 3;
	const params: Record<string, any> = { Limit: limit, SortType: sortType };
	if (opts?.cursor) params.Cursor = opts.cursor;
	if (Number.isFinite(Number(opts?.category))) params.Category = Number(opts?.category);

	const res = await axios.get<RobloxCatalogDetailsResponse>('https://catalog.roblox.com/v2/search/items/details', {
		params,
		headers: { 'User-Agent': 'dansday-discord-bot/roblox-catalog-notifier' },
		timeout: 15_000
	});

	const payload = res.data || {};
	const data = Array.isArray(payload.data) ? payload.data : [];

	const items: RobloxCatalogSearchItem[] = data
		.map((x: any) => {
			const id = Number(x?.id);
			if (!Number.isFinite(id)) return null;
			return {
				id,
				itemType: typeof x?.itemType === 'string' ? x.itemType : undefined,
				assetType: Number.isFinite(Number(x?.assetType)) ? Number(x.assetType) : undefined,
				name: typeof x?.name === 'string' ? x.name : undefined,
				description: typeof x?.description === 'string' ? x.description : undefined,
				creatorType: typeof x?.creatorType === 'string' ? x.creatorType : undefined,
				creatorTargetId: Number.isFinite(Number(x?.creatorTargetId)) ? Number(x.creatorTargetId) : undefined,
				creatorName: typeof x?.creatorName === 'string' ? x.creatorName : undefined,
				creatorHasVerifiedBadge: x?.creatorHasVerifiedBadge === true,
				price: Number.isFinite(Number(x?.price)) ? Number(x.price) : undefined,
				lowestPrice: Number.isFinite(Number(x?.lowestPrice)) ? Number(x.lowestPrice) : undefined,
				lowestResalePrice: Number.isFinite(Number(x?.lowestResalePrice)) ? Number(x.lowestResalePrice) : undefined,
				totalQuantity: Number.isFinite(Number(x?.totalQuantity)) ? Number(x.totalQuantity) : undefined,
				collectibleItemId: typeof x?.collectibleItemId === 'string' ? x.collectibleItemId : null,
				hasResellers: x?.hasResellers === true,
				itemCreatedUtc: typeof x?.itemCreatedUtc === 'string' ? x.itemCreatedUtc : null
			};
		})
		.filter(Boolean) as RobloxCatalogSearchItem[];

	return { items, nextCursor: typeof payload.nextPageCursor === 'string' ? payload.nextPageCursor : null };
}
