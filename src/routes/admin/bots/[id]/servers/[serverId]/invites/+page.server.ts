import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer } from '$lib/frontend/panelServer.js';
import { TIER_DENIED, canActOn, panelActorOf } from '$lib/panelHierarchy.js';

const CODE_LIMIT = 100;
const JOIN_LIMIT = 300;

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'invites'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const [stats, inviters, joins, tierMap] = await Promise.all([
		db.getServerInviteStats(serverId, CODE_LIMIT).catch(() => null),
		db.getServerInviters(serverId).catch(() => []),
		db.getServerInviteJoins(serverId, JOIN_LIMIT).catch(() => []),
		db.getMemberTierMap(serverId).catch(() => ({ tiers: {} as Record<string, any> }))
	]);
	const actor = panelActorOf(locals.user);

	return {
		serverId,
		stats,
		inviters,
		joins: (joins as any[]).map((j) => ({
			id: String(j.id),
			discord_member_id: String(j.discord_member_id),
			name: j.name ?? null,
			avatar: j.avatar ?? null,
			inviter_discord_id: j.inviter_discord_id ? String(j.inviter_discord_id) : null,
			inviter_name: j.inviter_name ?? null,
			code: j.code ?? null,
			source: String(j.source ?? 'unknown'),
			fake_reason: j.fake_reason ?? null,
			status: String(j.status),
			xp: Number(j.xp) || 0,
			joined_at: j.joined_at ?? j.created_at
		})),
		joinLimit: JOIN_LIMIT,
		lockedIds: Object.entries(tierMap.tiers)
			.filter(([, tier]) => !canActOn(actor, tier))
			.map(([id]) => id),
		deniedReason: actor ? TIER_DENIED[actor] : 'Access denied'
	};
};
