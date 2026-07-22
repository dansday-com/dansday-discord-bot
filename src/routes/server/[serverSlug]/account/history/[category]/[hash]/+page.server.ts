import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

const PER_PAGE = 50;

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { server, accountEnabled, itemsEnabled, assetsEnabled, minigamesEnabled } = await parent();

	if (!accountEnabled) redirect(303, '/');

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, '/');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const tabParam = String(params.category || 'all');
	const allowed = new Set(['all', 'level']);
	if (itemsEnabled) allowed.add('items');
	if (assetsEnabled) allowed.add('assets');
	if (minigamesEnabled) allowed.add('minigames');
	const tab = allowed.has(tabParam) ? tabParam : 'all';

	const itemRows = itemsEnabled ? await db.getMemberItemHistory(shared.member.id, 0).catch(() => []) : [];
	const itemEvents = (itemRows as any[]).map((h) => ({
		id: `i-${h.id}`,
		kind: 'item' as const,
		action: h.action,
		effect_type: h.effect_type ?? null,
		itemName: h.item_name ?? null,
		outcome: h.outcome,
		xpAmount: Number(h.xp_amount) || 0,
		ratePercent: h.rate_percent != null ? Number(h.rate_percent) : null,
		luckPercent: h.luck_percent != null ? Number(h.luck_percent) : null,
		direction: h.direction === 'incoming' ? 'incoming' : 'outgoing',
		targetName: h.target_server_display_name || h.target_display_name || h.target_username || null,
		actorName:
			h.direction === 'incoming' && Number(h.actor_disguised) === 1 && !(h.action === 'spy' && h.outcome === 'caught')
				? null
				: h.actor_server_display_name || h.actor_display_name || h.actor_username || null,
		actorDisguised: Number(h.actor_disguised) === 1,
		at: h.created_at ? new Date(h.created_at).getTime() : null
	}));

	const levelRows = await db.getMemberLevelHistory(shared.member.id, 0).catch(() => []);
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
		luckPercent: x.luck_percent != null ? Number(x.luck_percent) : null,
		at: x.created_at ? new Date(x.created_at).getTime() : null
	}));

	const assetRows = assetsEnabled ? await db.getMemberAssetHistory(shared.member.id, 0).catch(() => []) : [];
	const assetEvents = (assetRows as any[]).map((r) => ({
		id: `a-${r.id}`,
		kind: 'asset' as const,
		action: r.action,
		symbol: r.symbol,
		assetName: r.asset_name,
		assetImage: r.asset_image ?? null,
		xpAmount: Number(r.xp_amount) || 0,
		net: Number(r.net) || 0,
		price: Number(r.price) || 0,
		at: r.created_at ? new Date(r.created_at).getTime() : null
	}));

	const minigameRows = minigamesEnabled ? await db.getMemberMinigameHistory(shared.member.id, 0).catch(() => []) : [];
	const minigameEvents = (minigameRows as any[]).map((h) => ({
		id: `m-${h.id}`,
		kind: 'minigame' as const,
		game: h.game,
		multiplier: Number(h.multiplier) || 0,
		wager: Number(h.wager) || 0,
		payout: Number(h.payout) || 0,
		xpAmount: Number(h.xp_amount) || 0,
		outcome: h.outcome,
		chance: h.chance != null ? Number(h.chance) : null,
		luckPercent: h.luck_percent != null ? Number(h.luck_percent) : null,
		at: h.created_at ? new Date(h.created_at).getTime() : null
	}));

	const events =
		tab === 'items'
			? itemEvents
			: tab === 'level'
				? levelEvents
				: tab === 'assets'
					? assetEvents
					: tab === 'minigames'
						? minigameEvents
						: [...itemEvents, ...levelEvents, ...assetEvents, ...minigameEvents].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

	const totalPages = Math.max(1, Math.ceil(events.length / PER_PAGE));
	const reqPage = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
	const historyPage = Math.min(reqPage, totalPages);
	const pagedHistory = events.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE);

	return { ...shared, tab, historyTotal: events.length, historyPage, totalPages, pagedHistory };
};
