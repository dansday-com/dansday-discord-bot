import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/server/db.js';
import { getBotUptimeMs } from '$lib/server/botProcesses.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	if (locals.user.account_source === 'server_accounts') {
		redirect(302, `/bots/${locals.user.bot_id}/servers/${locals.user.server_id}`);
	}

	const rawBot = await db.getBot(params.id);
	if (!rawBot) error(404, 'Bot not found');

	if ((rawBot.status === 'running' || rawBot.status === 'starting' || rawBot.status === 'stopping') && rawBot.process_id) {
		try {
			process.kill(rawBot.process_id, 0);
		} catch (_) {
			await db.updateBot(rawBot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
			Object.assign(rawBot, await db.getBot(params.id));
		}
	}

	const { token, ...bot } = rawBot;
	bot.is_testing = rawBot.is_testing || false;
	bot.uptime_ms = getBotUptimeMs(bot);

	const servers = await db.getServersForBot(Number(params.id));

	return { bot, servers, user: locals.user };
};
