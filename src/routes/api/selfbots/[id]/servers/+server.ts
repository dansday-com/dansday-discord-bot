import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsServer } from '$lib/frontend/panelServer.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = Number(params.id);
		const selfbot = await db.getServerBotById(id);
		if (!selfbot) return json({ error: 'Selfbot not found' }, { status: 404 });
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
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
