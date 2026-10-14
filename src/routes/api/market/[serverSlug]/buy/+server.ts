import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { MIN_BUY_XP } from '$lib/backend/public/market/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { MINUTE_MS } from '$lib/utils/time.js';

const RATE_WINDOW_MS = MINUTE_MS;
const MAX_TRADES = 20;

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'asset_buy', { maxAttempts: MAX_TRADES, windowMs: RATE_WINDOW_MS });
	if (!rate.allowed) {
		return json({ success: false, error: 'Too many trades. Please slow down.' }, { status: HTTP.TOO_MANY_REQUESTS });
	}

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	const { server } = resolved;

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const psSettings = psRow?.settings || {};
	if (!publicSubfeatureEnabled(psSettings, 'market')) {
		return json({ success: false, error: 'Market is disabled for this server.' }, { status: HTTP.FORBIDDEN });
	}

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid body' }, { status: HTTP.BAD_REQUEST });
	}
	const { card, asset_type, asset_id, xp } = body;
	if (!card || !asset_id || !xp) {
		return json({ success: false, error: 'Missing fields' }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, String(card));
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
		type: 'asset_buy',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		asset_type: String(asset_type || 'crypto'),
		asset_id: String(asset_id),
		xp: Number(xp) || 0
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			insufficient_xp: 'Not enough XP.',
			price_unavailable: 'Price unavailable right now, try again shortly.',
			invalid_amount: 'Enter a valid XP amount.',
			below_minimum: `Minimum investment is ${webhookResult.body?.min ?? MIN_BUY_XP} XP.`
		};
		const err = friendly[code] || code || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Buy failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST });
	}

	return json({ success: true, position: webhookResult.body.position, price: webhookResult.body.price });
};
