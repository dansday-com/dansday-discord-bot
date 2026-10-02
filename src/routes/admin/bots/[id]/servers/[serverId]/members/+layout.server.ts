import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer, SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { panelActorOf } from '$lib/panelHierarchy.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'members'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const [members, mainSettings, creatorSettings, adminRoleIds] = await Promise.all([
		db.getServerMembersList(params.serverId),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.content_creator).catch(() => null),
		db.getAdministratorRoleIds(params.serverId).catch(() => [])
	]);

	return {
		members: members ?? [],
		staffRoleIds: (mainSettings?.settings?.staff_roles ?? []) as string[],
		contentCreatorRoleIds: (creatorSettings?.settings?.content_creator_roles ?? []) as string[],
		adminRoleIds: adminRoleIds ?? [],
		panelActor: panelActorOf(locals.user)
	};
};
