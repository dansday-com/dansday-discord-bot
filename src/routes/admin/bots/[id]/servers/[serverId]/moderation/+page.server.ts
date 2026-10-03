import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer } from '$lib/frontend/panelServer.js';
import { TIER_DENIED, canActOn, panelActorOf } from '$lib/panelHierarchy.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
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

	const { overview } = await parent();
	const [logs, roles, tierRoles] = await Promise.all([
		db.getModerationLogs(serverId).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getMemberTierMap(serverId).catch(() => ({ staffRoleIds: [] as string[], adminRoleIds: [] as string[], tiers: {} }))
	]);
	const actor = panelActorOf(locals.user);
	const roleTier = (id: string) => (tierRoles.adminRoleIds.includes(id) ? 'owner' : tierRoles.staffRoleIds.includes(id) ? 'staff' : 'member');

	return {
		serverId,
		deniedReason: actor ? TIER_DENIED[actor] : 'Access denied',
		roles: (roles as any[])
			.filter((r) => String(r.discord_role_id) !== String((overview as any).discord_server_id))
			.map((r) => ({
				id: String(r.discord_role_id),
				name: String(r.name),
				color: r.color ?? null,
				manageable: canActOn(actor, roleTier(String(r.discord_role_id)))
			})),
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
