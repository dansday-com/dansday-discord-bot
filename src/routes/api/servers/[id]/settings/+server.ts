import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const component = url.searchParams.get('component');
		let serverId = params.id;

		if (component === serverSettingsComponent.notifications) {
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

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!canEditServer(locals, params.id)) {
		return json({ error: 'Access denied' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { component, ...settings } = body;
		if (!component) {
			return json({ error: 'component is required' }, { status: 400 });
		}

		let targetServerId = params.id;
		if (component === serverSettingsComponent.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) targetServerId = officialServerId;
		}

		const result = await db.upsertServerSettings(targetServerId, component, settings);

		if (component === serverSettingsComponent.notifications) {
			try {
				const server = await db.getServer(targetServerId);
				const officialBotId = server ? await db.resolveOfficialBotIdForServer(server) : null;
				const bot = officialBotId ? await db.getBot(officialBotId) : null;
				if (server && bot && server.discord_server_id) {
					const { request: httpRequest } = await import('http');
					const payload = JSON.stringify({ type: 'sync_notification_roles', guild_id: server.discord_server_id });
					const options = {
						hostname: 'localhost',
						port: bot.port,
						path: '/',
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Content-Length': Buffer.byteLength(payload),
							'X-Secret-Key': bot.secret_key
						}
					};
					await new Promise<void>((resolve) => {
						const req = httpRequest(options, () => resolve());
						req.on('error', () => resolve());
						req.write(payload);
						req.end();
					});
				}
			} catch (_) {}
		}

		const server = await db.getServer(params.id);
		const serverName = server ? server.name : `Server ID: ${params.id}`;
		logger.log(`${locals.user.username} changed ${component} configuration on server "${serverName}"`);

		return json({ success: true, data: result });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
