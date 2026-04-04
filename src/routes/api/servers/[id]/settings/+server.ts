import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const component = url.searchParams.get('component');
		let serverId = params.id;

		if (component === SERVER_SETTINGS.component.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) serverId = officialServerId;
		}

		const settings = await db.getServerSettings(serverId, component);
		return json(settings);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

function canEditServer(locals: App.Locals, serverId: string): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	return locals.user.server_id === Number(serverId);
}

async function postOfficialBotWebhook(bot: { port: number | null; secret_key: string | null } | null | undefined, payload: Record<string, unknown>): Promise<void> {
	if (!bot?.port || !bot.secret_key) return;
	const { request } = await import('http');
	const body = JSON.stringify(payload);
	const options = {
		hostname: 'localhost',
		port: bot.port,
		path: '/',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(body),
			'X-Secret-Key': bot.secret_key
		}
	};
	await new Promise<void>((resolve) => {
		const req = request(options, () => resolve());
		req.on('error', () => resolve());
		req.write(body);
		req.end();
	});
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const panelServerId = params.id;
	if (!panelServerId) {
		return json({ error: 'Server id required' }, { status: 400 });
	}
	if (!canEditServer(locals, panelServerId)) {
		return json({ error: 'Access denied' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { component, ...settings } = body;
		if (!component) {
			return json({ error: 'component is required' }, { status: 400 });
		}

		let targetServerId = panelServerId;
		if (component === SERVER_SETTINGS.component.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(panelServerId);
			if (officialServerId) targetServerId = officialServerId;
		}

		const result = await db.upsertServerSettings(targetServerId, component, settings);

		const panelServer = await db.getServer(panelServerId);
		const officialBotId = panelServer ? await db.resolveOfficialBotIdForServer(panelServer) : null;
		const bot = officialBotId ? await db.getBot(officialBotId) : null;

		if (component === SERVER_SETTINGS.component.notifications) {
			try {
				const notifServer = await db.getServer(targetServerId);
				if (notifServer?.discord_server_id && bot) {
					await postOfficialBotWebhook(bot, { type: 'sync_notification_roles', guild_id: notifServer.discord_server_id });
				}
			} catch (_) {}
		}

		const featureSwitchIds = SERVER_SETTINGS.withFeatureSwitch as readonly string[];
		if (panelServer?.discord_server_id && bot && featureSwitchIds.includes(component) && component !== SERVER_SETTINGS.component.notifications) {
			const enabled = (settings as { enabled?: boolean }).enabled !== false;
			try {
				await postOfficialBotWebhook(bot, {
					type: 'sync_component_runtime',
					guild_id: panelServer.discord_server_id,
					component,
					enabled
				});
			} catch (_) {}
		}

		const serverName = panelServer ? panelServer.name : `Server ID: ${panelServerId}`;
		const actor = locals.user.authenticated && 'username' in locals.user ? locals.user.username : 'unknown';
		logger.log(`${actor} changed ${component} configuration on server "${serverName}"`);

		return json({ success: true, data: result });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
