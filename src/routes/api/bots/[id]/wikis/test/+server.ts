import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const TIMEOUT_MS = 12_000;

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const botId = Number(params.id);
	if (!Number.isFinite(botId) || !(await db.getBot(botId))) {
		return json({ success: false, error: 'Bot not found' }, { status: 404 });
	}
	if (!(await accountOwnsBot(locals, botId))) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
	}

	const apiUrl = String(body.api_url ?? '').trim();
	if (!/^https?:\/\//i.test(apiUrl)) {
		return json({ success: false, error: 'API URL must start with http:// or https://' }, { status: 400 });
	}

	const url = new URL(apiUrl);
	url.searchParams.set('action', 'query');
	url.searchParams.set('meta', 'siteinfo');
	url.searchParams.set('format', 'json');
	url.searchParams.set('formatversion', '2');

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const res = await fetch(url, { headers: { 'User-Agent': 'DansdayBot/1.0', Accept: 'application/json' }, signal: controller.signal });
		if (!res.ok) {
			return json({ success: false, error: `The wiki responded with HTTP ${res.status}` }, { status: 400 });
		}

		const data = await res.json();
		const general = data?.query?.general;
		if (!general?.sitename) {
			return json({ success: false, error: 'That URL answered, but it is not a MediaWiki api.php endpoint' }, { status: 400 });
		}

		return json({ success: true, sitename: general.sitename, generator: general.generator ?? null, site_url: general.base ?? null });
	} catch (error: any) {
		const reason = error?.name === 'AbortError' ? 'The wiki did not respond in time' : 'Could not reach that wiki';
		return json({ success: false, error: reason }, { status: 400 });
	} finally {
		clearTimeout(timer);
	}
};
