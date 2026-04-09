import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsServer } from '$lib/serverPanelAccess.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = Number(params.id);
		const official = await db.getBot(id);
		if (official) {
			// guard already verified bot ownership for accounts users
			return json(await db.getServersForBot(id));
		}
		const selfbot = await db.getServerBotById(id);
		if (selfbot) {
			// for selfbot route, guard matched /api/bots/:id — but selfbot ids aren't panel bots,
			// so verify server ownership explicitly here
			if (locals.user.authenticated && locals.user.account_source === 'server_accounts') {
				if (locals.user.server_id !== selfbot.server_id) {
					return json({ error: 'Access denied' }, { status: 403 });
				}
			}
			if (locals.user.authenticated && locals.user.account_source === 'accounts') {
				if (!(await accountOwnsServer(locals, selfbot.server_id))) {
					return json({ error: 'Access denied' }, { status: 403 });
				}
			}
			return json(await db.getServersForSelfbot(id));
		}
		return json({ error: 'Bot not found' }, { status: 404 });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
