import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { testWiki } from '$lib/frontend/wikis.server.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const result = await testWiki(body);
	if (!result.ok) return json({ success: false, error: result.error }, { status: 400 });

	const { ok, ...site } = result;
	return json({ success: true, ...site });
};
