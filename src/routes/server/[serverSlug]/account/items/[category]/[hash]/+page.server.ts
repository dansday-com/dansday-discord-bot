import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { publicServerPath } from '$lib/url.js';
import db from '$lib/database.js';
import { loadItemsShared, computeCardToken, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, 'items');
	if ('notFound' in shared) redirect(303, `${publicServerPath(server.slug)}/account/overview/${params.hash}`);
	if ('guest' in shared) redirect(303, publicServerPath(server.slug));

	const category = String(params.category || 'all');
	const visibleItems = category === 'all' ? shared.items : shared.items.filter((i: any) => i.effect_type === category);

	let ownedByItemId: Record<number, { member_item_id: number; quantity: number; usable: boolean }> = {};
	let targets: any[] = [];

	if (shared.member) {
		const rows = await db.getMemberInventory(shared.member.id).catch(() => []);
		for (const r of rows as any[]) {
			ownedByItemId[Number(r.item_id)] = {
				member_item_id: r.id,
				quantity: Number(r.quantity) || 0,
				usable: r.usable !== false && r.usable !== 0
			};
		}

		const permissionsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.permissions).catch(() => null);
		const memberRoleIds: string[] = (permissionsRow as any)?.settings?.member_roles ?? [];
		const list = await db.getServerMembersList(server.id).catch(() => []);
		targets = (list as any[])
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
	}

	const items = (visibleItems as any[]).map((it) => {
		const owned = ownedByItemId[Number(it.id)];
		return {
			...it,
			member_item_id: owned?.member_item_id ?? null,
			owned_quantity: owned?.quantity ?? 0,
			owned_usable: owned ? owned.usable : true
		};
	});

	return { ...shared, category, visibleItems: items, targets };
};
