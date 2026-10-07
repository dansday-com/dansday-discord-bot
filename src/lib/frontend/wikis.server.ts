import type { WikiInput } from '$lib/database.js';
import { WIKI_USER_AGENT } from '$lib/backend/bots/official-bot/components/wiki.js';

const MAX_NAME_LENGTH = 64;
const MAX_URL_LENGTH = 512;
const MAX_DESCRIPTION_LENGTH = 255;
const TEST_TIMEOUT_MS = 12_000;

export type WikiTest =
	| { ok: true; sitename: string; generator: string | null; site_url: string | null; description: string | null; via_relay: boolean }
	| { ok: false; error: string };

type AskWiki = (query: Record<string, string>) => Promise<Response>;

export function parseWikiInput(body: Record<string, unknown>): { error: string } | { value: WikiInput } {
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

export async function testWiki(input: { api_url?: unknown; relay_url?: unknown; relay_key?: unknown }): Promise<WikiTest> {
	const apiUrl = String(input.api_url ?? '').trim();
	if (!/^https?:\/\//i.test(apiUrl)) return { ok: false, error: 'API URL must start with http:// or https://' };

	const relayUrl = String(input.relay_url ?? '').trim();
	const relayKey = String(input.relay_key ?? '').trim();

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

	const askWiki: AskWiki = (query) => {
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
			return { ok: false, error };
		}

		const data = await res.json();
		if (data?.relay_error) return { ok: false, error: `Relay refused the request: ${data.relay_error}` };

		const general = data?.query?.general;
		if (!general?.sitename) return { ok: false, error: 'That URL answered, but it is not a MediaWiki api.php endpoint' };

		return {
			ok: true,
			sitename: general.sitename,
			generator: general.generator ?? null,
			site_url: general.base ?? null,
			description: await summarizeWiki(askWiki, general),
			via_relay: Boolean(relayUrl)
		};
	} catch (error: any) {
		return { ok: false, error: error?.name === 'AbortError' ? 'The wiki did not respond in time' : 'Could not reach that wiki' };
	} finally {
		clearTimeout(timer);
	}
}
