import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_PLAYS = 30;

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'minigame_play', MAX_PLAYS, RATE_WINDOW_MS);
	if (!rate.allowed) return json({ success: false, error: 'Too many plays. Please slow down.' }, { status: 429 });

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const row = await db.getServerSettings(server.id, SERVER_SETTINGS.component.minigames).catch(() => null);
	if ((row as any)?.settings?.enabled !== true) {
		return json({ success: false, error: 'Minigames are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });
	const { card, multiplier, amount } = body;
	if (!card || !multiplier || !amount) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, {
		type: 'minigame_play',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		multiplier: Number(multiplier) || 0,
		amount: Number(amount) || 0
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			insufficient_xp: 'Not enough XP.',
			below_minimum: `Minimum wager is ${webhookResult.body?.min ?? 1} XP.`,
			minigames_disabled: 'Minigames are disabled for this server.'
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Play failed.');
		return json({ success: false, error: err, outcome: webhookResult.body?.outcome }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({ success: true, outcome: webhookResult.body.outcome, result: webhookResult.body.result });
};
