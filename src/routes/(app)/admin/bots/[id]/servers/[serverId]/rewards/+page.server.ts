import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { SERVER_SETTINGS, accountOwnsServer, canEditServerSettings } from '$lib/frontend/panelServer.js';
import { DEFAULT_LEVELING_SETTINGS } from '$lib/backend/config.js';
import { rewardGoalUnits, rewardProgress, rewardRuleFlags } from '$lib/rewards.js';
import { rewardImageUrl } from '$lib/backend/storage/rewards.js';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'rewards'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const { overview } = await parent();
	const [mainSettings, levelingSettings, roles, rewards, winners, progress, pending, canEdit] = await Promise.all([
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.leveling).catch(() => null),
		db.getRoles(serverId).catch(() => []),
		db.getRewards(serverId).catch(() => []),
		db.getRewardWinnerCounts(serverId).catch(() => new Map<number, number>()),
		db.getRewardProgressForServer(serverId).catch(() => []),
		db.getPendingRewardDeliveries(serverId).catch(() => []),
		canEditServerSettings(locals, serverId)
	]);
	const leveling = (levelingSettings as any)?.settings ?? {};
	const req = leveling.REQUIREMENTS ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS;
	const memberProgress = progress.map((m) => rewardProgress(m.stats));

	return {
		serverId,
		canEdit,
		levelingEnabled: leveling.enabled === true,
		levelReq: {
			baseXp: Number(req.BASE_XP) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.BASE_XP,
			multiplier: Number(req.MULTIPLIER) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.MULTIPLIER
		},
		rules: rewardRuleFlags((mainSettings as any)?.settings),
		rewards: rewards.map((r) => ({
			id: r.id,
			goal_type: r.goal_type,
			units: rewardGoalUnits(r),
			kind: r.kind,
			role_id: r.role_id ?? '',
			xp: r.xp,
			name: r.name ?? '',
			image: r.image,
			image_url: rewardImageUrl(r.image),
			winner_limit: r.winner_limit,
			winners: winners.get(r.id) ?? 0,
			reached: memberProgress.reduce((n, m) => (m[r.goal_type] >= r.goal ? n + 1 : n), 0)
		})),
		pending: pending.map((p) => ({ ...p, image_url: rewardImageUrl(p.image), earned_at: p.earned_at ? String(p.earned_at) : null })),
		roles: (roles as any[])
			.filter((r) => String(r.discord_role_id) !== String((overview as any).discord_server_id))
			.map((r) => ({ id: String(r.discord_role_id), name: String(r.name ?? 'Unnamed role'), color: r.color ?? null }))
	};
};
