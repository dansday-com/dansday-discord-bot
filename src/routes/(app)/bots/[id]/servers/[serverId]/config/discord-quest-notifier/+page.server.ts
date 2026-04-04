import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, 'discord_quest_notifier').catch(() => null);
	const raw = row?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		settings: {
			enabled: s.enabled === true,
			channel_id: typeof s.channel_id === 'string' ? s.channel_id : '',
			http_proxy_url: typeof s.http_proxy_url === 'string' ? s.http_proxy_url : ''
		}
	};
};
