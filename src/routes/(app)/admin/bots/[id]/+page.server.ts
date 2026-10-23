import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (locals.user.authenticated && locals.user.account_source === 'server_accounts') {
		const servers = await db.getServersForAccount(locals.user.account_id);
		return { servers: servers.map((s) => ({ ...s, is_frozen: s.is_frozen === true })) };
	}
	return { servers: await db.getServersForBot(Number(params.id)) };
};
