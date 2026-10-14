import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { webBotHome, adminServerPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer } from '$lib/backend/panelServer.js';
import { loadAssetPriceMap } from '$lib/backend/public/market/index.js';
import { HTTP } from '$lib/http.js';

type AdminServerOverview = Extract<NonNullable<Awaited<ReturnType<typeof db.getServerOverview>>>, { sync: unknown }>;

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}

	const botId = Number(params.id);
	const serverIdNum = Number(params.serverId);

	if (!Number.isFinite(serverIdNum) || serverIdNum <= 0) {
		redirect(HTTP.FOUND, webBotHome(url.pathname));
	}

	const priceMap = await loadAssetPriceMap().catch(() => ({}));
	const overview = (await db.getServerOverview(params.serverId, { priceMap })) as AdminServerOverview | null;
	if (!overview) {
		redirect(HTTP.FOUND, webBotHome(url.pathname));
	}

	const canonicalBotId = overview.bot_id != null ? Number(overview.bot_id) : null;

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverIdNum) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(HTTP.FOUND, adminServerPath(targetBot, locals.user.server_id));
			}
			redirect(HTTP.FOUND, webBotHome(url.pathname));
		}
		if (canonicalBotId != null && botId !== canonicalBotId) {
			redirect(HTTP.FOUND, adminServerPath(canonicalBotId, serverIdNum));
		}
		if (canonicalBotId == null) {
			redirect(HTTP.FOUND, webBotHome(url.pathname));
		}
		return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
	}

	if (canonicalBotId == null) {
		redirect(HTTP.FOUND, webBotHome(url.pathname));
	}
	if (botId !== canonicalBotId) {
		redirect(HTTP.FOUND, adminServerPath(canonicalBotId, serverIdNum));
	}

	if (!(await accountOwnsServer(locals, serverIdNum))) {
		redirect(HTTP.FOUND, webBotHome(url.pathname));
	}

	return { overview, botId: params.id, serverId: params.serverId, user: locals.user };
};
