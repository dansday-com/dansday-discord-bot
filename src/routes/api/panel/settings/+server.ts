import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { setAutoQuest } from '$lib/frontend/panelSettings.server.js';
import { logger } from '$lib/utils/index.js';
import { HTTP, readJsonObject } from '$lib/http.js';

function panelIdFor(locals: App.Locals): number | null {
	if (!locals.user.authenticated) {
		return null;
	}
	if (locals.user.account_source !== 'accounts') {
		return null;
	}
	return locals.user.panel_id ?? null;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const panelId = panelIdFor(locals);
	if (panelId == null) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const { auto_quest: isAutoQuest } = await readJsonObject(request);
	if (typeof isAutoQuest !== 'boolean') {
		return json({ success: false, error: 'auto_quest must be a boolean' }, { status: HTTP.BAD_REQUEST });
	}

	await setAutoQuest(panelId, isAutoQuest);

	if (locals.user.authenticated) {
		logger.log(`${locals.user.username} set auto quest enrollment to ${isAutoQuest} for panel ${panelId}`);
	}
	return json({ success: true, auto_quest: isAutoQuest });
};
