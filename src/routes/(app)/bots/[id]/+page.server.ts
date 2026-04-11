import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { presenceFromDbRow, getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { DASHBOARD_PATH, webRouteUp } from '$lib/frontend/redirect.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	if (locals.user.account_source === 'server_accounts') {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}`);
		}
		redirect(302, DASHBOARD_PATH);
	}

	const botId = Number(params.id);
	if (!(await accountOwnsBot(locals, botId))) redirect(302, webRouteUp(url.pathname));

	const rawBot = await db.getBot(params.id);
	if (!rawBot) redirect(302, webRouteUp(url.pathname));

	if ((rawBot.status === 'running' || rawBot.status === 'starting' || rawBot.status === 'stopping') && rawBot.process_id) {
		try {
			process.kill(rawBot.process_id, 0);
		} catch (_) {
			await db.updateBot(rawBot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
			Object.assign(rawBot, await db.getBot(params.id));
		}
	}

	const { token, ...bot } = rawBot;
	bot.uptime_ms = getBotUptimeMs(bot);

	const servers = await db.getServersForBot(Number(params.id));

	const statusRow = await db.getBotStatusByBotId(botId);
	const botPresence = presenceFromDbRow(statusRow);

	return { bot, servers, user: locals.user, botPresence };
};
