import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';
import { WIKI_USER_AGENT } from '$lib/backend/bots/official-bot/components/wiki.js';

const TIMEOUT_MS = 12_000;
const MAX_DESCRIPTION_LENGTH = 255;

type AskWiki = (query: Record<string, string>) => Promise<Response>;

async function summarizeWiki(askWiki: AskWiki, general: Record<string, any>): Promise<string | null> {
	const mainpage = typeof general?.mainpage === 'string' ? general.mainpage.trim() : '';
	if (!mainpage) return null;

	try {
		const res = await askWiki({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', titles: mainpage });
		if (!res.ok) return null;

		const data = await res.json();
		const extract = data?.query?.pages?.[0]?.extract;
		if (typeof extract !== 'string') return null;

		const summary = extract.replace(/\s+/g, ' ').trim();
		if (summary.length <= MAX_DESCRIPTION_LENGTH) return summary || null;

		const cut = summary.slice(0, MAX_DESCRIPTION_LENGTH);
		const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '));
		return (stop > MAX_DESCRIPTION_LENGTH * 0.5 ? cut.slice(0, stop) : cut).trim() || null;
	} catch (_) {
		return null;
	}
}

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

	const relayUrl = String(body.relay_url ?? '').trim();
	const relayKey = String(body.relay_key ?? '').trim();

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

	const askWiki = (query: Record<string, string>) => {
		const url = new URL(apiUrl);
		for (const [key, value] of Object.entries({ ...query, format: 'json', formatversion: '2' })) {
			url.searchParams.set(key, value);
		}

		return relayUrl
			? fetch(relayUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'User-Agent': WIKI_USER_AGENT,
						...(relayKey ? { 'X-Relay-Key': relayKey } : {})
					},
					body: JSON.stringify({ url: url.toString() }),
					signal: controller.signal
				})
			: fetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
	};

	try {
		const res = await askWiki({ action: 'query', meta: 'siteinfo' });

		if (!res.ok) {
			const blocked = res.status === 403 || res.status === 429;
			const error = relayUrl
				? `The relay returned HTTP ${res.status}. Check the relay URL and key, and that the wiki's host is in the relay's allowlist.`
				: blocked
					? `The wiki refused the request (HTTP ${res.status}). It is not your URL — the wiki is blocking this server's IP, which hosts like Miraheze and Fandom often do behind Cloudflare. Add a relay URL, or contact the wiki about allowing your server.`
					: `The wiki responded with HTTP ${res.status}`;
			return json({ success: false, error }, { status: 400 });
		}

		const data = await res.json();
		if (data?.relay_error) {
			return json({ success: false, error: `Relay refused the request: ${data.relay_error}` }, { status: 400 });
		}

		const general = data?.query?.general;
		if (!general?.sitename) {
			return json({ success: false, error: 'That URL answered, but it is not a MediaWiki api.php endpoint' }, { status: 400 });
		}

		return json({
			success: true,
			sitename: general.sitename,
			generator: general.generator ?? null,
			site_url: general.base ?? null,
			description: await summarizeWiki(askWiki, general),
			via_relay: Boolean(relayUrl)
		});
	} catch (error: any) {
		const reason = error?.name === 'AbortError' ? 'The wiki did not respond in time' : 'Could not reach that wiki';
		return json({ success: false, error: reason }, { status: 400 });
	} finally {
		clearTimeout(timer);
	}
};
