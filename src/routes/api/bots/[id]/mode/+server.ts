import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const bot = await db.getBot(params.id);
		if (!bot) return json({ success: false, error: 'Bot not found' }, { status: 404 });

		const { is_testing } = await request.json();
		if (typeof is_testing !== 'boolean') {
			return json({ success: false, error: 'is_testing must be a boolean value' }, { status: 400 });
		}

		await db.updateBot(params.id, { is_testing });

		const mode = is_testing ? 'testing' : 'production';
		logger.log(`${locals.user.username} changed bot "${bot.name}" (ID: ${bot.id}) to ${mode} mode`);

		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
