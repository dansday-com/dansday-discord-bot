import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken } from '$lib/frontend/public/shop/index.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const shopRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.shop).catch(() => null);
	if ((shopRow as any)?.settings?.enabled !== true) {
		return json({ success: false, error: 'Shop disabled' }, { status: 403 });
	}

	const token = String(url.searchParams.get('card') || '').trim();
	const member = await resolveMemberByCardToken(server.id, token);
	if (!member) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const rows = await db.getMemberInventory(member.id).catch(() => []);
	const items = (rows as any[]).map((r) => ({
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

	return json({ success: true, items, member: { name: member.server_display_name || member.display_name || member.username } });
};

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
