import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';

const REQUEST_TIMEOUT_MS = 15_000;
export const WIKI_USER_AGENT = 'DansdayBot/1.0 (https://github.com/dansday-com/dansday-discord-bot) MediaWiki-search';
const USER_AGENT = WIKI_USER_AGENT;
const SEARCH_LIMIT = 4;
const PAGES_TO_READ = 2;
const MAX_EXTRACT_CHARS = 1500;
const MAX_INFOBOX_FIELDS = 24;
const MAX_RESULT_CHARS = 6000;
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

async function apiGet(apiUrl, params) {
	const url = new URL(apiUrl);
	for (const [key, value] of Object.entries({ ...params, format: 'json', formatversion: '2' })) {
		url.searchParams.set(key, String(value));
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
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
	return String(value ?? '')
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]*)\]\]/g, '$1')
		.replace(/\{\{[Cc]\$\|([^}]*)\}\}/g, '$1 C$')
		.replace(/\{\{[^}]*\}\}/g, '')
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
	if (!key || !value || key.includes('\n') || /^(image|icon|menu_color|bobber_color\d*|imagecaption)$/.test(key)) return;
	if (Object.keys(fields).length >= MAX_INFOBOX_FIELDS) return;

	fields[key] = value;
}

function tidyExtract(extract) {
	return String(extract ?? '')
		.split('\n')
		.filter((line) => !/^=+\s*(Navigation|Change History|Gallery|Trivia|References)\s*=+$/i.test(line.trim()))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/\n==+\s*[^\n=]+\s*=+\n(?=\s*(\n==|$))/g, '\n')
		.trim()
		.slice(0, MAX_EXTRACT_CHARS);
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

