import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { loadTasksShared } from '$lib/backend/public/tasks/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';

type CardBody = { card: string; tzOffsetMin: number };

function parseCardBody(body: Record<string, unknown>): CardBody | string {
	const { card, tz_offset } = body;
	if (!card) {
		return 'Missing fields';
	}
	if (typeof card !== 'string') {
		return 'Invalid card';
	}
	const tzOffsetMin = tz_offset == null ? 0 : typeof tz_offset === 'number' || typeof tz_offset === 'string' ? Number(tz_offset) || 0 : Number.NaN;
	if (!Number.isFinite(tzOffsetMin)) {
		return 'Invalid tz_offset';
	}
	return { card, tzOffsetMin };
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
	if (!publicSubfeatureEnabled(psSettings, 'tasks')) {
		return json({ success: false, error: 'Tasks are disabled for this server.' }, { status: HTTP.FORBIDDEN });
	}

	const parsed = parseCardBody(await readJsonObject(request));
	if (typeof parsed === 'string') {
		return json({ success: false, error: parsed }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, parsed.card);
	if (!actor) {
		return json({ success: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	const { tzOffsetMin } = parsed;

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'claim_login',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		tz_offset: tzOffsetMin
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			already_claimed: 'Already claimed. The next check-in unlocks 24 hours after your last one.',
			grant_failed: 'Could not deliver the reward. Try again.'
		};
		const err = friendly[code] || code || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Claim failed.');
		return json({ success: false, error: err }, { status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST });
	}

	const refreshed = await loadTasksShared({
		server,
		member: actor,
		itemsEnabled: publicSubfeatureEnabled(psSettings, 'items'),
		minigamesEnabled: publicSubfeatureEnabled(psSettings, 'minigames'),
		marketEnabled: publicSubfeatureEnabled(psSettings, 'market'),
		tzOffsetMin
	}).catch(() => null);

	return json({
		success: true,
		granted: webhookResult.body.granted,
		day: webhookResult.body.day,
		jackpot: webhookResult.body.jackpot,
		tasks: refreshed
	});
};
