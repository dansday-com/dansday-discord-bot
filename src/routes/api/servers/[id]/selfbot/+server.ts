import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

function canManage(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_type === 'superadmin') return true;
	if (locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!canManage(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const selfbots = await db.getServerBots(serverId);
	return json({ success: true, selfbots });
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!canManage(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const { token } = body;
	if (!token) return json({ success: false, error: 'token required' }, { status: 400 });

	const server = await db.getServer(serverId);
	if (!server) return json({ success: false, error: 'Server not found' }, { status: 404 });

	const officialBot = await db.getBot(server.bot_id);
	if (!officialBot) return json({ success: false, error: 'Official bot not found' }, { status: 404 });

	const selfbot = await db.createBot({
		name: 'Selfbot',
		token,
		bot_type: 'selfbot',
		secret_key: officialBot.secret_key,
		is_testing: officialBot.is_testing
	});
	await db.addServerBot(serverId, selfbot.id);
	if (locals.user.authenticated) logger.log(`${locals.user.username} created selfbot (ID: ${selfbot.id}) for server ${serverId}`);

	return json({ success: true, selfbot });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!canManage(locals, serverId)) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	const selfbotId = Number(body.selfbot_id);
	if (!selfbotId) return json({ success: false, error: 'selfbot_id required' }, { status: 400 });

	const selfbot = await db.getBot(selfbotId);
	if (!selfbot || selfbot.bot_type !== 'selfbot') {
		return json({ success: false, error: 'Selfbot not found' }, { status: 404 });
	}

	await db.removeServerBot(serverId, selfbotId);
	await db.deleteBot(selfbotId);
	if (locals.user.authenticated) logger.log(`${locals.user.username} deleted selfbot "${selfbot.name}" (ID: ${selfbotId}) from server ${serverId}`);

	return json({ success: true });
};
