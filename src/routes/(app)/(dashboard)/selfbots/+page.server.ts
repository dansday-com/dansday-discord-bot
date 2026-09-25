import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const panelId = locals.user.account_source === 'accounts' ? (locals.user.panel_id ?? null) : null;
	const selfbots = panelId == null ? [] : await db.getPanelSelfbots(panelId);

	return {
		selfbots: selfbots.map((sb) => ({ id: sb.id, name: sb.name, bot_icon: sb.bot_icon, status: sb.status })),
		user: locals.user
	};
};
