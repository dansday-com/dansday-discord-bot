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
	if ((itemsRow as any)?.settings?.enabled !== true) {
		return json({ success: false, error: 'Assets are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });
	const { card, asset_type, asset_id, xp_amount } = body;
	if (!card || !asset_id || !xp_amount) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, {
		type: 'asset_buy',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		asset_type: String(asset_type || 'crypto'),
		asset_id: String(asset_id),
		xp_amount: Number(xp_amount) || 0
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			insufficient_xp: 'Not enough XP.',
			price_unavailable: 'Price unavailable right now, try again shortly.',
			invalid_amount: 'Enter a valid XP amount.',
			below_minimum: `Minimum investment is ${webhookResult.body?.min ?? 1000} XP.`
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Buy failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({ success: true, position: webhookResult.body.position, price: webhookResult.body.price });
};
