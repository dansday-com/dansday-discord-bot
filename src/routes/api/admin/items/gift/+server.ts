import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { HTTP } from '$lib/http.js';

const GIFT_SEARCH_LIMIT = 50;
const MAX_GIFT_QUANTITY = 99;

function isSuperadmin(locals: App.Locals) {
	return locals.user.authenticated && locals.user.account_type === 'superadmin' && locals.user.account_source === 'accounts';
}

function resolvePanelId(locals: App.Locals): number | null {
	const panelId = (locals.user as Record<string, unknown>).panel_id;
	return panelId != null ? Number(panelId) : null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const panelId = resolvePanelId(locals);
	if (panelId == null) {
		return json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND });
	}

	const q = url.searchParams.get('q') ?? '';
	const members = await db.searchPanelMembersForGift(panelId, q, GIFT_SEARCH_LIMIT);
	const totals = await db.getMemberInventoryTotals(members.map((m) => m.id));

	return json({
		success: true,
		limit: GIFT_SEARCH_LIMIT,
		members: members.map((m) => ({ ...m, inventory_total: totals[Number(m.id)] ?? 0 }))
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!isSuperadmin(locals)) {
		return json({ success: false, error: 'Unauthorized' }, { status: HTTP.UNAUTHORIZED });
	}
	const panelId = resolvePanelId(locals);
	if (panelId == null) {
		return json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND });
	}

	const body = await request.json().catch(() => null);
	if (!body?.item_id || !body?.member_id) {
		return json({ success: false, error: 'item_id and member_id are required' }, { status: HTTP.BAD_REQUEST });
	}

	const quantity = Math.max(1, Math.min(MAX_GIFT_QUANTITY, Number(body.quantity) || 1));

	const item = await db.getItem(body.item_id);
	if (!item) {
		return json({ success: false, error: 'Item not found' }, { status: HTTP.NOT_FOUND });
	}
	if (Number(item.panel_id) !== panelId) {
		return json({ success: false, error: 'Forbidden' }, { status: HTTP.FORBIDDEN });
	}

	const isEnabled = await db.memberServerHasItemsEnabled(body.member_id, panelId);
	if (!isEnabled) {
		return json({ success: false, error: 'That member’s server does not have the items module enabled.' }, { status: HTTP.BAD_REQUEST });
	}

	const owned = await db.grantMemberItem(body.member_id, body.item_id, quantity);
	for (let i = 0; i < quantity; i++) {
		await db
			.logMemberItemAction(body.member_id, {
				item_id: body.item_id,
				action: 'gift',
				xp: 0,
				outcome: 'admin'
			})
			.catch(() => null);
	}
	await logger.log(`${(locals.user as Record<string, unknown>).username} gifted ${quantity}× item ${body.item_id} to member ${body.member_id}`);

	let wasAnnounced = false;
	try {
		const member = await db.getServerMemberById(body.member_id);
		if (member?.server_id && member?.discord_member_id) {
			const server = await db.getServer(member.server_id);
			if (server?.discord_server_id) {
				const bot = await resolveActiveBotForServer(server);
				if (bot?.port && bot.secret_key) {
					const result = await postBotWebhook(bot, {
						type: 'gift_item_announce',
						guild_id: server.discord_server_id,
						member_discord_id: member.discord_member_id,
						item_name: item.name,
						effect_type: item.effect_type,
						quantity
					});
					wasAnnounced = result.status === HTTP.OK && result.body?.announced === true;
				}
			}
		}
	} catch (err) {
		await logger.log(`⚠️ gift announce failed for member ${body.member_id}: ${(err as Error).message}`);
	}

	return json({ success: true, quantity: owned?.quantity, announced: wasAnnounced });
};
