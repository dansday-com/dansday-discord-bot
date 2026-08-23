import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const parentData = await parent();
	const bots = await db.getAllBots(locals.user.panel_id).catch(() => []);

	const byGuild = new Map<string, { discord_server_id: string; name: string; server_icon: string | null; greeted_at: unknown; bots: string[] }>();

	for (const bot of bots as any[]) {
		const servers = await db.getServersForBot(Number(bot.id)).catch(() => []);
		for (const s of servers as any[]) {
			const guildId = String(s.discord_server_id || '');
			if (!guildId) continue;
			const existing = byGuild.get(guildId);
			if (existing) {
				existing.bots.push(bot.name);
				if (!existing.greeted_at && s.greeted_at) existing.greeted_at = s.greeted_at;
				continue;
			}
			byGuild.set(guildId, {
				discord_server_id: guildId,
				name: s.name || guildId,
				server_icon: s.server_icon ?? null,
				greeted_at: s.greeted_at ?? null,
				bots: [bot.name]
			});
		}
	}

	const servers = [...byGuild.values()].sort((a, b) => a.name.localeCompare(b.name));

	return { user: parentData.user, servers };
};
