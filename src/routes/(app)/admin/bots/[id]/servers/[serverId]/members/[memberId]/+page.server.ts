import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { TIER_DENIED, canActOn, panelActorOf, type MemberTier } from '$lib/panelHierarchy.js';
import { moderationRulesFromSettings } from '$lib/moderation-rules.js';
import { isUtcSqlExpired } from '$lib/utils/index.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { overview } = await parent();
	const serverId = Number(params.serverId);
	const id = params.memberId;
	if (!/^\d{15,25}$/.test(id)) error(404, 'Member not found');

	const base = await db.getMemberByDiscordId(serverId, id, { includeDeleted: true });
	if (!base || base.is_bot) error(404, 'Member not found');

	const [list, cases, roles, tierMap, mainSettings] = await Promise.all([
		db.getServerMembersList(serverId, { discordMemberId: id }).catch(() => []),
		db.getMemberModerationCases(serverId, id).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getMemberTierMap(serverId).catch(() => ({ staffRoleIds: [] as string[], adminRoleIds: [] as string[], tiers: {} as Record<string, MemberTier> })),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const m = (list as any[])[0] ?? base;
	const actor = panelActorOf(locals.user);
	const roleTier = (roleId: string) => (tierMap.adminRoleIds.includes(roleId) ? 'owner' : tierMap.staffRoleIds.includes(roleId) ? 'staff' : 'member');
	const canEdit = canActOn(actor, tierMap.tiers[id] ?? 'member');
	const isOwner = !!Number(base.is_owner);
	const deniedReason = actor ? TIER_DENIED[actor] : 'Access denied';

	const active = (cases as any[]).filter((c) => Number(c.active) === 1);
	const timeout = active.find((c) => c.action === 'timeout' && c.expires_at && !isUtcSqlExpired(c.expires_at));
	const memberRoles = ((m.roles ?? []) as any[]).map((r) => ({
		id: String(r.id),
		name: String(r.name || 'Unknown Role'),
		color: (r.color ?? null) as string | null
	}));
	const name = String(m.server_display_name || m.display_name || m.username || id);

	return {
		deniedReason,
		moderationDenied: isOwner ? "The server owner can't be moderated" : deniedReason,
		canEdit,
		canModerate: canEdit && !isOwner,
		presets: moderationRulesFromSettings(mainSettings?.settings).reason_presets,
		member: {
			id,
			name: name.replace(/^\s*(\[AFK\]\s*)+/gi, '').trim() || name,
			username: (m.username ?? null) as string | null,
			avatar: (m.avatar ?? null) as string | null,
			here: !base.deleted_at,
			is_booster: !!Number(m.is_booster),
			is_afk: !!m.is_afk,
			rank: m.rank == null ? null : Number(m.rank),
			level: Number(m.level) || 1,
			xp: Number(m.xp) || 0,
			chat_total: Number(m.chat_total) || 0,
			voice_minutes_active: Number(m.voice_minutes_active) || 0,
			voice_minutes_afk: Number(m.voice_minutes_afk) || 0,
			invites: Number(m.invites_total) || 0,
			member_since: m.member_since ?? null,
			profile_created_at: m.profile_created_at ?? null,
			roles: memberRoles,
			role_ids: memberRoles.map((r) => r.id),
			warnings: active.filter((c) => c.action === 'warn').length,
			timeout_until: (timeout?.expires_at ?? null) as string | null,
			banned: active.some((c) => c.action === 'ban' || c.action === 'tempban')
		},
		roles: (roles as any[])
			.filter((r) => String(r.discord_role_id) !== String((overview as any).discord_server_id))
			.map((r) => ({
				id: String(r.discord_role_id),
				name: String(r.name),
				manageable: canActOn(actor, roleTier(String(r.discord_role_id)))
			}))
	};
};
