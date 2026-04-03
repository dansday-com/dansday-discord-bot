import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';

function canManage(locals: App.Locals, serverId: number): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	if (locals.user.account_source === 'server_accounts' && locals.user.account_type === 'owner') return locals.user.server_id === serverId;
	return false;
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	const selfbotId = Number(params.selfbotId);
	if (!canManage(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	try {
		const selfbot = await db.getServerBotById(selfbotId);
		if (!selfbot || selfbot.server_id !== serverId) {
			return json({ success: false, error: 'Selfbot not found' }, { status: 404 });
		}

		const { is_testing } = await request.json();
		if (typeof is_testing !== 'boolean') {
			return json({ success: false, error: 'is_testing must be a boolean value' }, { status: 400 });
		}

		await db.updateServerBot(selfbotId, { is_testing });

		const mode = is_testing ? 'testing' : 'production';
		if (locals.user.authenticated) {
			logger.log(`${locals.user.username} set selfbot ${selfbotId} on server ${serverId} to ${mode}`);
		}

		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
