import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS, canEditServerSettings } from '$lib/frontend/panelServer.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { MODERATION_RULE_KEYS, moderationRulesFromSettings } from '$lib/moderation-rules.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) return json({ ok: false, error: 'Authentication required' }, { status: 401 });
	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) return json({ ok: false, error: 'Invalid server ID' }, { status: 400 });
	if (!(await canEditServerSettings(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json().catch(() => null);
	const rules = moderationRulesFromSettings({
		[MODERATION_RULE_KEYS.warn_expiry_days]: body?.warn_expiry_days,
		[MODERATION_RULE_KEYS.escalation]: body?.escalation,
		[MODERATION_RULE_KEYS.reason_presets]: body?.reason_presets
	});

	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
	const existing = row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};
	const previous = moderationRulesFromSettings(existing);
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.main, {
		...existing,
		[MODERATION_RULE_KEYS.warn_expiry_days]: rules.warn_expiry_days,
		[MODERATION_RULE_KEYS.escalation]: rules.escalation,
		[MODERATION_RULE_KEYS.reason_presets]: rules.reason_presets
	});

	const changes = (Object.keys(MODERATION_RULE_KEYS) as (keyof typeof MODERATION_RULE_KEYS)[])
		.filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(rules[key]))
		.map((key) => ({ key: MODERATION_RULE_KEYS[key], before: JSON.stringify(previous[key]), after: JSON.stringify(rules[key]) }));
	if (changes.length > 0) await db.createServerPanelLog(serverId, panelActorIds(locals), 'moderation_rules', changes).catch(() => null);

	return json({ ok: true, rules });
};
