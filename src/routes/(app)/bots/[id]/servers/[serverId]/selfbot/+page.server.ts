import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { isGuildStaffUser } from '$lib/serverPanelAccess.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts' && locals.user.server_id !== serverId) {
		const ob = await getOfficialBotIdForServer(locals.user.server_id);
		const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
		const targetBot = ob ?? fallback;
		if (targetBot != null) {
			redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}/selfbot`);
		}
		redirect(302, '/dashboard');
	}

	const selfbots = await db.getServerBots(serverId);

	return {
		selfbots,
		serverId,
		botId: params.id,
		user: locals.user,
		selfbotViewOnly: isGuildStaffUser(locals.user)
	};
};
