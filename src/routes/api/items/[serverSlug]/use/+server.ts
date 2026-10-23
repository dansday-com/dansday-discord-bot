import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { HTTP, numberField, readJsonObject } from '$lib/http.js';

type UseBody = { card: string; memberItemId: number; targetDiscordId: string | null };

function parseUseBody(body: Record<string, unknown>): UseBody | string {
	if (Object.keys(body).length === 0) {
		return 'Invalid body';
	}
	const { card, target_discord_id, member_item_id } = body;
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
	if (target_discord_id != null && typeof target_discord_id !== 'string') {
		return 'Invalid target_discord_id';
	}
	return { card, memberItemId, targetDiscordId: target_discord_id || null };
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

	const parsed = parseUseBody(await readJsonObject(request));
	if (typeof parsed === 'string') {
		return json({ success: false, error: parsed }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, parsed.card);
	if (!actor) {
		return json({ success: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	const target = parsed.targetDiscordId ? await db.getMemberByDiscordId(server.id, parsed.targetDiscordId).catch(() => null) : null;
	if (parsed.targetDiscordId && (!target || target.is_bot)) {
		return json({ success: false, error: 'Target not found' }, { status: HTTP.NOT_FOUND });
	}
	const targetDiscordId = target?.discord_member_id;

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'use_item',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		target_discord_id: targetDiscordId,
		member_item_id: parsed.memberItemId
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const err = webhookResult.body?.error || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Item use failed.');
		return json(
			{ success: false, error: err, outcome: webhookResult.body?.outcome },
			{ status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST }
		);
	}

	return json({ success: true, outcome: webhookResult.body.outcome, result: webhookResult.body.result });
};
