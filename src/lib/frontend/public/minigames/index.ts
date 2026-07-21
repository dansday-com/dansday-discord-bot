import db from '$lib/database.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

export const MINIGAME_CATEGORIES = ['all', 'gamble'];

export async function loadMinigamesShared(server: any, hash: string) {
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');
	const shared = await loadItemsShared(server, hash, SERVER_SETTINGS.component.minigames);
	if ('notFound' in shared) return shared;

	let history: any[] = [];
	if (!shared.readOnly && shared.member) {
		const rows = await db.getMemberMinigameHistory(shared.member.id, 200).catch(() => []);
		history = (rows as any[]).map((h) => ({
			id: Number(h.id),
			multiplier: Number(h.multiplier) || 0,
			wager: Number(h.wager) || 0,
			payout: Number(h.payout) || 0,
			net: Number(h.xp_amount) || 0,
			outcome: h.outcome,
			created_at: h.created_at ? new Date(h.created_at).toISOString() : null
		}));
	}

	return { ...shared, history };
}
