import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';
import { checkRateLimit, getClientIp } from '$lib/utils/index.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_SPINS = 20;

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'theme_effect_spin', MAX_SPINS, RATE_WINDOW_MS);
	if (!rate.allowed) return json({ success: false, error: 'Too many spins. Please slow down.' }, { status: 429 });

	const resolved = await resolvePublicServerBySlug(String(params.serverSlug || '').trim());
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const body = await request.json().catch(() => null);
	if (!body?.card) return json({ success: false, error: 'Missing card' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(body.card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, {
		type: 'theme_effect_spin',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			insufficient_xp: 'Not enough XP.',
			member_not_found: 'Member not found.'
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Spin failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({ success: true, result: webhookResult.body.result });
};
