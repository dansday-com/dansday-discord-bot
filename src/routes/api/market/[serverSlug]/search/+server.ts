import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { resolveActiveBotForServer, postBotWebhook } from '$lib/backend/public/items/index.js';
import { getClientIp, checkRateLimit } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';
import { MINUTE_MS } from '$lib/utils/time.js';

const RATE_WINDOW_MS = MINUTE_MS;
const MAX_SEARCHES = 30;

export const GET: RequestHandler = async ({ params, url, request }) => {
	const ip = getClientIp(request);
	const rate = await checkRateLimit(ip, 'asset_search', { maxAttempts: MAX_SEARCHES, windowMs: RATE_WINDOW_MS });
	if (!rate.allowed) {
		return json({ success: false, error: 'Too many searches. Please slow down.' }, { status: HTTP.TOO_MANY_REQUESTS });
	}

	const serverSlug = String(params.serverSlug || '').trim();
	const query = String(url.searchParams.get('q') || '').trim();
	if (!query) {
		return json({ success: true, results: [] });
	}

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

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) {
		return json({ success: false, error: 'Server unavailable.' }, { status: HTTP.INTERNAL_ERROR });
	}
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Bot not available.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, { type: 'asset_search', query });
	if (webhookResult.status !== HTTP.OK || !webhookResult.body?.ok) {
		return json({ success: false, error: 'Search failed.' }, { status: HTTP.BAD_GATEWAY });
	}
	return json({ success: true, results: webhookResult.body.results ?? [] });
};
