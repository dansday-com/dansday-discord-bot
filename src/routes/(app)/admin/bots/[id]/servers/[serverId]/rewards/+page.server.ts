import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { SERVER_SETTINGS, accountOwnsServer, canEditServerSettings } from '$lib/frontend/panelServer.js';
import { DEFAULT_LEVELING_SETTINGS } from '$lib/backend/config.js';
import { levelRewardsFromSettings } from '$lib/level-rewards.js';

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
	const [mainSettings, levelingSettings, roles, levels, canEdit] = await Promise.all([
		db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null),
		db.getServerSettings(serverId, SERVER_SETTINGS.component.leveling).catch(() => null),
		db.getRoles(serverId).catch(() => []),
		db.getMemberLevelsForServer(serverId).catch(() => []),
		canEditServerSettings(locals, serverId)
	]);
	const leveling = (levelingSettings as any)?.settings ?? {};
	const req = leveling.REQUIREMENTS ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS;
	const levelCounts = new Map<number, number>();
	for (const m of levels) levelCounts.set(m.level, (levelCounts.get(m.level) ?? 0) + 1);

	return {
		serverId,
		canEdit,
		levelingEnabled: leveling.enabled === true,
		levelReq: {
			baseXp: Number(req.BASE_XP) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.BASE_XP,
			multiplier: Number(req.MULTIPLIER) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.MULTIPLIER
		},
		rules: levelRewardsFromSettings((mainSettings as any)?.settings),
		levelCounts: [...levelCounts.entries()].sort((a, b) => a[0] - b[0]),
		roles: (roles as any[])
			.filter((r) => String(r.discord_role_id) !== String((overview as any).discord_server_id))
			.map((r) => ({ id: String(r.discord_role_id), name: String(r.name ?? 'Unnamed role'), color: r.color ?? null }))
	};
};
