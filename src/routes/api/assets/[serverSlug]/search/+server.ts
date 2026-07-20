import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveActiveBotForServer, postBotWebhook } from '$lib/frontend/public/items/index.js';

export const GET: RequestHandler = async ({ params, url }) => {
	const serverSlug = String(params.serverSlug || '').trim();
	const query = String(url.searchParams.get('q') || '').trim();
	if (!query) return json({ success: true, results: [] });

	const resolved = await resolvePublicServerBySlug(serverSlug);
	if (!resolved) return json({ success: false, error: 'Not found' }, { status: 404 });
	const server = resolved.server;

	const itemsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.items).catch(() => null);
	if ((itemsRow as any)?.settings?.enabled !== true) {
		return json({ success: false, error: 'Assets are disabled for this server.' }, { status: 403 });
	}

	const fullServer = await db.getServer(server.id);
	if (!fullServer?.discord_server_id) return json({ success: false, error: 'Server unavailable.' }, { status: 500 });
	const bot = await resolveActiveBotForServer(fullServer);
	if (!bot?.port || !bot.secret_key) return json({ success: false, error: 'Bot not available.' }, { status: 500 });

	const webhookResult = await postBotWebhook(bot, { type: 'asset_search', query });
	if (webhookResult.status !== 200 || !webhookResult.body?.ok) {
		return json({ success: false, error: 'Search failed.' }, { status: 502 });
	}
	return json({ success: true, results: webhookResult.body.results ?? [] });
};
