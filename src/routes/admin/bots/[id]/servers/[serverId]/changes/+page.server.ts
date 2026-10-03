import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer, SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

const PANEL_ACTIONS: Record<string, { component: string; label: string }> = {
	embed_sent: { component: 'embed_builder', label: 'Embed builder' },
	invite_bonus: { component: 'invites', label: 'Invites' },
	invite_assign: { component: 'invites', label: 'Invites' },
	moderation: { component: 'moderation', label: 'Moderation' },
	moderation_bulk: { component: 'moderation', label: 'Moderation' },
	moderation_rules: { component: 'moderation', label: 'Moderation' }
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');

	const serverId = Number(params.serverId);

	if (locals.user.account_source === 'server_accounts') {
		if (locals.user.server_id !== serverId) {
			const ob = await getOfficialBotIdForServer(locals.user.server_id);
			const fallback = locals.user.bot_id > 0 ? locals.user.bot_id : null;
			const targetBot = ob ?? fallback;
			if (targetBot != null) {
				redirect(302, adminServerSectionPath(targetBot, locals.user.server_id, 'changes'));
			}
			redirect(302, DASHBOARD_PATH);
		}
	} else if (!(await accountOwnsServer(locals, serverId))) {
		redirect(302, DASHBOARD_PATH);
	}

	const officialServerId = await db.getOfficialBotServerIdForServer(serverId).catch(() => null);
	const serverIds = [...new Set([serverId, ...(officialServerId != null ? [Number(officialServerId)] : [])])];
	const rows = await db.getServerPanelLogs(serverIds).catch(() => []);

	const parsed = (rows as any[]).map((r) => {
		let changes: { key: string; before: string | null; after: string | null }[] = [];
		try {
			changes = typeof r.changes === 'string' ? JSON.parse(r.changes) : (r.changes ?? []);
		} catch {
			changes = [];
		}
		const action = String(r.action);
		const meta = PANEL_ACTIONS[action] ?? { component: action, label: SERVER_SETTINGS.featureLabel(action) };
		return { r, id: String(r.id), component: meta.component, component_label: meta.label, changes };
	});

	const SNOWFLAKE = /\b\d{17,20}\b/g;
	const ids = new Set<string>();
	for (const { changes } of parsed) {
		for (const c of changes) {
			for (const v of [c.before, c.after]) for (const id of v?.match(SNOWFLAKE) ?? []) ids.add(id);
		}
	}

	const names = new Map<string, string>();
	if (ids.size > 0) {
		const lookups = await Promise.all(
			serverIds.map(async (sid) => {
				const [channels, roles, members] = await Promise.all([
					db.getChannelsForServer(sid).catch(() => []),
					db.getRoles(sid).catch(() => []),
					db.getMemberNamesByDiscordIds(sid, [...ids]).catch(() => [])
				]);
				return { channels, roles, members };
			})
		);
		for (const { channels, roles, members } of lookups) {
			for (const c of channels as any[]) if (ids.has(c.discord_channel_id) && c.name) names.set(c.discord_channel_id, `#${c.name}`);
			for (const r of roles as any[]) if (ids.has(r.discord_role_id) && r.name) names.set(r.discord_role_id, `@${r.name}`);
			for (const m of members as any[])
				if (!names.has(m.discord_member_id) && (m.username || m.name)) names.set(m.discord_member_id, `@${m.username || m.name}`);
		}
	}

	const resolve = (value: string | null) => (value ? value.replace(SNOWFLAKE, (id) => names.get(id) ?? id) : value);

	return {
		logs: parsed.map(({ r, id, component, component_label, changes: raw }) => {
			const changes = raw.map((c) => ({ key: c.key, before: resolve(c.before), after: resolve(c.after) }));
			const isPanelAdmin = r.account_id != null;
			return {
				id,
				component,
				component_label,
				created_at: r.created_at,
				who: (isPanelAdmin ? r.account_username : r.server_account_username) ?? null,
				role: isPanelAdmin ? 'Admin' : r.server_account_type === 'owner' ? 'Owner' : r.server_account_type === 'staff' ? 'Staff' : null,
				changes
			};
		})
	};
};
