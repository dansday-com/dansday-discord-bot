import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger, attempt } from '$lib/utils/index.js';
import { HTTP } from '$lib/http.js';

function panelIdFor(locals: App.Locals): number | null {
	if (!locals.user.authenticated) {
		return null;
	}
	if (locals.user.account_source !== 'accounts') {
		return null;
	}
	return locals.user.panel_id ?? null;
}

export const GET: RequestHandler = async ({ locals }) => {
	const panelId = panelIdFor(locals);
	if (panelId == null) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const rows = await db.getPanelSelfbots(panelId);
	return json({
		success: true,
		selfbots: rows.map((sb) => ({ id: sb.id, name: sb.name, bot_icon: sb.bot_icon, status: sb.status }))
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const panelId = panelIdFor(locals);
	if (panelId == null) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body = await request.json();
	const token = typeof body.token === 'string' ? body.token.trim() : '';
	if (!token) {
		return json({ success: false, error: 'token required' }, { status: HTTP.BAD_REQUEST });
	}

	const idResult = await attempt(() => db.addSelfbot({ panel_id: panelId, name: 'Selfbot', token }));
	if (!idResult.ok) {
		logger.error(`Failed to add selfbot for panel ${panelId}: ${(idResult.error as Error)?.message ?? idResult.error}`);
		return json({ success: false, error: 'Failed to add selfbot' }, { status: HTTP.INTERNAL_ERROR });
	}
	const id = idResult.value;

	if (locals.user.authenticated) {
		logger.log(`${locals.user.username} created selfbot (ID: ${id}) for panel ${panelId}`);
	}
	return json({ success: true, id });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const panelId = panelIdFor(locals);
	if (panelId == null) {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body = await request.json();
	const selfbotId = Number(body.selfbot_id);
	if (!selfbotId) {
		return json({ success: false, error: 'selfbot_id required' }, { status: HTTP.BAD_REQUEST });
	}

	const selfbot = await db.getSelfbotById(selfbotId);
	if (!selfbot || selfbot.panel_id !== panelId) {
		return json({ success: false, error: 'Selfbot not found' }, { status: HTTP.NOT_FOUND });
	}

	await db.removeSelfbot(selfbotId);
	if (locals.user.authenticated) {
		logger.log(`${locals.user.username} deleted selfbot "${selfbot.name}" (ID: ${selfbotId}) from panel ${panelId}`);
	}
	return json({ success: true });
};
