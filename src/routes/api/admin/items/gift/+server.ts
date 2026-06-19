import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_type === 'superadmin' && locals.user.account_source === 'accounts';
}

function resolvePanelId(locals: App.Locals): number | null {
	const panelId = (locals.user as any).panel_id;
	return panelId != null ? Number(panelId) : null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const panelId = resolvePanelId(locals);
	if (panelId == null) return json({ success: false, error: 'No panel available' }, { status: 404 });

	const q = url.searchParams.get('q') ?? '';
	const members = await db.searchPanelMembersForGift(panelId, q, 60);
	return json({ success: true, members });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	const panelId = resolvePanelId(locals);
	if (panelId == null) return json({ success: false, error: 'No panel available' }, { status: 404 });

	const body = await request.json().catch(() => null);
	if (!body?.item_id || !body?.member_id) return json({ success: false, error: 'item_id and member_id are required' }, { status: 400 });

	const quantity = Math.max(1, Math.min(99, Number(body.quantity) || 1));

	const item = await db.getItem(body.item_id);
	if (!item) return json({ success: false, error: 'Item not found' }, { status: 404 });
	if (Number((item as any).panel_id) !== panelId) return json({ success: false, error: 'Forbidden' }, { status: 403 });
	if ((item as any).effect_type === 'gamble') return json({ success: false, error: 'Gamble items cannot be gifted — they are played, not owned.' }, { status: 400 });

	const enabled = await db.memberServerHasItemsEnabled(body.member_id, panelId);
	if (!enabled) return json({ success: false, error: 'That member’s server does not have the items module enabled.' }, { status: 400 });

	const owned = await db.grantMemberItem(body.member_id, body.item_id, quantity);
	await logger.log(`${(locals.user as any).username} gifted ${quantity}× item ${body.item_id} to member ${body.member_id}`);
	return json({ success: true, quantity: owned?.quantity });
};
