import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

const PER_PAGE = 12;

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { server, publicStatsEnabled } = await parent();
	const hash = String(params.hash || '').trim();

	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');
	if ('invalid' in shared) redirect(303, publicStatsEnabled ? publicServerPath(server.slug) : '/');

	const rows = await db.getMemberItemHistory(shared.member.id, 600).catch(() => []);
	const history = (rows as any[]).map((h) => ({
		id: String(h.id),
		action: h.action,
		effect_type: h.effect_type ?? null,
		itemName: h.item_name ?? null,
		outcome: h.outcome,
		xpAmount: Number(h.xp_amount) || 0,
		targetName: h.target_server_display_name || h.target_display_name || h.target_username || null,
		at: h.created_at ? new Date(h.created_at).getTime() : null
	}));

	const totalPages = Math.max(1, Math.ceil(history.length / PER_PAGE));
	const reqPage = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
	const historyPage = Math.min(reqPage, totalPages);
	const pagedHistory = history.slice((historyPage - 1) * PER_PAGE, historyPage * PER_PAGE);

	return { ...shared, historyTotal: history.length, historyPage, totalPages, pagedHistory };
};
