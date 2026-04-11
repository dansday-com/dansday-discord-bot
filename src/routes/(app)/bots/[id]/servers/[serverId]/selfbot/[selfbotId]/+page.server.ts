import process from 'node:process';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { webRouteUp } from '$lib/frontend/redirect.js';
import { isGuildStaffUser } from '$lib/serverPanelAccess.js';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);
	const selfbotId = Number(params.selfbotId);

	if (!serverId || !selfbotId) redirect(302, webRouteUp(url.pathname));

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}/selfbot`);
		}
		redirect(302, '/dashboard');
	}

	let bot = await db.getServerBotById(selfbotId);
	if (!bot || bot.server_id !== serverId) redirect(302, webRouteUp(url.pathname));

	if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
		try {
			process.kill(bot.process_id, 0);
		} catch (_) {
			await db.updateServerBot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
			const refreshed = await db.getServerBotById(selfbotId);
			if (refreshed) bot = refreshed;
		}
	}

	const servers = await db.getServersForSelfbot(selfbotId);

	const { token: _token, ...botPublic } = bot as typeof bot & { token?: string };
	void _token;

	return {
		bot: {
			...botPublic,
			uptime_ms: getBotUptimeMs(bot)
		},
		servers,
		serverId,
		botId: params.id,
		user: locals.user,
		selfbotViewOnly: isGuildStaffUser(locals.user)
	};
};
