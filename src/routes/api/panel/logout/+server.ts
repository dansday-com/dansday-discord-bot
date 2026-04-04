import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { destroySession, clearSessionCookie, logger, getClientIp } from '$lib/utils/index.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const sessionId = locals.sessionId;
	const user = locals.user;

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

	return json({ success: true, message: 'Logged out successfully' }, { headers: { 'Set-Cookie': clearSessionCookie() } });
};
