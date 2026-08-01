import { load } from 'cheerio';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';

const REQUEST_TIMEOUT_MS = 15_000;
export const WIKI_USER_AGENT = 'DansdayBot/1.0 (https://github.com/dansday-com/dansday-discord-bot) MediaWiki-search';
const USER_AGENT = WIKI_USER_AGENT;
const SEARCH_LIMIT = 4;
const PAGES_TO_READ = 2;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const cache = new Map();

function cacheGet(key) {
	const hit = cache.get(key);
	if (!hit) return null;
	if (Date.now() > hit.expires) {
		cache.delete(key);
		return null;
	}
	return hit.value;
}

function cacheSet(key, value) {
	if (cache.size >= CACHE_MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

async function apiGet(wiki, params) {
	const url = new URL(wiki.api_url);
	for (const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2' })) {
		url.searchParams.set(key, String(value));
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	const request = wiki.relay_url
		? [
				wiki.relay_url,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'User-Agent': USER_AGENT,
						...(wiki.relay_key ? { 'X-Relay-Key': wiki.relay_key } : {})
					},
					body: JSON.stringify({ url: url.toString() }),
					signal: controller.signal
				}
			]
		: [url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal }];

	try {
		const res = await fetch(request[0], request[1]);
		if (!res.ok) throw new Error(`HTTP ${res.status}${wiki.relay_url ? ' (via relay)' : ''}`);

		const data = await res.json();
		if (data?.relay_error) throw new Error(`Relay: ${data.relay_error}`);
		return data;
	} finally {
		clearTimeout(timer);
	}
}

