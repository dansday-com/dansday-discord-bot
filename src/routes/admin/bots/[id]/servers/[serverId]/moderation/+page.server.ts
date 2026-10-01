import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'moderation'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const logs = await db.getModerationLogs(serverId).catch(() => []);

	return {
		serverId,
		logs: (logs as any[]).map((l) => ({
			id: String(l.id),
			case_number: Number(l.case_number),
			action: String(l.action),
			reason: l.reason ?? null,
			duration_seconds: l.duration_seconds == null ? null : Number(l.duration_seconds),
			expires_at: l.expires_at ?? null,
			active: Boolean(Number(l.active)),
			source: String(l.source),
			revoked_at: l.revoked_at ?? null,
			created_at: l.created_at,
			discord_member_id: String(l.discord_member_id),
			member_name: l.member_name ?? null,
			member_avatar: l.member_avatar ?? null,
			staff_discord_id: l.staff_discord_id ?? null,
			staff_name: l.staff_name ?? null
		}))
	};
};
