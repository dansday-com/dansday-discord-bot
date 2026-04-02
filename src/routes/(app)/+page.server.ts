import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user.authenticated && locals.user.account_source === 'server_accounts') {
		redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}`);
	}

	let bots: any[] = [];
	try {
		const rawBots = await db.getAllBots();
		bots = await Promise.all(
			rawBots.map(async (bot: any) => {
				if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
					try {
						process.kill(bot.process_id, 0);
					} catch (_) {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
						bot.status = 'stopped';
						bot.process_id = null;
						bot.uptime_started_at = null;
					}
				}

				const botData: any = {
					id: bot.id,
					name: bot.name,
					bot_icon: bot.bot_icon,
					port: bot.port,
					application_id: bot.application_id,
					status: bot.status || 'stopped',
					process_id: bot.process_id || null,
					uptime_started_at: bot.uptime_started_at || null,
					created_at: bot.created_at,
					updated_at: bot.updated_at,
					is_testing: bot.is_testing || false
				};

				botData.uptime_ms = getBotUptimeMs(botData);
				return botData;
			})
		);
	} catch (_) {}

	return { bots, user: locals.user };
};
