import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { accountOwnsServer, SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}/members`);
			}
			redirect(302, '/dashboard');
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, '/dashboard');
	}

	const [members, permissions] = await Promise.all([
		db.getServerMembersList(params.serverId),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.permissions).catch(() => null)
	]);

	return { members: members ?? [], permissions: permissions ?? null };
};
