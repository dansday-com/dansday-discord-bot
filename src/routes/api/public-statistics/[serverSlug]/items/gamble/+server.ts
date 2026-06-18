import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const itemsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.items).catch(() => null);
	const itemsSettings = (itemsRow as any)?.settings || {};
	if (itemsSettings.enabled !== true) {
		return json({ success: false, error: 'The items shop is disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });
	const { card, item_id, percent, amount } = body;
	if (!card || !item_id || (!percent && !amount)) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: 500 });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'gamble',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		item_id: Number(item_id),
		percent: Number(percent) || 0,
		amount: Number(amount) || 0
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const err = webhookResult.body?.error || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Gamble failed.');
		return json({ success: false, error: err, outcome: webhookResult.body?.outcome }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({ success: true, outcome: webhookResult.body.outcome, result: webhookResult.body.result });
};
