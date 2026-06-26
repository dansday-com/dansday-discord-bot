import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, computeCardToken, resolveItemsCardToken, writeItemsSession } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const { server } = await parent();

	const { hash, persist } = resolveItemsCardToken(cookies, server.slug, params.hash);
	if (persist) writeItemsSession(cookies, server.slug, hash);

	const shared = await loadItemsShared(server, hash);
	if ('notFound' in shared) error(404, 'Items not available');
	// Bag is personal — read-only guests can't view it. Send them to the shop they can browse.
	if (shared.readOnly || !shared.member) redirect(303, `${publicServerPath(server.slug)}/items/shop/all/guest`);

	const rows = await db.getMemberInventory(shared.member.id).catch(() => []);
	const allInventory = (rows as any[]).map((r) => ({
		member_item_id: r.id,
		item_id: r.item_id,
		name: r.name,
		effect_type: r.effect_type,
		description: r.description,
		quantity: r.quantity,
		usable: r.usable !== false && r.usable !== 0,
		config: typeof r.config === 'string' ? safeParse(r.config) : r.config
	}));

	const bagCategories = [...new Set(allInventory.map((i) => i.effect_type))];
	const category = String(params.category || 'all');
	const inventory = category === 'all' ? allInventory : allInventory.filter((i) => i.effect_type === category);

	const permissionsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.permissions).catch(() => null);
	const memberRoleIds: string[] = (permissionsRow as any)?.settings?.member_roles ?? [];
	const list = await db.getServerMembersList(server.id).catch(() => []);
	const targets = (list as any[])
		.filter((m) => m.discord_member_id && Number(m.id) !== Number(shared.member.id))
		.filter((m) => (m.roles ?? []).some((r: any) => memberRoleIds.includes(r.id)))
		.map((m) => ({
			hash: computeCardToken(m.discord_member_id, m.member_since),
			name: m.server_display_name || m.display_name || m.username,
			avatar: m.avatar ?? null,
			discord_member_id: String(m.discord_member_id),
			level: Number(m.level ?? 0) || 0,
			experience: Number(m.experience ?? 0) || 0,
			rank: m.rank != null ? Number(m.rank) : null,
			roles: (m.roles ?? []).map((r: any) => ({ name: r.name, color: r.color }))
		}));

	return { ...shared, inventory, targets, bagCategories, bagCategory: category };
};
