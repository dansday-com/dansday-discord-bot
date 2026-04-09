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
	price?: number;
	lowestPrice?: number;
	lowestResalePrice?: number;
	totalQuantity?: number;
	collectibleItemId?: string | null;
	itemCreatedUtc?: string | null;
};

type RobloxCatalogDetailsResponse = {
	previousPageCursor?: string | null;
	nextPageCursor?: string | null;
	data?: any[];
};

export function robloxCatalogItemUrl(assetId: number): string {
	return `https://www.roblox.com/catalog/${assetId}`;
}

export function isRobloxOfficialCreator(creatorName?: string | null, creatorTargetId?: number | null): boolean {
	if (typeof creatorTargetId === 'number' && creatorTargetId === 1) return true;
	return typeof creatorName === 'string' && creatorName.trim().toLowerCase() === 'roblox';
}

export function inferIsLimitedFromSearch(it: Partial<RobloxCatalogSearchItem>): boolean {
	if (typeof it.collectibleItemId === 'string' && it.collectibleItemId.trim()) return true;
	if (typeof it.totalQuantity === 'number' && it.totalQuantity > 0) return true;
	if (typeof it.lowestResalePrice === 'number' && it.lowestResalePrice > 0) return true;
	return false;
}

export function inferIsFreeFromSearch(it: Partial<RobloxCatalogSearchItem>): boolean {
	return typeof it.price === 'number' && it.price === 0;
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
				price: Number.isFinite(Number(x?.price)) ? Number(x.price) : undefined,
				lowestPrice: Number.isFinite(Number(x?.lowestPrice)) ? Number(x.lowestPrice) : undefined,
				lowestResalePrice: Number.isFinite(Number(x?.lowestResalePrice)) ? Number(x.lowestResalePrice) : undefined,
				totalQuantity: Number.isFinite(Number(x?.totalQuantity)) ? Number(x.totalQuantity) : undefined,
				collectibleItemId: typeof x?.collectibleItemId === 'string' ? x.collectibleItemId : null,
				itemCreatedUtc: typeof x?.itemCreatedUtc === 'string' ? x.itemCreatedUtc : null
			};
		})
		.filter(Boolean) as RobloxCatalogSearchItem[];

	return { items, nextCursor: typeof payload.nextPageCursor === 'string' ? payload.nextPageCursor : null };
}
