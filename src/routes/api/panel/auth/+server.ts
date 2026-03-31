import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (user.authenticated) {
		return json({
			authenticated: true,
			account_type: user.account_type,
			account_id: user.account_id,
			username: user.username,
			email: user.email
		});
	}

	try {
		const panel = await db.getPanel();
		return json({ authenticated: false, can_register: !panel });
	} catch (_) {
		return json({ authenticated: false, can_register: false });
	}
};
