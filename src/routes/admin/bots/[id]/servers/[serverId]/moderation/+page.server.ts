import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { SERVER_SETTINGS, accountOwnsServer } from '$lib/frontend/panelServer.js';
import { TIER_DENIED, canActOn, panelActorOf } from '$lib/panelHierarchy.js';
import { moderationRulesFromSettings } from '$lib/moderation-rules.js';

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
	const [members, cases, roles, tierMap, mainSettings] = await Promise.all([
		db.getServerMembersList(serverId).catch(() => []),
		db.getActiveModerationCases(serverId).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getMemberTierMap(serverId).catch(() => ({ staffRoleIds: [] as string[], adminRoleIds: [] as string[], tiers: {} })),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const actor = panelActorOf(locals.user);
	const roleTier = (id: string) => (tierMap.adminRoleIds.includes(id) ? 'owner' : tierMap.staffRoleIds.includes(id) ? 'staff' : 'member');

	const standing = new Map<string, { warnings: number; last_warned_at: string | null; timeout_until: string | null }>();
	const bans: {
		discord_member_id: string;
		name: string | null;
		avatar: string | null;
		case_number: number;
		action: string;
		reason: string | null;
		expires_at: string | null;
		created_at: string;
	}[] = [];
	for (const c of cases as any[]) {
		const id = String(c.discord_member_id);
		const entry = standing.get(id) ?? { warnings: 0, last_warned_at: null, timeout_until: null };
		if (c.action === 'warn') {
			entry.warnings++;
			entry.last_warned_at ??= c.created_at;
		} else if (c.action === 'timeout') {
			entry.timeout_until ??= c.expires_at ?? null;
		} else if (!bans.some((b) => b.discord_member_id === id)) {
			bans.push({
				discord_member_id: id,
				name: c.member_name ?? null,
				avatar: c.member_avatar ?? null,
				case_number: Number(c.case_number),
				action: String(c.action),
				reason: c.reason ?? null,
				expires_at: c.expires_at ?? null,
				created_at: c.created_at
			});
		}
		standing.set(id, entry);
	}

	return {
		serverId,
		deniedReason: actor ? TIER_DENIED[actor] : 'Access denied',
		rules: moderationRulesFromSettings(mainSettings?.settings),
		lockedIds: Object.entries(tierMap.tiers)
			.filter(([, tier]) => !canActOn(actor, tier))
			.map(([id]) => id),
		members: (members as any[]).map((m) => {
			const id = String(m.discord_member_id);
			const top = (m.roles ?? [])[0] ?? null;
			return {
				id,
				name: m.server_display_name || m.display_name || m.username || id,
				username: m.username ?? null,
				avatar: m.avatar ?? null,
				role_ids: (m.roles ?? []).map((r: any) => String(r.id)),
				top_role: top ? { name: String(top.name), color: top.color ?? null } : null,
				member_since: m.member_since ?? null,
				warnings: standing.get(id)?.warnings ?? 0,
				last_warned_at: standing.get(id)?.last_warned_at ?? null,
				timeout_until: standing.get(id)?.timeout_until ?? null
			};
		}),
		bans,
		roles: (roles as any[])
			.filter((r) => String(r.discord_role_id) !== String((overview as any).discord_server_id))
			.map((r) => ({
				id: String(r.discord_role_id),
				name: String(r.name),
				color: r.color ?? null,
				manageable: canActOn(actor, roleTier(String(r.discord_role_id)))
			}))
	};
};
