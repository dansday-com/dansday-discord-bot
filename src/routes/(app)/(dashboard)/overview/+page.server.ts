import db from '$lib/database.js';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { bots } = await parent();

	let total_servers = 0;
	let total_selfbots = 0;
	let running_selfbots = 0;
	let total_uptime_ms = 0;

	if (locals.user.authenticated && locals.user.account_source === 'accounts' && locals.user.panel_id) {
		try {
			const serversResult = await db.execute(sql`
                SELECT COUNT(*) as count 
                FROM servers s
                JOIN bots b ON s.bot_id = b.id
                WHERE b.panel_id = ${locals.user.panel_id}
            `);
			const sRows = serversResult[0] as any[];
			if (sRows && sRows.length > 0) {
				total_servers = Number(sRows[0].count) || 0;
			}

			const selfbotsResult = await db.execute(sql`
                SELECT 
                    COUNT(*) as count, 
                    SUM(CASE WHEN sb.status = 'running' THEN 1 ELSE 0 END) as running_count
                FROM server_bots sb
                JOIN servers s ON sb.server_id = s.id
                JOIN bots b ON s.bot_id = b.id
                WHERE b.panel_id = ${locals.user.panel_id}
            `);
			const sbRows = selfbotsResult[0] as any[];
			if (sbRows && sbRows.length > 0) {
				total_selfbots = Number(sbRows[0].count) || 0;
				running_selfbots = Number(sbRows[0].running_count) || 0;
			}

			const uptimeResult = await db.execute(sql`
                SELECT SUM(TIMESTAMPDIFF(SECOND, uptime_started_at, UTC_TIMESTAMP())) * 1000 as uptime_ms
                FROM server_bots sb
                JOIN servers s ON sb.server_id = s.id
                JOIN bots b ON s.bot_id = b.id
                WHERE b.panel_id = ${locals.user.panel_id} AND sb.status = 'running' AND sb.uptime_started_at IS NOT NULL
            `);
			const upRows = uptimeResult[0] as any[];
			let selfbot_uptime_ms = 0;
			if (upRows && upRows.length > 0) {
				selfbot_uptime_ms = Number(upRows[0].uptime_ms) || 0;
			}

			const bot_uptime_ms = bots.reduce((acc: number, b: any) => acc + (b.uptime_ms || 0), 0);
			total_uptime_ms = bot_uptime_ms + selfbot_uptime_ms;
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
