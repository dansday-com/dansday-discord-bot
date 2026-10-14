import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { DASHBOARD_PATH, webRouteUp, isBotSectionPath, adminServerPath } from '$lib/frontend/redirect.js';
import { accountOwnsBot } from '$lib/backend/panelServer.js';
import { HTTP } from '$lib/http.js';
import { hasLostBotProcess } from '$lib/botControl.js';

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}

	const botId = Number(params.id);
	const isBotSection = isBotSectionPath(url.pathname);

	if (isBotSection) {
		if (locals.user.account_source === 'server_accounts') {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(HTTP.FOUND, adminServerPath(targetBot, locals.user.server_id));
			}
			redirect(HTTP.FOUND, DASHBOARD_PATH);
		}

		if (!(await accountOwnsBot(locals, botId))) {
			redirect(HTTP.FOUND, webRouteUp(url.pathname));
		}
	}

	const rawBot = await db.getBot(params.id);
	if (!rawBot) {
		redirect(HTTP.FOUND, webRouteUp(url.pathname));
	}

	if (hasLostBotProcess(rawBot)) {
		await db.updateBot(rawBot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
		Object.assign(rawBot, await db.getBot(params.id));
	}

	const { token, ...bot }: typeof rawBot & { uptime_ms?: number } = rawBot;
	bot.uptime_ms = getBotUptimeMs(bot);

	return { bot, user: locals.user };
};
