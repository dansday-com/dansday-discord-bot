import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { isServerConfigReadOnly } from '$lib/serverPanelAccess.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source !== 'accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, `/bots/${targetBot}/servers/${locals.user.server_id}`);
			}
			redirect(302, '/');
		}
		const canonical = await getOfficialBotIdForServer(serverId);
		if (canonical != null && Number(params.id) !== canonical) {
			redirect(302, `/bots/${canonical}/servers/${serverId}`);
		}
	}

	const [channels, roles, categories] = await Promise.all([
		db.getChannelsForServer(params.serverId),
		db.getRoles(params.serverId),
		db.getCategoriesForServer(params.serverId)
	]);

	async function settingsRowServerId(panelServerId: string, component: string): Promise<string> {
		if (component === SERVER_SETTINGS.component.notifications) {
			const alt = await db.getOfficialBotServerIdForServer(panelServerId);
			return alt != null ? String(alt) : panelServerId;
		}
		return panelServerId;
	}

	const featureEnabledEntries = await Promise.all(
		SERVER_SETTINGS.withFeatureSwitch.map(async (c) => {
			const sid = await settingsRowServerId(params.serverId, c);
			const row = await db.getServerSettings(sid, c).catch(() => null);
			const raw = row?.settings;
			let on = true;
			if (raw && typeof raw === 'object') {
				on = (raw as Record<string, unknown>).enabled !== false;
			}
			return [c, on] as const;
		})
	);

	return {
		channels: channels ?? [],
		roles: roles ?? [],
		categories: categories ?? [],
		featureEnabledByComponent: Object.fromEntries(featureEnabledEntries) as Record<string, boolean>,
		configReadOnly: isServerConfigReadOnly(locals)
	};
};