function stripHtml(text) {
	return String(text ?? '')
		.replace(/<[^>]*>/g, '')
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#\d+;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanWikiValue(value) {
	let out = String(value ?? '')
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]*)\]\]/g, '$1');

	let previous;
	let guard = 0;
	do {
		previous = out;
		out = out.replace(/\{\{([^{}|]*)\|?([^{}]*)\}\}/g, (match, name, args) => {
			const label = String(name).trim();
			const values = String(args)
				.split('|')
				.map((part) => part.replace(/^\s*[A-Za-z][A-Za-z0-9 _-]*\s*=\s*/, '').trim())
				.filter(Boolean);

			if (!values.length) return label && !/[=:]/.test(label) ? label : '';
			return /^[^A-Za-z0-9]+$/.test(label) ? `${values.join(' ')} ${label}` : values.join(' ');
		});
	} while (out !== previous && ++guard < 8);

	return out
		.replace(/'''?/g, '')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractInfobox(wikitext) {
	const start = wikitext.search(/\{\{[A-Za-z0-9 _-]*[Ii]nfobox/);
	if (start === -1) return {};

	let depth = 0;
	let end = -1;
	for (let i = start; i < wikitext.length - 1; i++) {
		if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
			depth++;
			i++;
		} else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
			depth--;
			i++;
			if (depth === 0) {
				end = i + 1;
				break;
			}
		}
	}
	if (end === -1) return {};

	const body = wikitext.slice(start + 2, end - 2);
	const fields = {};
	let depthGuard = 0;
	let current = '';

	for (let i = 0; i < body.length; i++) {
		const char = body[i];
		if (char === '{' || char === '[') depthGuard++;
		else if (char === '}' || char === ']') depthGuard--;

		if (char === '|' && depthGuard <= 0) {
			pushField(fields, current);
			current = '';
			continue;
		}
		current += char;
	}
	pushField(fields, current);

	return fields;
}

function pushField(fields, chunk) {
	const eq = chunk.indexOf('=');
	if (eq === -1) return;

	const key = chunk.slice(0, eq).trim().toLowerCase();
	const value = cleanWikiValue(chunk.slice(eq + 1));
	if (!key || !value || key.includes('\n')) return;
	if (/(?:^|_)(?:image|img|icon|file|logo|sprite|thumb|caption|color|colour|css|style|width|height|align|px)\d*(?:$|_)/.test(key)) return;
	if (/^#?[0-9a-f]{3,8}(?:;#?[0-9a-f]{3,8})*$/i.test(value)) return;

	fields[key] = value;
}

function contentScore(text) {
	return String(text ?? '')
		.split('\n')
		.filter((line) => line.trim() && !/^=+[^=]+=+$/.test(line.trim()))
		.join(' ').length;
}

function tidyExtract(extract) {
	return String(extract ?? '')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/\n==+\s*[^\n=]+\s*=+\n(?=\s*(\n==|$))/g, '\n')
		.trim();
}

function stripTemplates(text) {
	let out = '';
	let depth = 0;

	for (let i = 0; i < text.length; i++) {
		if (text[i] === '{' && text[i + 1] === '{') {
			depth++;
			i++;
		} else if (text[i] === '}' && text[i + 1] === '}' && depth > 0) {
			depth--;
			i++;
		} else if (depth === 0) {
			out += text[i];
		}
	}
	return out;
}

const NOISE_SELECTOR = [
	'style',
	'script',
	'aside',
	'figure',
	'sup.reference',
	'.portable-infobox',
	'.infobox',
	'.navbox',
	'.nav-box',
	'.toc',
	'#toc',
	'.mw-editsection',
	'.hatnote',
	'.dablink',
	'.noprint',
	'.reference',
	'.reflist',
	'.references',
	'.thumbcaption',
	'.navigation-not-searchable',
	'.mw-empty-elt',
	'.mw-jump-link',
	'.printfooter',
	'.ambox',
	'.notice'
].join(', ');

function htmlToPlain(html) {
	const $ = load(String(html ?? ''), null, false);

	$(NOISE_SELECTOR).remove();

	$('h1, h2, h3, h4, h5, h6').each((index, element) => {
		const heading = $(element).text().trim();
		$(element).replaceWith(heading ? `\n\n== ${heading} ==\n` : '\n');
	});

	$('li').each((index, element) => {
		const item = $(element).text().trim();
		$(element).replaceWith(item ? `\n* ${item}` : '');
	});

	$('td, th').each((index, element) => {
		$(element).replaceWith(` ${$(element).text().trim()}`);
	});
	$('tr').each((index, element) => {
		$(element).replaceWith(`\n${$(element).text().trim()}`);
	});
	$('p, div, blockquote, dd, dt').each((index, element) => {
		$(element).replaceWith(`\n${$(element).text()}\n`);
	});
	$('br, hr').replaceWith('\n');

	return $.text()
		.replace(/ /g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n\*\s*(?=\n)/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function wikitextToPlain(wikitext) {
	return stripTemplates(String(wikitext ?? ''))
		.replace(/<ref[^>]*\/>/gi, '')
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/^\s*\[\[(?:File|Image|Category):[^\]]*\]\]\s*$/gim, '')
		.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]*)\]\]/g, '$1')
		.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]*)\]/g, '$1')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/'''?/g, '')
		.replace(/^[*#:;]+\s*/gm, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/ +\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

async function rawSearch(wiki, query) {
	const data = await apiGet(wiki, {
		action: 'query',
		list: 'search',
		srsearch: query,
		srlimit: SEARCH_LIMIT,
		srprop: 'snippet'
	});

	return {
		hits: (data?.query?.search ?? []).map((hit) => ({ title: hit.title, snippet: stripHtml(hit.snippet) })),
		suggestion: data?.query?.searchinfo?.suggestion ?? null
	};
}

function titleCase(text) {
	return text.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

async function exactTitle(wiki, query, { strict = false } = {}) {
	const candidates = [...new Set([query, titleCase(query)].filter(Boolean))];

	const data = await apiGet(wiki, { action: 'query', titles: candidates.join('|'), redirects: '1' }).catch(() => null);
	const pages = data?.query?.pages ?? [];

	for (const candidate of candidates) {
		const hit = pages.find((entry) => !entry.missing && entry.title.toLowerCase() === candidate.toLowerCase());
		if (hit) return hit.title;
	}

	const redirected = [...(data?.query?.normalized ?? []), ...(data?.query?.redirects ?? [])].map((entry) => entry.to.toLowerCase());
	const followed = pages.find((entry) => !entry.missing && redirected.includes(entry.title.toLowerCase()));
	if (followed) return followed.title;

	return strict ? null : (pages.find((entry) => !entry.missing)?.title ?? null);
}

function promote(hits, title) {
	if (!title) return hits;
	const rest = hits.filter((hit) => hit.title.toLowerCase() !== title.toLowerCase());
	return [{ title, snippet: '' }, ...rest];
}

async function searchTitles(wiki, query, page) {
	if (page) {
		const named = await exactTitle(wiki, page, { strict: true });
		if (named) return [{ title: named, snippet: '' }];

		const direct = await rawSearch(wiki, page).catch(() => ({ hits: [] }));
		const sameTitle = direct.hits.find((hit) => hit.title.toLowerCase() === String(page).toLowerCase());
		if (sameTitle) return [sameTitle];
	}

	const [first, exact] = await Promise.all([rawSearch(wiki, query), exactTitle(wiki, query)]);
	if (first.hits.length || exact) return promote(first.hits, exact);

	if (first.suggestion) {
		const suggested = await rawSearch(wiki, first.suggestion);
		if (suggested.hits.length) return suggested.hits;
	}

	return [];
}

async function readPage(wiki, title) {
	const [summary, source] = await Promise.all([
		apiGet(wiki, { action: 'query', prop: 'info', inprop: 'url', redirects: '1', titles: title }).catch(() => null),
		apiGet(wiki, {
			action: 'parse',
			page: title,
			prop: 'text|wikitext',
			redirects: '1',
			disableeditsection: '1',
			disabletoc: '1'
		}).catch(() => null)
	]);

	const page = summary?.query?.pages?.[0];
	if (!page || page.missing) return null;

	const wikitext = source?.parse?.wikitext ?? '';
	const infobox = wikitext ? extractInfobox(wikitext) : {};

	const rendered = tidyExtract(htmlToPlain(source?.parse?.text ?? ''));
	const fromSource = wikitext ? tidyExtract(wikitextToPlain(wikitext)) : '';
	const extract = contentScore(rendered) >= contentScore(fromSource) ? rendered : fromSource;

	return {
		title: page.title,
		url: page.canonicalurl ?? page.fullurl ?? null,
		stats: Object.keys(infobox).length ? infobox : null,
		extract
	};
}

export async function searchWiki(wiki, query, page) {
	const trimmed = String(query ?? '').trim();
	const requestedPage = String(page ?? '').trim();
	if (!trimmed && !requestedPage) return { ok: false, reason: 'empty_query' };

	const cacheKey = `${wiki.api_url}::${requestedPage.toLowerCase()}::${trimmed.toLowerCase()}`;
	const cached = cacheGet(cacheKey);
	if (cached) return cached;

	let hits;
	try {
		hits = await searchTitles(wiki, trimmed || requestedPage, requestedPage);
	} catch (error) {
		await logger.log(`❌ Wiki search failed (${wiki.name}): ${error.message}`);
		return { ok: false, reason: 'wiki_unreachable', wiki: wiki.name };
	}

	if (!hits.length) {
		const miss = { ok: true, wiki: wiki.name, query: trimmed || requestedPage, pages: [], note: 'No page on this wiki matches that query.' };
		cacheSet(cacheKey, miss);
		return miss;
	}

	const pages = (await Promise.all(hits.slice(0, PAGES_TO_READ).map((hit) => readPage(wiki, hit.title).catch(() => null)))).filter(Boolean);

	const missedPage = requestedPage && !pages.some((entry) => entry.title.toLowerCase() === requestedPage.toLowerCase());

	const result = {
		ok: true,
		wiki: wiki.name,
		wiki_url: wiki.site_url,
		query: trimmed || requestedPage,
		pages,
		other_matches: hits.slice(PAGES_TO_READ).map((hit) => hit.title),
		...(missedPage
			? { note: `There is no page titled "${requestedPage}" on this wiki. These are search results for it instead — check the titles before using them.` }
			: {})
	};

	cacheSet(cacheKey, result);
	return result;
}

export async function getEnabledWikis(botId) {
	const rows = await db.getBotWikis(botId);
	return rows.filter((row) => row.enabled && row.api_url);
}

export function describeWikis(wikis) {
	return wikis.map((wiki) => `- ${wiki.name}${wiki.description ? `: ${wiki.description}` : ''}`).join('\n');
}

export function buildWikiTool(wikis) {
	if (!wikis.length) return null;

	return {
		type: 'function',
		function: {
			name: 'search_wiki',
			description: `Look up factual information on a game wiki. Use this whenever someone asks about anything covered by these wikis — items, rods, fish, bait, NPCs, locations, quests, events, mechanics, prices, stats, versions or how something works. Never answer such questions from memory, and never guess numbers: search first, then answer from what comes back.

Read the entire result before answering: the answer is usually under a heading such as "Obtainment", "Skins", "Location" or "Change History" rather than in the opening line, and infobox values arrive in "stats". Answer only with facts present in the result — never add an item, price, chance or mechanic that is not there, and never fill a gap from memory. If the result already contains the answer, never claim the wiki has not documented it yet, and never speculate about why something is missing. Live values such as countdowns, current spawn timers and active events are not on the wiki: say you cannot see live timers and give the conditions the wiki does list instead.

The search itself is English-only, but always reply in the language the user wrote in. If the search comes back with nothing, say plainly that you could not find it on the wiki — never tell them to go look it up themselves. Available wikis:\n${describeWikis(wikis)}`,
			parameters: {
				type: 'object',
				properties: {
					wiki: {
						type: 'string',
						enum: wikis.map((wiki) => wiki.name),
						description: 'Which wiki to search. Pick the one whose game the user is asking about.'
					},
					query: {
						type: 'string',
						description:
							'The thing to look up, written in English no matter what language the user spoke — these wikis only have English page titles, so a non-English query finds nothing. Translate their words first, then search the name on its own, e.g. "Steady Rod". Indonesian examples: "versi terbaru" → "latest version", "ikan langka" → "rare fish", "harga joran" → "fishing rod price". Keep it short — the page name, not a sentence or a question.'
					},
					page: {
						type: 'string',
						description:
							'Optional. The exact wiki page title to open, when you already know it — this skips searching and reads that page directly. Use it when the user names a specific page, or when a previous result pointed at one (e.g. a version number like "1.94.0" for the newest patch, or a title listed in "other_matches"). Leave this out if you are unsure the page exists, and just use query instead.'
					}
				},
				required: ['wiki', 'query']
			}
		}
	};
}

export function buildWikiDeclaration(wikis) {
	const tool = buildWikiTool(wikis);
	if (!tool) return null;

	return {
		name: tool.function.name,
		description: `${tool.function.description}\n\nRead the answer out loud in one or two short spoken sentences. Do not read URLs aloud.`,
		parameters: tool.function.parameters
	};
}

export async function runWikiTool(wikis, args) {
	const requested = String(args?.wiki ?? '')
		.trim()
		.toLowerCase();
	const match = wikis.find((wiki) => wiki.name.toLowerCase() === requested) ?? (wikis.length === 1 ? wikis[0] : null);

	if (!match) {
		return { ok: false, reason: 'unknown_wiki', available: wikis.map((wiki) => wiki.name) };
	}

	return searchWiki(match, args?.query, args?.page);
}

export default { searchWiki, getEnabledWikis, buildWikiTool, buildWikiDeclaration, runWikiTool, describeWikis };
