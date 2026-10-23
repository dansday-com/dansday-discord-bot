import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { loadTasksShared } from '$lib/backend/public/tasks/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';

type ClaimBody = { card: string; slot: number; period: 'daily' | 'weekly'; tzOffsetMin: number };

function parseClaimBody(body: Record<string, unknown>): ClaimBody | string {
	if (Object.keys(body).length === 0) {
		return 'Invalid body';
	}
	const { card, slot, tz_offset } = body;
	if (!card || slot == null) {
		return 'Missing fields';
	}
	if (typeof card !== 'string') {
		return 'Invalid card';
	}
	const slotIndex = typeof slot === 'number' || typeof slot === 'string' ? Number(slot) : Number.NaN;
	if (!Number.isInteger(slotIndex) || slotIndex < 0) {
		return 'Invalid slot';
	}
	const tzOffsetMin = tz_offset == null ? 0 : typeof tz_offset === 'number' || typeof tz_offset === 'string' ? Number(tz_offset) || 0 : Number.NaN;
	if (!Number.isFinite(tzOffsetMin)) {
		return 'Invalid tz_offset';
	}
	return { card, slot: slotIndex, period: body.period === 'weekly' ? 'weekly' : 'daily', tzOffsetMin };
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

	const parsed = parseClaimBody(await readJsonObject(request));
	if (typeof parsed === 'string') {
		return json({ success: false, error: parsed }, { status: HTTP.BAD_REQUEST });
	}
	const { tzOffsetMin } = parsed;

	const actor = await resolveMemberByCardToken(server.id, parsed.card);
	if (!actor) {
		return json({ success: false, error: 'Member not found' }, { status: HTTP.NOT_FOUND });
	}

	await loadTasksShared({
		server,
		member: actor,
		itemsEnabled: publicSubfeatureEnabled(psSettings, 'items'),
		minigamesEnabled: publicSubfeatureEnabled(psSettings, 'minigames'),
		marketEnabled: publicSubfeatureEnabled(psSettings, 'market'),
		tzOffsetMin
	}).catch(() => null);

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'claim_task',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		slot: parsed.slot,
		period: parsed.period,
		tz_offset: tzOffsetMin
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			already_claimed: 'You already claimed this task.',
			task_incomplete: 'This task is not finished yet.',
			task_not_found: 'That task is no longer available.',
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
		allClaimed: webhookResult.body.allClaimed,
		streak: webhookResult.body.streak,
		milestone: webhookResult.body.milestone,
		tasks: refreshed
	});
};
