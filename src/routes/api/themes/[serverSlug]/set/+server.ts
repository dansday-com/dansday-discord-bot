import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { EFFECT_FAMILIES } from '$lib/effects.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { checkRateLimit, getClientIp } from '$lib/utils/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { MINUTE_MS } from '$lib/utils/time.js';

const RATE_WINDOW_MS = MINUTE_MS;
const MAX_SETS = 120;

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'theme_effect_set', { maxAttempts: MAX_SETS, windowMs: RATE_WINDOW_MS });
	if (!rate.allowed) {
		return json({ success: false, error: 'Slow down.' }, { status: HTTP.TOO_MANY_REQUESTS });
	}

	const resolved = await resolvePublicServerBySlug(String(params.serverSlug || '').trim());
	if (!resolved) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	const { server } = resolved;

	const { card, effect, seed } = await readJsonObject(request);
	if (typeof card !== 'string' || !card) {
		return json({ success: false, error: 'Missing card' }, { status: HTTP.BAD_REQUEST });
	}

	if (typeof effect !== 'string' || !(EFFECT_FAMILIES as readonly string[]).includes(effect)) {
		return json({ success: false, error: 'Unknown effect.' }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, card);
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
		type: 'theme_effect_set',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		effect,
		seed: typeof seed === 'number' && Number.isFinite(seed) ? seed : null
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			forbidden: 'Not allowed.',
			unknown_effect: 'Unknown effect.',
			member_not_found: 'Member not found.'
		};
		const err = friendly[code] || code || 'Could not set effect.';
		return json({ success: false, error: err }, { status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST });
	}

	return json({ success: true, result: webhookResult.body.result });
};
