import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { destroySession, clearSessionCookie } from '$lib/server/session.js';
import logger from '$lib/server/logger.js';
import db from '$lib/server/db.js';
import { getClientIp } from '$lib/server/rateLimit.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.sessionId;
	const user = locals.user;

	if (sessionId) {
		await destroySession(sessionId);
	}

	if (user.authenticated) {
		try {
			const account = await db.getPanelAccountById(user.account_id);
			if (account) {
				logger.log(`Logged out: ${account.username} (IP: ${getClientIp(request)})`);
			}
		} catch (_) {}
	}

	return json({ success: true, message: 'Logged out successfully' }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
