import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';
import { loadTasksShared } from '$lib/frontend/public/tasks/index.js';

export const POST: RequestHandler = async ({ params, request }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics).catch(() => null);
	const psSettings = (psRow as any)?.settings || {};
	if (psSettings.enabled === false || psSettings.tasks_enabled !== true) {
		return json({ success: false, error: 'Tasks are disabled for this server.' }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body?.card) return json({ success: false, error: 'Missing fields' }, { status: 400 });

	const actor = await resolveMemberByCardToken(server.id, String(body.card));
	if (!actor) return json({ success: false, error: 'Member not found' }, { status: 404 });

	const tzOffsetMin = Number(body.tz_offset) || 0;

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: 500 });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'claim_login',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		tz_offset: tzOffsetMin
	});

	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error;
		const friendly: Record<string, string> = {
			already_claimed: 'You already claimed your reward today.',
			grant_failed: 'Could not deliver the reward. Try again.'
		};
		const err = friendly[code] || code || (webhookResult.status === 502 ? 'Could not reach the bot.' : 'Claim failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === 502 ? 502 : 400 });
	}

	const refreshed = await loadTasksShared({
		server,
		member: actor,
		itemsEnabled: psSettings.items_enabled === true,
		minigamesEnabled: psSettings.minigames_enabled === true,
		assetsEnabled: psSettings.assets_enabled === true,
		tzOffsetMin
	}).catch(() => null);

	return json({
		success: true,
		granted: webhookResult.body.granted,
		day: webhookResult.body.day,
		jackpot: webhookResult.body.jackpot,
		bagWasFull: webhookResult.body.bagWasFull === true,
		tasks: refreshed
	});
};
