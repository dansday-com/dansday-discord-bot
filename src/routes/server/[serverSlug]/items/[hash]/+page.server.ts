import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { loadItemsCatalog, resolveMemberByCardToken, computeCardToken } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const itemsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.items).catch(() => null);
	if ((itemsRow as any)?.settings?.enabled !== true) error(404, 'Items not available');

	const items = await loadItemsCatalog(server.id);

	const hash = String(params.hash || '').trim();
	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;
	const valid = !!member;

	let inventory: any[] = [];
	let targets: any[] = [];
	if (member) {
		const list = await db.getServerMembersList(server.id).catch(() => []);
		targets = (list as any[])
			.filter((m) => m.discord_member_id && Number(m.id) !== Number(member.id))
			.map((m) => ({
				hash: computeCardToken(m.discord_member_id, m.member_since),
				name: m.server_display_name || m.display_name || m.username
			}));

		const rows = await db.getMemberInventory(member.id).catch(() => []);
		inventory = (rows as any[]).map((r) => ({
			member_item_id: r.id,
			item_id: r.item_id,
			name: r.name,
			effect_type: r.effect_type,
			category: r.category,
			description: r.description,
			icon: r.icon,
			quantity: r.quantity,
			config: typeof r.config === 'string' ? safeParse(r.config) : r.config
		}));
	}

	return {
		items,
		inventory,
		targets,
		hash,
		valid,
		memberName: member ? member.server_display_name || member.display_name || member.username : null
	};
};
