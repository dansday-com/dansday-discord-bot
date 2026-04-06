import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user.authenticated && locals.user.account_source === 'server_accounts') {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}`);
		}
		redirect(302, '/');
	}

	let bots: any[] = [];
	try {
		const rawBots = locals.user.authenticated && locals.user.account_source === 'accounts' ? await db.getAllBots(locals.user.panel_id) : await db.getAllBots();
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
					updated_at: bot.updated_at
				};

				botData.uptime_ms = getBotUptimeMs(botData);
				return botData;
			})
		);
	} catch (_) {}

	return { bots, user: locals.user };
};
