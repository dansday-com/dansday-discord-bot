import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { DASHBOARD_PATH, adminServerPath } from '$lib/frontend/redirect.js';
import type { BotRow } from '$lib/schema.js';
import { HTTP } from '$lib/http.js';
import { hasLostBotProcess } from '$lib/botControl.js';

type DashboardBot = Pick<
	BotRow,
	'id' | 'name' | 'bot_icon' | 'port' | 'application_id' | 'status' | 'process_id' | 'uptime_started_at' | 'created_at' | 'updated_at'
> & { uptime_ms?: number };

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.user.authenticated && locals.user.account_source === 'server_accounts') {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(HTTP.FOUND, adminServerPath(targetBot, locals.user.server_id));
		}
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	let bots: DashboardBot[] = [];
	try {
		if (locals.user.authenticated && locals.user.account_source === 'accounts') {
			const rawBots = await db.getAllBots(locals.user.panel_id);
			bots = await Promise.all(
				rawBots.map(async (bot) => {
					if (hasLostBotProcess(bot)) {
						await db.updateBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
						bot.status = 'stopped';
						bot.process_id = null;
						bot.uptime_started_at = null;
					}

					const botData: DashboardBot = {
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
		}
	} catch (_) {}

	return { bots, user: locals.user };
};
