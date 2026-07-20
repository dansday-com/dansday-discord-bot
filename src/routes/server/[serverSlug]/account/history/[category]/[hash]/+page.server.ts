import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

const PER_PAGE = 12;

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { server } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');
	if (shared.readOnly || !shared.member) redirect(303, `${publicServerPath(server.slug)}/account/shop/all/guest`);

	const tabParam = String(params.category || 'all');
	const tab = tabParam === 'items' || tabParam === 'level' || tabParam === 'assets' ? tabParam : 'all';

	const itemRows = await db.getMemberItemHistory(shared.member.id, 600).catch(() => []);
	const itemEvents = (itemRows as any[]).map((h) => ({
		id: `i-${h.id}`,
		kind: 'item' as const,
		action: h.action,
		effect_type: h.effect_type ?? null,
		itemName: h.item_name ?? null,
		outcome: h.outcome,
		xpAmount: Number(h.xp_amount) || 0,
		direction: h.direction === 'incoming' ? 'incoming' : 'outgoing',
		targetName: h.target_server_display_name || h.target_display_name || h.target_username || null,
		actorName:
			h.direction === 'incoming' && Number(h.actor_disguised) === 1 && !(h.action === 'spy' && h.outcome === 'caught')
				? null
				: h.actor_server_display_name || h.actor_display_name || h.actor_username || null,
		actorDisguised: Number(h.actor_disguised) === 1,
		at: h.created_at ? new Date(h.created_at).getTime() : null
	}));

	const levelRows = await db.getMemberLevelHistory(shared.member.id, 600).catch(() => []);
	const levelEvents = (levelRows as any[]).map((x) => ({
		id: `l-${x.id}`,
		kind: 'level' as const,
		source: x.source,
		xpAmount: Number(x.amount) || 0,
		totalXp: x.total_xp != null ? Number(x.total_xp) : null,
		level: x.level != null ? Number(x.level) : null,
		rank: x.rank != null ? Number(x.rank) : null,
		multiplier: x.multiplier != null ? Number(x.multiplier) : null,
		skimPercent: x.skim_percent != null ? Number(x.skim_percent) : null,
		friendPercent: x.friend_percent != null ? Number(x.friend_percent) : null,
		at: x.created_at ? new Date(x.created_at).getTime() : null
	}));

	const assetRows = await db.getMemberAssetHistory(shared.member.id, 600).catch(() => []);
	const assetEvents: any[] = [];
	for (const p of assetRows as any[]) {
		const invested = Number(p.xp_invested) || 0;
		const openedAt = p.opened_at ? new Date(p.opened_at).getTime() : null;
		assetEvents.push({
			id: `a-buy-${p.id}`,
			kind: 'asset' as const,
			action: 'buy',
			symbol: p.symbol,
			assetName: p.asset_name,
			assetImage: p.asset_image ?? null,
			xpAmount: invested,
			price: Number(p.buy_price) || 0,
			at: openedAt
		});
		if (p.status === 'closed') {
			const returned = Number(p.xp_returned) || 0;
			assetEvents.push({
				id: `a-sell-${p.id}`,
				kind: 'asset' as const,
				action: 'sell',
				symbol: p.symbol,
				assetName: p.asset_name,
				assetImage: p.asset_image ?? null,
				xpAmount: returned,
				net: returned - invested,
				price: Number(p.sell_price) || 0,
				at: p.closed_at ? new Date(p.closed_at).getTime() : openedAt
			});
		}
	}

	const events =
		tab === 'items'
			? itemEvents
			: tab === 'level'
				? levelEvents
				: tab === 'assets'
					? assetEvents
					: [...itemEvents, ...levelEvents, ...assetEvents].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

	const totalPages = Math.max(1, Math.ceil(events.length / PER_PAGE));
	const reqPage = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
	const historyPage = Math.min(reqPage, totalPages);
	const pagedHistory = events.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE);

	return { ...shared, tab, historyTotal: events.length, historyPage, totalPages, pagedHistory };
};
