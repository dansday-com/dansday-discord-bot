import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { HTTP, numberField, readJsonObject } from '$lib/http.js';

type DiscardBody = { card: string; memberItemId: number; quantity: number | undefined };

function parseDiscardBody(body: Record<string, unknown>): DiscardBody | string {
	if (Object.keys(body).length === 0) {
		return 'Invalid body';
	}
	const { card, member_item_id, quantity } = body;
	if (!card || !member_item_id) {
		return 'Missing fields';
	}
	if (typeof card !== 'string') {
		return 'Invalid card';
	}
	const memberItemId = numberField(member_item_id);
	if (!Number.isInteger(memberItemId) || memberItemId <= 0) {
		return 'Invalid member_item_id';
	}
	if (quantity == null) {
		return { card, memberItemId, quantity: undefined };
	}
	const quantityCount = numberField(quantity);
	if (!Number.isInteger(quantityCount) || quantityCount <= 0) {
		return 'Invalid quantity';
	}
	return { card, memberItemId, quantity: quantityCount };
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

	const parsed = parseDiscardBody(await readJsonObject(request));
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
		type: 'discard_item',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		member_item_id: parsed.memberItemId,
		quantity: parsed.quantity
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const err = webhookResult.body?.error || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Failed to remove item.');
		return json({ success: false, error: err }, { status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST });
	}

	return json({ success: true, removed: webhookResult.body.removed });
};
