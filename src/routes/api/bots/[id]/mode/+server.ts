import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';
import logger from '$lib/server/logger.js';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 });
	}

	try {
		const bot = await db.getBot(params.id);
		if (!bot) return json({ success: false, error: 'Bot not found' }, { status: 404 });

		if (bot.bot_type !== 'official') {
			return json({ success: false, error: 'Mode can only be changed for official bots. Selfbots inherit mode from their connected bot.' }, { status: 400 });
		}

		const { is_testing } = await request.json();
		if (typeof is_testing !== 'boolean') {
			return json({ success: false, error: 'is_testing must be a boolean value' }, { status: 400 });
		}

		await db.updateBot(params.id, { is_testing });

		// Update connected selfbots
		try {
			const allBots = await db.getAllBots();
			const officialBotIdNum = Number(params.id);
			const connectedSelfbots = allBots.filter((b: any) => {
				if (b.bot_type !== 'selfbot') return false;
				return Number(b.connect_to) === officialBotIdNum;
			});

			for (const selfbot of connectedSelfbots) {
				await db.updateBot(selfbot.id, { is_testing });
			}
		} catch {}

		const mode = is_testing ? 'testing' : 'production';
		logger.log(`${locals.user.username} changed bot "${bot.name}" (ID: ${bot.id}) to ${mode} mode`);

		return json({ success: true });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
