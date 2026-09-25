import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { logger } from '$lib/utils/index.js';

function panelIdFor(locals: App.Locals): number | null {
	if (!locals.user.authenticated) return null;
	if (locals.user.account_source !== 'accounts') return null;
	return locals.user.panel_id ?? null;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const panelId = panelIdFor(locals);
	if (panelId == null) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const body = await request.json();
	if (typeof body.auto_quest !== 'boolean') {
		return json({ success: false, error: 'auto_quest must be a boolean' }, { status: 400 });
	}

	const existing = await db.getPanelSettings(panelId, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const raw = existing?.settings;
	const current = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

	await db.upsertPanelSettings(panelId, SERVER_SETTINGS.component.discord_quest_notifier, { ...current, auto_quest: body.auto_quest });

	if (locals.user.authenticated) {
		logger.log(`${locals.user.username} set auto quest enrollment to ${body.auto_quest} for panel ${panelId}`);
	}
	return json({ success: true, auto_quest: body.auto_quest });
};
