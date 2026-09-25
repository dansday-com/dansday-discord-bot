import process from 'node:process';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { presenceFromDbRow } from '$lib/database.js';
import { getBotUptimeMs } from '$lib/botProcesses.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const selfbotId = Number(params.selfbotId);
	if (!selfbotId) redirect(302, '/selfbots');

	const panelId = locals.user.account_source === 'accounts' ? (locals.user.panel_id ?? null) : null;
	if (panelId == null) redirect(302, '/selfbots');

	let bot = await db.getSelfbotById(selfbotId);
	if (!bot || bot.panel_id !== panelId) redirect(302, '/selfbots');

	if ((bot.status === 'running' || bot.status === 'starting' || bot.status === 'stopping') && bot.process_id) {
		try {
			process.kill(bot.process_id, 0);
		} catch (_) {
			await db.updateSelfbot(bot.id, { status: 'stopped', process_id: null, uptime_started_at: null });
			const refreshed = await db.getSelfbotById(selfbotId);
			if (refreshed) bot = refreshed;
		}
	}

	const servers = await db.getServersForSelfbot(selfbotId);

	const statusRow = await db.getSelfbotStatus(selfbotId);
	const selfbotPresence = presenceFromDbRow(statusRow);

	const { token: _token, ...botPublic } = bot as typeof bot & { token?: string };
	void _token;

	return {
		bot: {
			...botPublic,
			uptime_ms: getBotUptimeMs(bot)
		},
		servers,
		user: locals.user,
		selfbotPresence
	};
};
