import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveMemberByCardToken, resolveActiveBotForServer } from '$lib/backend/public/items/index.js';
import { postBotWebhook } from '$lib/botControl.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';
import { MINUTE_MS } from '$lib/utils/time.js';

const RATE_WINDOW_MS = MINUTE_MS;
const MAX_ACTIONS = 60;
const ACTIONS = ['start', 'guess', 'end'];

type ColorBody = { card: string; action: string; h: number | undefined; s: number | undefined; b: number | undefined };

function colorChannel(value: unknown): number | undefined | null {
	if (value == null) {
		return undefined;
	}
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseColorBody(body: Record<string, unknown>): ColorBody | string {
	if (Object.keys(body).length === 0) {
		return 'Invalid body';
	}
	const { card, action } = body;
	if (!card || typeof action !== 'string' || !ACTIONS.includes(action)) {
		return 'Missing fields';
	}
	if (typeof card !== 'string') {
		return 'Invalid card';
	}
	const [h, s, b] = [body.h, body.s, body.b].map(colorChannel);
	if (h === null || s === null || b === null) {
		return 'Invalid color';
	}
	return { card, action, h, s, b };
}

export const POST: RequestHandler = async ({ params, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'minigame_color', { maxAttempts: MAX_ACTIONS, windowMs: RATE_WINDOW_MS });
	if (!rate.allowed) {
		return json({ success: false, error: 'Too many plays. Please slow down.' }, { status: HTTP.TOO_MANY_REQUESTS });
	}

	const serverSlug = String(params.serverSlug || '').trim();
	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) {
		return json({ success: false, error: 'Not found' }, { status: HTTP.NOT_FOUND });
	}
	const { server } = resolved;

	const row = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const ps = row?.settings ?? {};
	if (!publicSubfeatureEnabled(ps, 'minigames')) {
		return json({ success: false, error: 'Minigames are disabled for this server.' }, { status: HTTP.FORBIDDEN });
	}

	const parsed = parseColorBody(await readJsonObject(request));
	if (typeof parsed === 'string') {
		return json({ success: false, error: parsed }, { status: HTTP.BAD_REQUEST });
	}

	const actor = await resolveMemberByCardToken(server.id, parsed.card);
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
		type: 'minigame_color',
		guild_id: fullServer.discord_server_id,
		actor_discord_id: actor.discord_member_id,
		action: parsed.action,
		h: parsed.h,
		s: parsed.s,
		b: parsed.b
	});

	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		const code = webhookResult.body?.error ?? '';
		const friendly: Record<string, string> = {
			no_active_run: 'That game is already over.',
			invalid_guess: 'That color did not go through.',
			minigames_disabled: 'Minigames are disabled for this server.'
		};
		const err = friendly[code] || code || (webhookResult.status === HTTP.BAD_GATEWAY ? 'Could not reach the bot.' : 'Play failed.');
		return json(
			{ success: false, error: err, state: webhookResult.body?.state },
			{ status: webhookResult.status === HTTP.BAD_GATEWAY ? HTTP.BAD_GATEWAY : HTTP.BAD_REQUEST }
		);
	}

	return json({
		success: true,
		state: webhookResult.body.state,
		step: webhookResult.body.step,
		target: webhookResult.body.target,
		ended: webhookResult.body.ended
	});
};
