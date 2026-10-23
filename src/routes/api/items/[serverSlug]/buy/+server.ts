import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { BAG_CAPACITY } from '$lib/items.js';

type BuyBody = { card: string; itemId: number; quantity: number; tzOffset: number };

function parseBuyBody(body: Record<string, unknown>): BuyBody | string {
	if (Object.keys(body).length === 0) {
		return 'Invalid body';
	}
	const { card, item_id, quantity, tz_offset } = body;
	if (!card || !item_id) {
		return 'Missing fields';
	}
	if (typeof card !== 'string') {
		return 'Invalid card';
	}
	const itemId = typeof item_id === 'number' || typeof item_id === 'string' ? Number(item_id) : Number.NaN;
	if (!Number.isInteger(itemId) || itemId <= 0) {
		return 'Invalid item_id';
	}
	const quantityCount = quantity == null ? 1 : typeof quantity === 'number' || typeof quantity === 'string' ? Number(quantity) || 1 : Number.NaN;
	if (!Number.isInteger(quantityCount) || quantityCount <= 0) {
		return 'Invalid quantity';
	}
	const tzOffset = tz_offset == null ? 0 : typeof tz_offset === 'number' || typeof tz_offset === 'string' ? Number(tz_offset) || 0 : Number.NaN;
	if (!Number.isFinite(tzOffset)) {
		return 'Invalid tz_offset';
	}
	return { card, itemId, quantity: quantityCount, tzOffset };
}

export const POST: RequestHandler = async ({ params, request }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	const { server } = resolved;

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const psSettings = psRow?.settings || {};
	if (!publicSubfeatureEnabled(psSettings, 'items')) {
		return json({ success: false, error: 'The items shop is disabled for this server.' }, { status: HTTP.FORBIDDEN });
	}

	const parsed = parseBuyBody(await readJsonObject(request));
	if (typeof parsed === 'string') {
		return json({ success: false, error: parsed }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, parsed.card);
	if (!actor) {
		return json({ success: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'buy_item',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		item_id: parsed.itemId,
		quantity: parsed.quantity,
		tz_offset: parsed.tzOffset
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			bag_full: `Your bag is full (max ${webhookResult.body?.capacity ?? BAG_CAPACITY} items).`,
			insufficient_xp: 'Not enough XP.'
		};
		const err = friendly[code] || code || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Purchase failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST });
	}

	return json({ success: true, member_item_id: webhookResult.body.member_item_id, quantity: webhookResult.body.quantity, cost: webhookResult.body.cost });
};
