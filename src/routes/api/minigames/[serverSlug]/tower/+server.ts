import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { publicSubfeatureEnabled } from '$lib/frontend/panelServer.js';
import { TOWER_COOLDOWN_HOURS } from '$lib/tower.js';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_ACTIONS = 60;
const ACTIONS = ['state', 'start', 'pick', 'cashout'];

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'minigame_tower', MAX_ACTIONS, RATE_WINDOW_MS);
	if (!rate.allowed) return json({ success: false, error: 'Too many plays. Please slow down.' }, { status: 429 });

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const row = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const ps = (row as any)?.settings ?? {};
	if (!publicSubfeatureEnabled(ps, 'minigames')) {
		return json({ success: false, error: 'Minigames are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });
	const { card, action, door } = body;
	if (!card || !ACTIONS.includes(action)) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, {
		type: 'minigame_tower',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		action,
		door: Number(door) || 0
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			no_runs_left: `No climbs left. They come back ${TOWER_COOLDOWN_HOURS} hours after your last climb.`,
			no_active_run: 'That climb is already over.',
			run_changed: 'That climb already moved on.',
			nothing_to_cash: 'Clear a floor before cashing out.',
			minigames_disabled: 'Minigames are disabled for this server.'
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Play failed.');
		return json({ success: false, error: err, state: webhookResult.body?.state }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	return json({ success: true, state: webhookResult.body.state, step: webhookResult.body.step });
};
