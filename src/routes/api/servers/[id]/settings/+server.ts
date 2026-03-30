import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	try {
		const component = url.searchParams.get('component');
		let serverId = params.id;

		if (component === 'notifications') {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) serverId = officialServerId;
		}

		const settings = await db.getServerSettings(serverId, component);
		return json(settings);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const { component_name, settings } = await request.json();
		if (!component_name) {
			return json({ error: 'component_name is required' }, { status: 400 });
		}

		let targetServerId = params.id;
		if (component_name === 'notifications') {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) targetServerId = officialServerId;
		}

		const result = await db.upsertServerSettings(targetServerId, component_name, settings);

		// Trigger notification sync webhook for notification changes
		if (component_name === 'notifications') {
			try {
				const server = await db.getServer(targetServerId);
				const bot = server ? await db.getBot(server.bot_id) : null;
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
			} catch {}
		}

		const server = await db.getServer(params.id);
		const serverName = server ? server.name : `Server ID: ${params.id}`;
		logger.log(`${locals.user.username} changed ${component_name} configuration on server "${serverName}"`);

		return json({ success: true, data: result });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
