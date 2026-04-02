import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect owner/moderator to their server page directly
	if (locals.user.authenticated && (locals.user.account_type === 'owner' || locals.user.account_type === 'moderator')) {
		const servers = locals.user.accessible_servers ?? [];
		if (servers.length === 1) {
			try {
				const server = await db.getServer(servers[0].server_id);
				if (server) {
					redirect(302, `/bots/${server.bot_id}/servers/${server.id}/config`);
				}
			} catch (_) {}
		}
		// Multiple servers: fall through and let the page show a picker (bots list will be empty for them)
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
					bot_type: bot.bot_type,
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
