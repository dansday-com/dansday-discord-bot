import process from 'node:process';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { DEFAULT_SERVER_BOT_PRESENCE, getOfficialBotIdForServer } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';
import { DASHBOARD_PATH, webRouteUp } from '$lib/frontend/redirect.js';
import { isGuildStaffUser } from '$lib/frontend/panelServer.js';

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
		redirect(302, DASHBOARD_PATH);
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

	const statusRow = await db.getServerBotStatusByServerBotId(selfbotId);
	const selfbotPresence = statusRow
		? {
				discord_status: statusRow.discord_status as (typeof DEFAULT_SERVER_BOT_PRESENCE)['discord_status'],
				activity_type: statusRow.activity_type as (typeof DEFAULT_SERVER_BOT_PRESENCE)['activity_type'],
				activity_name: statusRow.activity_name ?? '',
				activity_url: statusRow.activity_url ?? null,
				activity_state: statusRow.activity_state ?? null
			}
		: DEFAULT_SERVER_BOT_PRESENCE;

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
		selfbotViewOnly: isGuildStaffUser(locals.user),
		selfbotPresence
	};
};
