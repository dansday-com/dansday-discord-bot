import { Type } from '@google/genai';
import { botAiSearchEndpoint, botAiFetchEndpoint } from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { postJson, resolveToolUrl } from './aiToolHttp.js';

const SEARCH_PATH = '/search';
const FETCH_PATH = '/web/fetch';

const MAX_RESULTS = 5;
const MAX_RESULTS_CAP = 10;
const MAX_SNIPPET_LENGTH = 400;
const MAX_FETCH_CHARACTERS = 6000;
const THIN_SNIPPET_LENGTH = 160;

const SEARCH_DESCRIPTION = `Search the live web. This is your default lookup for any factual question — news, current events, prices, release dates, versions, who someone is, whether something is real, games, how something works, or any claim where your own memory could be out of date. Reach for this first.

search_wiki is a specialist source for the few games it covers, not your main search. Use the wiki for a specific game page, and use this for everything else — including anything about those games that changes over time, since wiki pages go stale.

Keep going until you actually have the answer. If the results are thin, contradict each other, or only half answer the question, do not answer yet: open the most promising result with fetch_web_page, or search again with different keywords. Only say you could not find something after you have really tried.

Do not call this for chatting, greetings, jokes, opinions, or questions about you. Answer only with facts present in the results, never fill a gap from memory, and say plainly when nothing useful came back. Write the query in English even when the user wrote another language, then reply in their language.`;

const FETCH_DESCRIPTION = `Read the full text of one web page by its URL. Use this whenever a search snippet looks like the answer but is too short to answer from confidently, whenever you need an exact number, price, date or version, and whenever the user gives you a link and asks what it says. Reading the page beats answering from a snippet.

You must already have the exact URL — from the user's message or from a search_web result. Never invent or guess a URL. One page per call. Answer only from the text that comes back; if the page turns out not to have it, go back to search_web and try the next result rather than giving up.`;

const SEARCH_EMPTY_HINT =
	'Nothing came back for this query. Do not tell the user you could not find it yet — search again with different or broader English keywords, or try search_wiki if this is a game it covers.';

const SEARCH_THIN_HINT = 'These snippets are too short to answer from confidently. Open the most relevant result with fetch_web_page before you answer.';

const SEARCH_FAILED_HINT =
	'This search did not go through. Try search_web once more, or search_wiki if this is a game it covers, before you tell the user anything.';

const FETCH_FAILED_HINT =
	'This page could not be read. Go back to your search_web results and open a different one, or search again — do not answer from memory.';

export function searchConfigured(config) {
	const endpoint = botAiSearchEndpoint(config);
	return Boolean(endpoint.api_url && endpoint.api_key && endpoint.model);
}

export function fetchConfigured(config) {
	const endpoint = botAiFetchEndpoint(config);
	return Boolean(endpoint.api_url && endpoint.api_key && endpoint.model);
}

function clampResults(raw) {
	const count = Number(raw);
	if (!Number.isFinite(count) || count <= 0) return MAX_RESULTS;
	return Math.min(Math.trunc(count), MAX_RESULTS_CAP);
}

export async function runSearchTool(config, args) {
	const endpoint = botAiSearchEndpoint(config);
	if (!endpoint.api_url || !endpoint.api_key || !endpoint.model) return { ok: false, reason: 'web_search_not_configured' };

	const query = String(args?.query ?? '').trim();
	if (!query) return { ok: false, reason: 'missing_query' };

	const searchType = args?.search_type === 'news' ? 'news' : 'web';

	try {
		const payload = await postJson(resolveToolUrl(endpoint.api_url, SEARCH_PATH), endpoint.api_key, {
			model: endpoint.model,
			query,
			search_type: searchType,
			max_results: clampResults(args?.max_results)
		});

		const results = Array.isArray(payload?.results) ? payload.results : [];
		if (!results.length) return { ok: false, reason: 'no_results', query, next_step: SEARCH_EMPTY_HINT };

		const mapped = results.slice(0, MAX_RESULTS_CAP).map((entry) => ({
			title: entry?.title ?? null,
			url: entry?.url ?? null,
			snippet: typeof entry?.snippet === 'string' ? entry.snippet.slice(0, MAX_SNIPPET_LENGTH) : null,
			published_at: entry?.published_at ?? null
		}));

		const answer = payload?.answer ?? null;
		const thin = !answer && mapped.every((entry) => (entry.snippet ?? '').trim().length < THIN_SNIPPET_LENGTH);

		return {
			ok: true,
			query,
			answer,
			results: mapped,
			...(thin ? { next_step: SEARCH_THIN_HINT } : {})
		};
	} catch (error) {
		await logger.log(`❌ Web search failed: ${error.message}`);
		return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'search_failed', next_step: SEARCH_FAILED_HINT };
	}
}

