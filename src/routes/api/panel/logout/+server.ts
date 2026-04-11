import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { destroySession, clearSessionCookie, logger, getClientIp, getSession } from '$lib/utils/index.js';
import { cleanupDemoSession } from '$lib/backend/demo/seedDemo.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.sessionId;
	const user = locals.user;

	const session = sessionId ? await getSession(sessionId).catch(() => null) : null;

	if (sessionId) {
		await destroySession(sessionId);
	}

	if (user.authenticated) {
		try {
			const account = await db.getAccountById(user.account_id);
			if (account) {
				logger.log(`Logged out: ${account.username} (IP: ${getClientIp(request)})`);
			}
		} catch (_) {}
	}

	if (user.authenticated && user.is_demo === true) {
		const demoPanelSlug = session?.demo_panel_slug;
		if (demoPanelSlug) {
			try {
				await cleanupDemoSession(demoPanelSlug);
			} catch (_) {}
		}
	}

	return json({ success: true, message: 'Logged out successfully' }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
