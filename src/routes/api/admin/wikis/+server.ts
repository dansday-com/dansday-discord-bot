import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db, { type WikiInput } from '$lib/database.js';

const MAX_NAME_LENGTH = 64;
const MAX_URL_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 255;

function authorize(locals: App.Locals) {
	if (!locals.user.authenticated) {
		return { error: json({ success: false, error: 'Authentication required' }, { status: 401 }) };
	}

	if (locals.user.account_source !== 'accounts' || locals.user.account_type !== 'superadmin') {
		return { error: json({ success: false, error: 'Access denied' }, { status: 403 }) };
	}

	const panelId = Number(locals.user.panel_id);
	if (!Number.isFinite(panelId) || panelId <= 0) {
		return { error: json({ success: false, error: 'No panel available' }, { status: 404 }) };
	}

	return { panelId };
}

function parseBody(body: Record<string, unknown>): { error: string } | { value: WikiInput } {
	const name = String(body.name ?? '').trim();
	const api_url = String(body.api_url ?? '').trim();
	const site_url = String(body.site_url ?? '').trim();
	const relay_url = String(body.relay_url ?? '').trim();
	const relay_key = String(body.relay_key ?? '').trim();
	const description = String(body.description ?? '').trim();

	if (!name) return { error: 'Wiki name is required' };
	if (name.length > MAX_NAME_LENGTH) return { error: `Wiki name must be at most ${MAX_NAME_LENGTH} characters` };
	if (!api_url) return { error: 'API URL is required' };
	if (api_url.length > MAX_URL_LENGTH) return { error: `API URL must be at most ${MAX_URL_LENGTH} characters` };
	if (!/^https?:\/\//i.test(api_url)) return { error: 'API URL must start with http:// or https://' };
	if (!/api\.php/i.test(api_url)) return { error: 'API URL must point at the MediaWiki api.php endpoint, e.g. https://fischipedia.org/w/api.php' };
	if (site_url && !/^https?:\/\//i.test(site_url)) return { error: 'Site URL must start with http:// or https://' };
	if (site_url.length > MAX_URL_LENGTH) return { error: `Site URL must be at most ${MAX_URL_LENGTH} characters` };
	if (relay_url && !/^https?:\/\//i.test(relay_url)) return { error: 'Relay URL must start with http:// or https://' };
	if (relay_url.length > MAX_URL_LENGTH) return { error: `Relay URL must be at most ${MAX_URL_LENGTH} characters` };
	if (relay_url && !relay_key) return { error: 'A relay key is required when using a relay URL' };
	if (relay_key.length > 191) return { error: 'Relay key must be at most 191 characters' };
	if (description.length > MAX_DESCRIPTION_LENGTH) return { error: `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters` };

	return {
		value: {
			enabled: body.enabled !== false,
			name,
			api_url,
			site_url: site_url || null,
			relay_url: relay_url || null,
			relay_key: relay_key || null,
			description: description || null
		}
	};
}

export const GET: RequestHandler = async ({ locals }) => {
	const auth = authorize(locals);
	if (auth.error) return auth.error;

	return json({ wikis: await db.getWikis(auth.panelId!) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) return auth.error;
	const panelId = auth.panelId!;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = parseBody(body);
	if ('error' in parsed) return json({ success: false, error: parsed.error }, { status: 400 });

	const existing = await db.getWikis(panelId);
	if (existing.some((wiki) => wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: 400 });
	}

	return json({ success: true, wiki: await db.createWiki(panelId, parsed.value) });
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) return auth.error;
	const panelId = auth.panelId!;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) return json({ success: false, error: 'Invalid wiki id' }, { status: 400 });

	const current = await db.getWiki(panelId, wikiId);
	if (!current) return json({ success: false, error: 'Wiki not found' }, { status: 404 });

	const parsed = parseBody(body);
	if ('error' in parsed) return json({ success: false, error: parsed.error }, { status: 400 });

	const existing = await db.getWikis(panelId);
	if (existing.some((wiki) => wiki.id !== wikiId && wiki.name.toLowerCase() === parsed.value.name.toLowerCase())) {
		return json({ success: false, error: 'A wiki with that name already exists' }, { status: 400 });
	}

	return json({ success: true, wiki: await db.updateWiki(panelId, wikiId, parsed.value) });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const auth = authorize(locals);
	if (auth.error) return auth.error;

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const wikiId = Number(body.id);
	if (!Number.isFinite(wikiId)) return json({ success: false, error: 'Invalid wiki id' }, { status: 400 });

	const current = await db.getWiki(auth.panelId!, wikiId);
	if (!current) return json({ success: false, error: 'Wiki not found' }, { status: 404 });

	await db.deleteWiki(auth.panelId!, wikiId);
	return json({ success: true });
};