export async function runFetchTool(config, args) {
	const endpoint = botAiFetchEndpoint(config);
	if (!endpoint.api_url || !endpoint.api_key || !endpoint.model) return { ok: false, reason: 'web_fetch_not_configured' };

	const url = String(args?.url ?? '').trim();
	if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'invalid_url', next_step: FETCH_FAILED_HINT };

	try {
		const payload = await postJson(resolveToolUrl(endpoint.api_url, FETCH_PATH), endpoint.api_key, {
			model: endpoint.model,
			url,
			format: 'markdown',
			max_characters: MAX_FETCH_CHARACTERS
		});

		const text = payload?.content?.text ?? '';
		if (!text) return { ok: false, reason: 'empty_page', url, next_step: FETCH_FAILED_HINT };

		return {
			ok: true,
			url: payload?.url ?? url,
			title: payload?.title ?? null,
			content: String(text).slice(0, MAX_FETCH_CHARACTERS),
			truncated: String(text).length > MAX_FETCH_CHARACTERS
		};
	} catch (error) {
		await logger.log(`❌ Web fetch failed: ${error.message}`);
		return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'fetch_failed', next_step: FETCH_FAILED_HINT };
	}
}

export function buildSearchTool(config) {
	if (!searchConfigured(config)) return null;

	return {
		type: 'function',
		function: {
			name: 'search_web',
			description: SEARCH_DESCRIPTION,
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'What to search for, in English, kept short — keywords rather than a full sentence or question.'
					},
					search_type: {
						type: 'string',
						enum: ['web', 'news'],
						description: 'Use "news" only when the user asks for recent news or current events. Otherwise leave this out.'
					},
					max_results: {
						type: 'integer',
						description: `How many results to read, 1 to ${MAX_RESULTS_CAP}. Leave out for ${MAX_RESULTS}.`
					}
				},
				required: ['query']
			}
		}
	};
}

export function buildFetchTool(config) {
	if (!fetchConfigured(config)) return null;

	return {
		type: 'function',
		function: {
			name: 'fetch_web_page',
			description: FETCH_DESCRIPTION,
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'The full http:// or https:// URL to read. Must be a URL you were given or found in a search result, never one you made up.'
					}
				},
				required: ['url']
			}
		}
	};
}

const VOICE_SEARCH_NOTE = `Say a short filler line like "let me check" only if you need to fill the silence while this runs. If the result does not answer it, chain another call — say "still checking" at most once and keep going rather than answering half a fact. Read the answer out loud in one or two short spoken sentences. Never read URLs aloud.`;

export function buildSearchDeclaration(config) {
	if (!searchConfigured(config)) return null;

	return {
		name: 'search_web',
		description: `${SEARCH_DESCRIPTION}\n\n${VOICE_SEARCH_NOTE}`,
		parameters: {
			type: Type.OBJECT,
			properties: {
				query: { type: Type.STRING, description: 'What to search for, in English, kept short.' },
				search_type: { type: Type.STRING, enum: ['web', 'news'], description: 'Use "news" only for recent news or current events.' }
			},
			required: ['query']
		}
	};
}

export function buildFetchDeclaration(config) {
	if (!fetchConfigured(config)) return null;

	return {
		name: 'fetch_web_page',
		description: `${FETCH_DESCRIPTION}\n\n${VOICE_SEARCH_NOTE}`,
		parameters: {
			type: Type.OBJECT,
			properties: {
				url: { type: Type.STRING, description: 'The full URL to read, taken from the user or a search result. Never invented.' }
			},
			required: ['url']
		}
	};
}

export default {
	searchConfigured,
	fetchConfigured,
	buildSearchTool,
	buildFetchTool,
	buildSearchDeclaration,
	buildFetchDeclaration,
	runSearchTool,
	runFetchTool
};
