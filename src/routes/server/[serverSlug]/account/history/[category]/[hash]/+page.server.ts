import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome } from '$lib/url.js';
import db from '$lib/database.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { HTTP } from '$lib/http.js';

const PER_PAGE = 50;

type ItemRow = Awaited<ReturnType<typeof db.getMemberItemHistory>>[number];
type LevelRow = Awaited<ReturnType<typeof db.getMemberLevelHistory>>[number];
type AssetRow = Awaited<ReturnType<typeof db.getMemberAssetHistory>>[number];
type MinigameRow = Awaited<ReturnType<typeof db.getMemberMinigameHistory>>[number];
type HistoryFlags = { areItemsEnabled: boolean; isMarketEnabled: boolean; areMinigamesEnabled: boolean };

const numberOrNull = (value: unknown) => (value != null ? Number(value) : null);
const timeOf = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() : null);

function itemEvent(h: ItemRow) {
	const isHiddenActor = h.direction === 'incoming' && Number(h.actor_disguised) === 1 && !(h.action === 'spy' && h.outcome === 'caught');
	return {
		id: `i-${h.id}`,
		kind: 'item' as const,
		action: h.action,
		effect_type: h.effect_type ?? null,
		itemName: h.item_name ?? null,
		outcome: h.outcome,
		xpAmount: Number(h.xp) || 0,
		ratePercent: numberOrNull(h.rate_percent),
		luckPercent: numberOrNull(h.luck_percent),
		direction: h.direction === 'incoming' ? 'incoming' : 'outgoing',
		targetName: h.target_server_display_name || h.target_display_name || h.target_username || null,
		actorName: isHiddenActor ? null : h.actor_server_display_name || h.actor_display_name || h.actor_username || null,
		actorDisguised: Number(h.actor_disguised) === 1,
		at: timeOf(h.created_at)
	};
}

function levelEvent(x: LevelRow) {
	return {
		id: `l-${x.id}`,
		kind: 'level' as const,
		source: x.source,
		xpAmount: Number(x.xp) || 0,
		totalXp: numberOrNull(x.xp_total),
		level: numberOrNull(x.level),
		rank: numberOrNull(x.rank),
		multiplier: numberOrNull(x.multiplier),
		skimPercent: numberOrNull(x.skim_percent),
		friendPercent: numberOrNull(x.friend_percent),
		luckPercent: numberOrNull(x.luck_percent),
		at: timeOf(x.created_at)
	};
}

function assetEvent(r: AssetRow) {
	return {
		id: `a-${r.id}`,
		kind: 'asset' as const,
		action: r.action,
		symbol: r.symbol,
		assetName: r.asset_name,
		assetImage: r.asset_image ?? null,
		xpAmount: Number(r.xp) || 0,
		net: Number(r.net) || 0,
		price: Number(r.price) || 0,
		at: timeOf(r.created_at)
	};
}

function minigameEvent(h: MinigameRow) {
	return {
		id: `m-${h.id}`,
		kind: 'minigame' as const,
		game: h.game,
		multiplier: Number(h.multiplier) || 0,
		wager: Number(h.wager) || 0,
		payout: Number(h.payout) || 0,
		xpAmount: Number(h.xp) || 0,
		outcome: h.outcome,
		chance: numberOrNull(h.chance),
		luckPercent: numberOrNull(h.luck_percent),
		at: timeOf(h.created_at)
	};
}

type HistoryEvent = ReturnType<typeof itemEvent> | ReturnType<typeof levelEvent> | ReturnType<typeof assetEvent> | ReturnType<typeof minigameEvent>;

function historyTab(category: string | undefined, flags: HistoryFlags) {
	const allowed = new Set(['all', 'level']);
	if (flags.areItemsEnabled) {
		allowed.add('items');
	}
	if (flags.isMarketEnabled) {
		allowed.add('market');
	}
	if (flags.areMinigamesEnabled) {
		allowed.add('minigames');
	}
	const tabParam = String(category || 'all');
	return allowed.has(tabParam) ? tabParam : 'all';
}

async function historyEvents(memberId: number, tab: string, flags: HistoryFlags) {
	const itemEvents = (flags.areItemsEnabled ? await db.getMemberItemHistory(memberId, 0).catch(() => []) : []).map(itemEvent);
	const levelEvents = (await db.getMemberLevelHistory(memberId, 0).catch(() => [])).map(levelEvent);
	const assetEvents = (flags.isMarketEnabled ? await db.getMemberAssetHistory(memberId, 0).catch(() => []) : []).map(assetEvent);
	const minigameEvents = (flags.areMinigamesEnabled ? await db.getMemberMinigameHistory(memberId, 0).catch(() => []) : []).map(minigameEvent);
	const byTab: Record<string, HistoryEvent[]> = { items: itemEvents, level: levelEvents, market: assetEvents, minigames: minigameEvents };
	return byTab[tab] ?? [...itemEvents, ...levelEvents, ...assetEvents, ...minigameEvents].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { server, serverBasePath, itemsEnabled: areItemsEnabled, marketEnabled: isMarketEnabled, minigamesEnabled: areMinigamesEnabled } = await parent();

	const shared = await loadItemsShared(server, itemsCardTokenFromUrl(params.hash), null);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, apexHome());
	}
	if ('guest' in shared || !shared.member) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	const flags: HistoryFlags = { areItemsEnabled, isMarketEnabled, areMinigamesEnabled };
	const tab = historyTab(params.category, flags);
	const events = await historyEvents(shared.member.id, tab, flags);

	const totalPages = Math.max(1, Math.ceil(events.length / PER_PAGE));
	const reqPage = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
	const historyPage = Math.min(reqPage, totalPages);
	const pagedHistory = events.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE);

	return { ...shared, tab, historyTotal: events.length, historyPage, totalPages, pagedHistory };
};
