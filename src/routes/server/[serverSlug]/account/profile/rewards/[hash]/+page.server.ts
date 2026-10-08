import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { apexHome } from '$lib/url.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { rewardGoalLabel, rewardProgress, rewardRuleFlags, rewardStates } from '$lib/rewards.js';
import { rewardImageUrl } from '$lib/backend/storage/rewards.js';

async function loadRewards(serverId: number, memberId: number) {
	const [main, roles, held, rewards, earnings, winners, stats] = await Promise.all([
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getRoles(serverId).catch(() => []),
		db.getMemberDiscordRoleIds(memberId).catch(() => [] as string[]),
		db.getRewards(serverId),
		db.getMemberRewardEarnings(memberId),
		db.getRewardWinnerCounts(serverId),
		db.getMemberLevel(memberId).catch(() => null)
	]);
	const roleById = new Map((roles as any[]).map((r) => [String(r.discord_role_id), r]));
	const rules = { rewards, ...rewardRuleFlags((main as any)?.settings) };
	const progress = rewardProgress(stats as any);
	const states = rewardStates(rules, progress, held, earnings, winners);
	return {
		keep: rules.keep,
		stack: rules.stack,
		items: rewards.map((r) => {
			const role = r.role_id ? roleById.get(r.role_id) : null;
			const state = states.get(r.id) ?? 'locked';
			return {
				id: r.id,
				goal_type: r.goal_type,
				goal: r.goal,
				goal_label: rewardGoalLabel(r),
				kind: r.kind,
				name: r.kind === 'role' ? String(role?.name ?? 'Role') : r.kind === 'xp' ? `${r.xp.toLocaleString()} XP` : String(r.name ?? 'Reward'),
				color: role?.color && role.color !== '#000000' ? String(role.color) : null,
				image: rewardImageUrl(r.image),
				state,
				reached: state === 'earned' || state === 'delivered' || state === 'replaced',
				current: Math.min(progress[r.goal_type], r.goal),
				limit: r.winner_limit,
				left: r.winner_limit !== null ? Math.max(0, r.winner_limit - (winners.get(r.id) ?? 0)) : null
			};
		})
	};
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, serverBasePath } = await parent();

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, apexHome());
	if ('guest' in shared || !shared.member) redirect(303, serverBasePath || '/');

	const leveling = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const levelingEnabled = (leveling as any)?.settings?.enabled === true;
	const rewards = levelingEnabled ? await loadRewards(Number(server.id), Number(shared.member.id)).catch(() => null) : null;

	return { ...shared, levelingEnabled, rewards };
};
