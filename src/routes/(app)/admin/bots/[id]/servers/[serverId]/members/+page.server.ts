import type { PageServerLoad } from './$types';
import db, { type MemberListRow } from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { TIER_DENIED, canActOn, panelActorOf, type MemberTier } from '$lib/panelHierarchy.js';
import { moderationRulesFromSettings } from '$lib/moderation-rules.js';

type ModerationCase = Awaited<ReturnType<typeof db.getActiveModerationCases>>[number];
type Inviter = Awaited<ReturnType<typeof db.getServerInviters>>[number];
type TierMap = { staffRoleIds: string[]; adminRoleIds: string[]; tiers: Record<string, MemberTier> };
type Standing = { warnings: number; timeout_until: string | null };
type BanEntry = { name: string | null; avatar: string | null; action: string; reason: string | null; expires_at: string | null; created_at: string };
type RowContext = {
	actor: ReturnType<typeof panelActorOf>;
	tierMap: TierMap;
	inviterById: Map<string, Inviter>;
	standing: Map<string, Standing>;
	bans: Map<string, BanEntry>;
};
type GoneMember = { name: string | null; avatar: string | null };

function caseStanding(cases: ModerationCase[]) {
	const standing = new Map<string, Standing>();
	const bans = new Map<string, BanEntry>();
	for (const c of cases) {
		const id = String(c.discord_member_id);
		if (c.action === 'warn' || c.action === 'timeout') {
			const entry = standing.get(id) ?? { warnings: 0, timeout_until: null };
			if (c.action === 'warn') {
				entry.warnings++;
			} else {
				entry.timeout_until ??= c.expires_at ?? null;
			}
			standing.set(id, entry);
		} else if (!bans.has(id)) {
			bans.set(id, {
				name: c.member_name ?? null,
				avatar: c.member_avatar ?? null,
				action: String(c.action),
				reason: c.reason ?? null,
				expires_at: c.expires_at ?? null,
				created_at: c.created_at
			});
		}
	}
	return { standing, bans };
}

function memberRow(id: string, { m, gone }: { m: MemberListRow | null; gone: GoneMember | null }, ctx: RowContext) {
	const inviter = ctx.inviterById.get(id);
	const ban = ctx.bans.get(id) ?? null;
	const name = String((m ? m.server_display_name || m.display_name || m.username : gone?.name) || id);
	return {
		id,
		name: name.replace(/^\s*(\[AFK\]\s*)+/gi, '').trim() || name,
		username: (m?.username ?? null) as string | null,
		avatar: (m?.avatar ?? gone?.avatar ?? null) as string | null,
		here: m !== null,
		is_owner: !!m?.is_owner,
		locked: !!m?.is_owner || !canActOn(ctx.actor, ctx.tierMap.tiers[id] ?? 'member'),
		is_booster: !!Number(m?.is_booster),
		is_afk: !!m?.is_afk,
		role_ids: ((m?.roles ?? []) as Record<string, unknown>[]).map((r) => String(r.id)),
		rank: m?.rank == null ? null : Number(m.rank),
		level: Number(m?.level) || 1,
		xp: Number(m?.xp) || 0,
		chat_total: Number(m?.chat_total) || 0,
		voice_minutes_active: Number(m?.voice_minutes_active) || 0,
		voice_minutes_afk: Number(m?.voice_minutes_afk) || 0,
		member_since: m?.member_since ?? null,
		profile_created_at: m?.profile_created_at ?? null,
		invites: m ? Number(m.invites_total) || 0 : (inviter?.total ?? 0),
		invite_joins: inviter?.joins ?? 0,
		invite_left: inviter?.left ?? 0,
		invite_fake: inviter?.fake ?? 0,
		last_invite_at: inviter?.last_join_at ?? null,
		warnings: ctx.standing.get(id)?.warnings ?? 0,
		timeout_until: ctx.standing.get(id)?.timeout_until ?? null,
		ban: ban && { action: ban.action, reason: ban.reason, expires_at: ban.expires_at, created_at: ban.created_at }
	};
}

function allMemberRows(members: MemberListRow[], inviters: Inviter[], ctx: RowContext) {
	const rows = members.map((m) => memberRow(String(m.discord_member_id), { m, gone: null }, ctx));
	const listed = new Set(rows.map((r) => r.id));
	for (const [id, ban] of ctx.bans) {
		if (!listed.has(id)) {
			listed.add(id);
			rows.push(memberRow(id, { m: null, gone: ban }, ctx));
		}
	}
	for (const inviter of inviters) {
		if (inviter.left_server && !listed.has(inviter.discord_member_id)) {
			listed.add(inviter.discord_member_id);
			rows.push(memberRow(inviter.discord_member_id, { m: null, gone: inviter }, ctx));
		}
	}
	return rows;
}

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { overview } = await parent();
	const serverId = Number(params.serverId);

	const [members, cases, roles, tierMap, mainSettings, creatorSettings, inviters] = await Promise.all([
		db.getServerMembersList(serverId).catch(() => []),
		db.getActiveModerationCases(serverId).catch(() => []),
		db.getRoles(serverId).catch(() => []),
		db.getMemberTierMap(serverId).catch((): TierMap => ({ staffRoleIds: [], adminRoleIds: [], tiers: {} })),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.content_creator).catch(() => null),
		db.getServerInviters(serverId).catch(() => [])
	]);
	const actor = panelActorOf(locals.user);
	const roleTier = (id: string) => (tierMap.adminRoleIds.includes(id) ? 'owner' : tierMap.staffRoleIds.includes(id) ? 'staff' : 'member');
	const ctx: RowContext = { actor, tierMap, inviterById: new Map(inviters.map((i) => [i.discord_member_id, i])), ...caseStanding(cases) };

	return {
		deniedReason: actor ? TIER_DENIED[actor] : 'Access denied',
		presets: moderationRulesFromSettings(mainSettings?.settings).reason_presets,
		rows: allMemberRows(members, inviters, ctx),
		groups: {
			staff: tierMap.staffRoleIds,
			admin: tierMap.adminRoleIds,
			creator: ((creatorSettings?.settings?.content_creator_roles ?? []) as unknown[]).map(String)
		},
		roles: roles
			.filter((r) => String(r.discord_role_id) !== String(overview.discord_server_id))
			.map((r) => ({
				id: String(r.discord_role_id),
				name: String(r.name),
				color: (r.color ?? null) as string | null,
				manageable: canActOn(actor, roleTier(String(r.discord_role_id)))
			}))
	};
};
