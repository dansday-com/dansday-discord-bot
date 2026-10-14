import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { testWiki } from '$lib/frontend/wikis.server.js';
import { HTTP } from '$lib/http.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED });
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN });
	}

	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const result = await testWiki(body);
	if (!result.ok) {
		return json({ success: false, error: result.error }, { status: HTTP.BAD_REQUEST });
	}

	const { ok: isOk, ...site } = result;
	return json({ success: true, ...site });
};
