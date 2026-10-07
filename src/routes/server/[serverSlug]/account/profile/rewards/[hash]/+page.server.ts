import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { apexHome } from '$lib/url.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { rewardsFromSettings, rewardEffectiveLevel, rewardTargetRoleIds } from '$lib/rewards.js';

async function loadRewards(serverId: number, memberId: number, level: number) {
	const [main, roles, held] = await Promise.all([
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getRoles(serverId).catch(() => []),
		db.getMemberDiscordRoleIds(memberId).catch(() => [] as string[])
	]);
	const roleById = new Map((roles as any[]).map((r) => [String(r.discord_role_id), r]));
	const saved = rewardsFromSettings((main as any)?.settings);
	const rules = { ...saved, rewards: saved.rewards.filter((r) => roleById.has(r.role_id)) };
	const effective = rewardEffectiveLevel(rules, level, held);
	const worn = rewardTargetRoleIds(rules, effective);
	return {
		keep: rules.keep,
		stack: rules.stack,
		items: rules.rewards.map((r) => {
			const role = roleById.get(r.role_id);
			return {
				level: r.level,
				name: String(role?.name ?? 'Role'),
				color: role?.color && role.color !== '#000000' ? String(role.color) : null,
				reached: r.level <= effective,
				worn: worn.has(r.role_id)
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
	const rewards = levelingEnabled ? await loadRewards(Number(server.id), Number(shared.member.id), shared.balance.level).catch(() => null) : null;

	return { ...shared, levelingEnabled, rewards };
};
