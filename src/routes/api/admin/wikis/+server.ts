import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { parseWikiInput } from '$lib/frontend/wikis.server.js';
import { HTTP } from '$lib/http.js';

function authorize(locals: App.Locals) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: HTTP.UNAUTHORIZED }) };
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return { error: json({ success: false, error: 'Access denied' }, { status: HTTP.FORBIDDEN }) };
	}

	const panelId = Number(locals.user.panel_id);
	if (!Number.isFinite(panelId) || panelId <= 0) {
		return { error: json({ success: false, error: 'No panel available' }, { status: HTTP.NOT_FOUND }) };
	}

	return { panelId };
}

export const GET: RequestHandler = async ({ locals }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}

	return json({ wikis: await db.getWikis(auth.panelId!) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}
	const panelId = auth.panelId!;

	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const parsed = parseWikiInput(body);
	if ('error' in parsed) {
		return json({ success: false, error: parsed.error }, { status: HTTP.BAD_REQUEST });
	}

	const existing = await db.getWikis(panelId);
	if (existing.some((wiki) => wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: HTTP.BAD_REQUEST });
	}

	return json({ success: true, wiki: await db.createWiki(panelId, parsed.value) });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}
	const panelId = auth.panelId!;

	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) {
		return json({ success: false, error: 'Invalid wiki id' }, { status: HTTP.BAD_REQUEST });
	}

	const current = await db.getWiki(panelId, wikiId);
	if (!current) {
		return json({ success: false, error: 'Wiki not found' }, { status: HTTP.NOT_FOUND });
	}

	const parsed = parseWikiInput(body);
	if ('error' in parsed) {
		return json({ success: false, error: parsed.error }, { status: HTTP.BAD_REQUEST });
	}

	const existing = await db.getWikis(panelId);
	if (existing.some((wiki) => wiki.id !== wikiId && wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: HTTP.BAD_REQUEST });
	}

	return json({ success: true, wiki: await db.updateWiki(panelId, wikiId, parsed.value) });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) {
		return auth.error;
	}

	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body) {
		return json({ success: false, error: 'Invalid JSON' }, { status: HTTP.BAD_REQUEST });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) {
		return json({ success: false, error: 'Invalid wiki id' }, { status: HTTP.BAD_REQUEST });
	}

	const current = await db.getWiki(auth.panelId!, wikiId);
	if (!current) {
		return json({ success: false, error: 'Wiki not found' }, { status: HTTP.NOT_FOUND });
	}

	await db.deleteWiki(auth.panelId!, wikiId);
	return json({ success: true });
};
