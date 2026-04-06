import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { webBotHome } from '$lib/frontend/redirect.js';

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const botId = Number(params.id);
	const serverIdNum = Number(params.serverId);

	if (!Number.isFinite(serverIdNum) || serverIdNum <= 0) {
		redirect(302, webBotHome(url.pathname));
	}

	const overview = await db.getServerOverview(params.serverId);
	if (!overview) {
		redirect(302, webBotHome(url.pathname));
	}

	const canonicalBotId = overview.bot_id != null ? Number(overview.bot_id) : null;

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverIdNum) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}`);
			}
			redirect(302, webBotHome(url.pathname));
		}
		if (canonicalBotId != null && botId !== canonicalBotId) {
			redirect(302, `/bots/${canonicalBotId}/servers/${serverIdNum}`);
		}
		if (canonicalBotId == null) {
			redirect(302, webBotHome(url.pathname));
		}
		return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
	}

	if (canonicalBotId == null) {
		redirect(302, webBotHome(url.pathname));
	}
	if (botId !== canonicalBotId) {
		redirect(302, `/bots/${canonicalBotId}/servers/${serverIdNum}`);
	}

	return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
};