function wikitextToPlain(wikitext) {
	return stripTemplates(String(wikitext ?? ''))
		.replace(/<ref[^>]*\/>/gi, '')
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
		.replace(/^\s*\[\[(?:File|Image|Category):[^\]]*\]\]\s*$/gim, '')
		.replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
		.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
		.replace(/\[\[([^\]]*)\]\]/g, '$1')
		.replace(/\[(?:https?:)?\/\/\S+\s+([^\]]*)\]/g, '$1')
		.replace(/^\s*\{\|[\s\S]*?\|\}\s*$/gim, '')
		.replace(/<[^>]+>/g, '')
		.replace(/'''?/g, '')
		.replace(/^[*#:;]+\s*/gm, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/ +\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

const STOPWORDS = new Set([
	'a',
	'an',
	'the',
	'is',
	'are',
	'was',
	'were',
	'be',
	'do',
	'does',
	'did',
	'can',
	'could',
	'should',
	'would',
	'will',
	'what',
	'whats',
	'which',
	'who',
	'how',
	'where',
	'when',
	'why',
	'i',
	'me',
	'my',
	'you',
	'your',
	'it',
	'its',
	'to',
	'of',
	'in',
	'on',
	'at',
	'for',
	'from',
	'with',
	'about',
	'and',
	'or',
	'get',
	'got',
	'tell',
	'know',
	'much',
	'many',
	'there',
	'that',
	'this',
	'please',
	'thanks'
]);

function simplifyQuery(query) {
	const words = query
		.replace(/[?!.,]/g, ' ')
		.split(/\s+/)
		.filter((word) => word && !STOPWORDS.has(word.toLowerCase()));

	const simplified = words.join(' ').trim();
	return simplified && simplified.toLowerCase() !== query.trim().toLowerCase() ? simplified : null;
}

async function rawSearch(wiki, query) {
	const data = await apiGet(wiki.api_url, {
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

const ATTRIBUTE_WORDS = new Set([
	'price',
	'cost',
	'value',
	'weight',
	'stats',
	'stat',
	'luck',
	'chance',
	'rarity',
	'location',
	'locations',
	'bait',
	'season',
	'weather',
	'xp',
	'level',
	'requirement',
	'requirements',
	'recipe',
	'drop',
	'drops',
	'worth'
]);

function titleCase(text) {
	return text.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function trimAttributes(text) {
	const words = text.split(/\s+/);
	while (words.length > 1 && ATTRIBUTE_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
	while (words.length > 1 && ATTRIBUTE_WORDS.has(words[0].toLowerCase())) words.shift();
	return words.join(' ');
}

async function exactTitle(wiki, query) {
	const trimmed = trimAttributes(query);
	const candidates = [...new Set([query, titleCase(query), trimmed, titleCase(trimmed)].filter(Boolean))];

	const data = await apiGet(wiki.api_url, { action: 'query', titles: candidates.join('|'), redirects: '1' }).catch(() => null);
	const pages = data?.query?.pages ?? [];

	for (const candidate of candidates) {
		const hit = pages.find((entry) => !entry.missing && entry.title.toLowerCase() === candidate.toLowerCase());
		if (hit) return hit.title;
	}

	const normalized = (data?.query?.normalized ?? []).map((entry) => entry.to.toLowerCase());
	const fallback = pages.find((entry) => !entry.missing && normalized.includes(entry.title.toLowerCase()));
	return fallback?.title ?? pages.find((entry) => !entry.missing)?.title ?? null;
}

function promote(hits, title) {
	if (!title) return hits;
	const rest = hits.filter((hit) => hit.title.toLowerCase() !== title.toLowerCase());
	return [{ title, snippet: '' }, ...rest];
}

async function searchTitles(wiki, query) {
	const simplified = simplifyQuery(query);

	const [first, exact] = await Promise.all([rawSearch(wiki, query), exactTitle(wiki, simplified ?? query)]);
	if (first.hits.length || exact) return promote(first.hits, exact);

	if (simplified) {
		const retry = await rawSearch(wiki, simplified);
		if (retry.hits.length) return retry.hits;
	}

	if (first.suggestion) {
		const suggested = await rawSearch(wiki, first.suggestion);
		if (suggested.hits.length) return suggested.hits;
	}

	return [];
}

async function readPage(wiki, title) {
	const [summary, source] = await Promise.all([
		apiGet(wiki.api_url, {
			action: 'query',
			prop: 'extracts|info',
			explaintext: '1',
			inprop: 'url',
			redirects: '1',
			titles: title
		}).catch(() => null),
		apiGet(wiki.api_url, { action: 'parse', page: title, prop: 'wikitext' }).catch(() => null)
	]);

	const page = summary?.query?.pages?.[0];
	if (!page || page.missing) return null;

	const wikitext = source?.parse?.wikitext ?? '';
	const infobox = wikitext ? extractInfobox(wikitext) : {};

	const extract = tidyExtract(page.extract) || (wikitext ? tidyExtract(wikitextToPlain(wikitext)) : '');

	return {
		title: page.title,
		url: page.canonicalurl ?? page.fullurl ?? null,
		stats: Object.keys(infobox).length ? infobox : null,
		extract
	};
}

export async function searchWiki(wiki, query) {
	const trimmed = String(query ?? '').trim();
	if (!trimmed) return { ok: false, reason: 'empty_query' };

	const cacheKey = `${wiki.api_url}::${trimmed.toLowerCase()}`;
	const cached = cacheGet(cacheKey);
	if (cached) return cached;

	let hits;
	try {
		hits = await searchTitles(wiki, trimmed);
	} catch (error) {
		await logger.log(`❌ Wiki search failed (${wiki.name}): ${error.message}`);
		return { ok: false, reason: 'wiki_unreachable', wiki: wiki.name };
	}

	if (!hits.length) {
		const miss = { ok: true, wiki: wiki.name, query: trimmed, pages: [], note: 'No page on this wiki matches that query.' };
		cacheSet(cacheKey, miss);
		return miss;
	}

	const pages = (await Promise.all(hits.slice(0, PAGES_TO_READ).map((hit) => readPage(wiki, hit.title).catch(() => null)))).filter(Boolean);

	const result = {
		ok: true,
		wiki: wiki.name,
		wiki_url: wiki.site_url,
		query: trimmed,
		pages,
		other_matches: hits.slice(PAGES_TO_READ).map((hit) => hit.title)
	};

	let payload = JSON.stringify(result);
	while (payload.length > MAX_RESULT_CHARS && result.pages.length > 1) {
		result.pages.pop();
		payload = JSON.stringify(result);
	}
	if (payload.length > MAX_RESULT_CHARS && result.pages[0]) {
		result.pages[0].extract = result.pages[0].extract.slice(0, 700);
	}

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
			description: `Look up factual information on a game wiki. Use this whenever someone asks about anything covered by these wikis — items, rods, fish, bait, NPCs, locations, quests, events, mechanics, prices, stats or how something works. Never answer such questions from memory, and never guess numbers: search first, then answer from what comes back. Available wikis:\n${describeWikis(wikis)}`,
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
						description: 'The thing to look up — usually the item, fish or place name on its own, e.g. "Steady Rod". Keep it short.'
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

	return searchWiki(match, args?.query);
}

export default { searchWiki, getEnabledWikis, buildWikiTool, buildWikiDeclaration, runWikiTool, describeWikis };
