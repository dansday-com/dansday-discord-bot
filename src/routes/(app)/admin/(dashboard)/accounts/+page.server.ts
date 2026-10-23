import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
import { HTTP } from '$lib/http.js';

type PanelAccountRow = Awaited<ReturnType<typeof db.getPanelAccounts>>[number];
type PanelAccount = Pick<PanelAccountRow, 'id' | 'username' | 'email' | 'ip_address'> & {
	servers: Pick<PanelAccountRow, 'server_id' | 'server_name' | 'account_type' | 'is_frozen'>[];
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		redirect(HTTP.FOUND, DASHBOARD_PATH);
	}

	const accounts = new Map<number, PanelAccount>();
	for (const row of await db.getPanelAccounts(Number(locals.user.panel_id))) {
		const account = accounts.get(row.id) ?? { id: row.id, username: row.username, email: row.email, ip_address: row.ip_address, servers: [] };
		account.servers.push({ server_id: row.server_id, server_name: row.server_name, account_type: row.account_type, is_frozen: row.is_frozen });
		accounts.set(row.id, account);
	}
	return { accounts: [...accounts.values()] };
};
