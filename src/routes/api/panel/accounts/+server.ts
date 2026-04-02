import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/server/db.js';

function requireSuperadmin(user: App.Locals['user']): Response | null {
	if (!user.authenticated || user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Superadmin access required' }, { status: 403 }) as unknown as Response;
	}
	return null;
}

export const GET: RequestHandler = async ({ locals }) => {
	const guard = requireSuperadmin(locals.user);
	if (guard) return guard;

	try {
		const accounts = await db.getAllAccounts();
		return json({ success: true, accounts });
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
