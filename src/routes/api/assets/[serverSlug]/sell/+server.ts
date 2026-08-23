import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { publicSubfeatureEnabled } from '$lib/frontend/panelServer.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_TRADES = 20;

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'asset_sell', MAX_TRADES, RATE_WINDOW_MS);
	if (!rate.allowed) return json({ success: false, error: 'Too many trades. Please slow down.' }, { status: 429 });

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics).catch(() => null);
	const psSettings = (psRow as any)?.settings || {};
	if (psSettings.enabled === false || !publicSubfeatureEnabled(psSettings, 'assets')) {
		return json({ success: false, error: 'Assets are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });
	const { card, position_id, amount } = body;
	if (!card || !position_id) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, {
		type: 'asset_sell',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		position_id: Number(position_id),
		xp: Number(amount) || 0
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			not_owner: 'That asset is not yours.',
			already_closed: 'This asset was already sold.',
			invalid_amount: 'Enter a valid XP amount.',
			price_unavailable: 'Price unavailable right now, try again shortly.'
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Sell failed.');
		console.error('[asset_sell] failed', { status: webhookResult.status, code, details: webhookResult.body?.details });
		return json({ success: false, error: err, code: code ?? null }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({
		success: true,
		payout: webhookResult.body.payout,
		invested: webhookResult.body.invested,
		net: webhookResult.body.net,
		sell_price: webhookResult.body.sell_price
	});
};
