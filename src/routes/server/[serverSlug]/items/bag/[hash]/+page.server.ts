import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, publicStatsEnabled } = await parent();
	const hash = String(params.hash || '').trim();

	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');
	if ('invalid' in shared) redirect(303, publicStatsEnabled ? publicServerPath(server.slug) : '/');

	const rows = await db.getMemberInventory(shared.member.id).catch(() => []);
	const inventory = (rows as any[]).map((r) => ({
		member_item_id: r.id,
		item_id: r.item_id,
		name: r.name,
		effect_type: r.effect_type,
		description: r.description,
		quantity: r.quantity,
		config: typeof r.config === 'string' ? safeParse(r.config) : r.config
	}));

	return { ...shared, inventory };
};
