import db from '$lib/database.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { bots } = await parent();

	let total_servers = 0;
	let total_selfbots = 0;
	let running_selfbots = 0;
	let total_uptime_ms = 0;

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		try {
			const panelData = await db.getPanelOverview(locals.user.panel_id);
			total_servers = panelData.total_servers;
			total_selfbots = panelData.total_selfbots;
			running_selfbots = panelData.running_selfbots;

			const bot_uptime_ms = bots.reduce((acc: number, b: any) => acc + (b.uptime_ms || 0), 0);
			total_uptime_ms = bot_uptime_ms + panelData.selfbot_uptime_ms;
		} catch (err) {
			console.error('Failed to load overview stats', err);
		}
	}

	return {
		stats: {
			total_bots: bots?.length || 0,
			running_bots: bots?.filter((b: any) => b.status === 'running').length || 0,
			stopped_bots: bots?.filter((b: any) => b.status !== 'running').length || 0,
			total_servers,
			total_selfbots,
			running_selfbots,
			stopped_selfbots: total_selfbots - running_selfbots,
			total_uptime_ms
		}
	};
};
