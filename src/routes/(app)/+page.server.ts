import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';

export const load: PageServerLoad = async ({ locals }) => {
	let bots: any[] = [];
	try {
		const rawBots = await db.getAllBots();
		bots = await Promise.all(
			rawBots.map(async (bot: any) => {
				if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
					try {
						process.kill(bot.process_id, 0);
					} catch {
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
					connect_to: bot.connect_to,
					status: bot.status || 'stopped',
					process_id: bot.process_id || null,
					uptime_started_at: bot.uptime_started_at || null,
					created_at: bot.created_at,
					updated_at: bot.updated_at,
					is_testing: bot.is_testing || false
				};

				if (bot.connect_to) {
					const connectToId = Number(bot.connect_to);
					if (connectToId && !Number.isNaN(connectToId)) {
						try {
							const connectedBot = await db.getBot(connectToId);
							if (connectedBot) {
								botData.connected_bot_name = connectedBot.name?.trim() || null;
								if (bot.bot_type === 'selfbot') {
									botData.is_testing = connectedBot.is_testing || false;
								}
							}
						} catch {}
					}
				}

				botData.uptime_ms = getBotUptimeMs(botData);
				return botData;
			})
		);
	} catch {}

	return { bots, user: locals.user };
};
