import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer, SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'changes'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const officialServerId = await db.getOfficialBotServerIdForServer(serverId).catch(() => null);
	const serverIds = [...new Set([serverId, ...(officialServerId != null ? [Number(officialServerId)] : [])])];
	const rows = await db.getServerSettingLogs(serverIds).catch(() => []);

	return {
		logs: (rows as any[]).map((r) => {
			let changes: { key: string; before: string | null; after: string | null }[] = [];
			try {
				changes = typeof r.changes === 'string' ? JSON.parse(r.changes) : (r.changes ?? []);
			} catch {
				changes = [];
			}
			const isPanelAdmin = r.account_id != null;
			return {
				id: String(r.id),
				component: String(r.component_name),
				component_label: SERVER_SETTINGS.featureLabel(String(r.component_name)),
				created_at: r.created_at,
				who: (isPanelAdmin ? r.account_username : r.server_account_username) ?? null,
				role: isPanelAdmin ? 'Admin' : r.server_account_type === 'owner' ? 'Owner' : r.server_account_type === 'staff' ? 'Staff' : null,
				changes
			};
		})
	};
};
