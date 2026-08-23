import db from '$lib/database.js';
import { resolvePublicStatisticsSnapshot } from '$lib/frontend/public/statistics/index.js';
import { aggregatePanelStatistics } from '$lib/frontend/public/statistics/aggregate.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { bots } = await parent();

	let total_servers = 0;
	let total_selfbots = 0;
	let running_selfbots = 0;
	let total_uptime_ms = 0;
	let panel = {
		total_members: 0,
		total_boosters: 0,
		total_channels: 0,
		largest_server_members: 0,
		tracked_members: 0,
		total_xp: 0,
		total_messages: 0,
		total_voice_minutes: 0,
		members_in_voice: 0,
		total_panel_accounts: 0,
		shop_items_total: 0,
		shop_items_enabled: 0,
		shop_items_scheduled: 0,
		shop_avg_cost: 0
	};
	let global = aggregatePanelStatistics([]);

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		try {
			const panelData = await db.getPanelOverview(locals.user.panel_id);
			total_servers = panelData.total_servers;
			total_selfbots = panelData.total_selfbots;
			running_selfbots = panelData.running_selfbots;

			const bot_uptime_ms = bots.reduce((acc: number, b: any) => acc + (b.uptime_ms || 0), 0);
			total_uptime_ms = bot_uptime_ms + panelData.selfbot_uptime_ms;

			for (const key of Object.keys(panel) as (keyof typeof panel)[]) {
				panel[key] = Number((panelData as any)[key]) || 0;
			}
		} catch (err) {
			console.error('Failed to load overview stats', err);
		}

		try {
			const serverIds = await db.getServerIdsForPanel(locals.user.panel_id);
			const snapshots = await Promise.all(serverIds.map((id: number) => resolvePublicStatisticsSnapshot(id).catch(() => null)));
			global = aggregatePanelStatistics(snapshots.map((s) => s?.stats ?? null));
		} catch (err) {
			console.error('Failed to aggregate panel statistics', err);
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
			total_uptime_ms,
			...panel
		},
		global
	};
};
