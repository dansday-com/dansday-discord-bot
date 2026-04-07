import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { canManageSelfbots, canViewSelfbots } from '$lib/serverPanelAccess.js';
import { logger } from '$lib/utils/index.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!canViewSelfbots(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const selfbots = await db.getServerBots(serverId);
	return json({ success: true, selfbots });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!canManageSelfbots(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const { token } = body;
	if (!token) return json({ success: false, error: 'token required' }, { status: 400 });

	const server = await db.getServer(serverId);
	if (!server) return json({ success: false, error: 'Server not found' }, { status: 404 });

	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	const officialBot = officialBotId ? await db.getBot(officialBotId) : null;
	if (!officialBot) return json({ success: false, error: 'Official bot not found' }, { status: 404 });

	let id: number;
	try {
		id = await db.addServerBot({
			server_id: serverId,
			name: 'Selfbot',
			token
		});
	} catch (err: any) {
		logger.error(`Failed to add selfbot for server ${serverId}: ${err?.message ?? err}`);
		return json({ success: false, error: 'Failed to add selfbot' }, { status: 500 });
	}

	if (locals.user.authenticated) logger.log(`${locals.user.username} created selfbot (ID: ${id}) for server ${serverId}`);

	return json({ success: true, id });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!canManageSelfbots(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const selfbotId = Number(body.selfbot_id);
	if (!selfbotId) return json({ success: false, error: 'selfbot_id required' }, { status: 400 });

	const selfbot = await db.getServerBotById(selfbotId);
	if (!selfbot || selfbot.server_id !== serverId) {
		return json({ success: false, error: 'Selfbot not found' }, { status: 404 });
	}

	await db.removeServerBot(selfbotId);
	if (locals.user.authenticated) logger.log(`${locals.user.username} deleted selfbot "${selfbot.name}" (ID: ${selfbotId}) from server ${serverId}`);

	return json({ success: true });
};
