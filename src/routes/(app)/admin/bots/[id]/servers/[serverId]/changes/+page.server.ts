import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db, { getOfficialBotIdForServer } from '$lib/database.js';
import { DASHBOARD_PATH, adminServerSectionPath } from '$lib/frontend/redirect.js';
import { accountOwnsServer, SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { attemptSync } from '$lib/utils/attempt.js';
import { HTTP } from '$lib/http.js';

const PANEL_LOG_LIMIT = 1000;

const PANEL_ACTIONS: Record<string, { component: string; label: string }> = {
	embed_sent: { component: 'messages', label: 'Messages' },
	message_saved: { component: 'messages', label: 'Messages' },
	message_sent: { component: 'messages', label: 'Messages' },
	message_deleted: { component: 'messages', label: 'Messages' },
	message_post_removed: { component: 'messages', label: 'Messages' },
	message_post_updated: { component: 'messages', label: 'Messages' },
	account_invite: { component: 'accounts', label: 'Accounts' },
	invite_bonus: { component: 'invites', label: 'Invites' },
	invite_assign: { component: 'invites', label: 'Invites' },
	moderation: { component: 'moderation', label: 'Moderation' },
	moderation_bulk: { component: 'moderation', label: 'Moderation' },
	moderation_rules: { component: 'moderation', label: 'Moderation' },
	rewards: { component: 'rewards', label: 'Rewards' }
};

type LogRow = Awaited<ReturnType<typeof db.getServerPanelLogs>>[number];
type Change = { key: string; before: string | null; after: string | null };
type ParsedLog = { r: LogRow; id: string; component: string; component_label: string; changes: Change[] };

const SNOWFLAKE = /\b\d{17,20}\b/g;

async function ensureChangesAccess(locals: App.Locals, serverId: number) {
	if (!locals.user.authenticated) {
		redirect(HTTP.FOUND, '/login');
	}
	if (locals.user.account_source !== 'server_accounts') {
		if (!(await accountOwnsServer(locals, serverId))) {
			redirect(HTTP.FOUND, DASHBOARD_PATH);
		}
		return;
	}
	if (locals.user.server_id === serverId) {
		return;
	}
	const ob = await getOfficialBotIdForServer(locals.user.server_id);
	const targetBot = ob ?? (locals.user.bot_id > 0 ? locals.user.bot_id : null);
	if (targetBot != null) {
		redirect(HTTP.FOUND, adminServerSectionPath(targetBot, locals.user.server_id, 'changes'));
	}
	redirect(HTTP.FOUND, DASHBOARD_PATH);
}

function parseLog(r: LogRow): ParsedLog {
	const changes = attemptSync(() => (typeof r.changes === 'string' ? JSON.parse(r.changes) : (r.changes ?? [])));
	const action = String(r.action);
	const meta = PANEL_ACTIONS[action] ?? { component: action, label: SERVER_SETTINGS.featureLabel(action) };
	return { r, id: String(r.id), component: meta.component, component_label: meta.label, changes: changes.ok ? (changes.value as Change[]) : [] };
}

function snowflakesIn(parsed: ParsedLog[]) {
	const ids = new Set<string>();
	for (const value of parsed.flatMap(({ changes }) => changes.flatMap((c) => [c.before, c.after]))) {
		for (const id of value?.match(SNOWFLAKE) ?? []) {
			ids.add(id);
		}
	}
	return ids;
}

async function snowflakeNames(serverIds: number[], ids: Set<string>) {
	const names = new Map<string, string>();
	if (ids.size === 0) {
		return names;
	}
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
		channels.filter((c) => ids.has(c.discord_channel_id) && c.name).forEach((c) => names.set(c.discord_channel_id, `#${c.name}`));
		roles.filter((r) => ids.has(r.discord_role_id) && r.name).forEach((r) => names.set(r.discord_role_id, `@${r.name}`));
		members.filter((m) => !names.has(m.discord_member_id) && (m.username || m.name)).forEach((m) => names.set(m.discord_member_id, `@${m.username || m.name}`));
	}
	return names;
}

function logEntry({ r, id, component, component_label, changes }: ParsedLog, resolve: (value: string | null) => string | null) {
	const isPanelAdmin = r.account_id != null;
	return {
		id,
		component,
		component_label,
		created_at: r.created_at,
		who: (isPanelAdmin ? r.account_username : r.server_account_username) ?? null,
		role: isPanelAdmin ? 'Admin' : r.server_account_type === 'owner' ? 'Owner' : r.server_account_type === 'staff' ? 'Staff' : null,
		changes: changes.map((c) => ({ key: c.key, before: resolve(c.before), after: resolve(c.after) }))
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const serverId = Number(params.serverId);
	await ensureChangesAccess(locals, serverId);

	const officialServerId = await db.getOfficialBotServerIdForServer(serverId).catch(() => null);
	const serverIds = [...new Set([serverId, ...(officialServerId != null ? [Number(officialServerId)] : [])])];
	const parsed = (await db.getServerPanelLogs(serverIds, PANEL_LOG_LIMIT).catch(() => [])).map(parseLog);
	const names = await snowflakeNames(serverIds, snowflakesIn(parsed));
	const resolve = (value: string | null) => (value ? value.replace(SNOWFLAKE, (id) => names.get(id) ?? id) : value);

	return { logs: parsed.map((log) => logEntry(log, resolve)) };
};
