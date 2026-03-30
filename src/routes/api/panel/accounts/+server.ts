import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

function requireAdmin(user: App.Locals['user']): Response | null {
	if (!user.authenticated || user.account_type !== 'admin') {
		return json({ success: false, error: 'Admin access required' }, { status: 403 }) as unknown as Response;
	}
	return null;
}

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireAdmin(locals.user);
	if (guard) return guard;

	try {
		const accounts = await db.getAllPanelAccounts();
		return json({ success: true, accounts });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
