import { Type } from '@google/genai';
import { botAiSearchEndpoint, botAiFetchEndpoint } from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { postJson } from './aiToolHttp.js';

const MAX_RESULTS = 5;
const MAX_RESULTS_CAP = 10;
const MAX_SNIPPET_LENGTH = 400;
const MAX_FETCH_CHARACTERS = 6000;

const SEARCH_DESCRIPTION = `Search the live web. Use this for anything the wikis do not cover and anything that changes over time — news, current events, prices outside the games, release dates, who someone is, whether something is real, or any question where your own memory could be out of date.

Prefer search_wiki for questions about a game covered by the wikis. Use this when there is no wiki for the subject, when the wiki came back empty, or when the user explicitly asks you to search the web or asks what is happening right now.

Do not call this for chatting, greetings, jokes, opinions, or questions about you. Answer only with facts present in the results, never fill a gap from memory, and say plainly when nothing useful came back. Write the query in English even when the user wrote another language, then reply in their language.`;

const FETCH_DESCRIPTION = `Read the full text of one web page by its URL. Use this when the user gives you a link and asks what it says, or when a search result looks like the answer but its snippet is too short to answer from.

You must already have the exact URL — from the user's message or from a search_web result. Never invent or guess a URL. One page per call. Answer only from the text that comes back.`;

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
		const payload = await postJson(endpoint.api_url, endpoint.api_key, {
			model: endpoint.model,
			query,
			search_type: searchType,
			max_results: clampResults(args?.max_results)
		});

		const results = Array.isArray(payload?.results) ? payload.results : [];
		if (!results.length) return { ok: false, reason: 'no_results', query };

		return {
			ok: true,
			query,
			answer: payload?.answer ?? null,
			results: results.slice(0, MAX_RESULTS_CAP).map((entry) => ({
				title: entry?.title ?? null,
				url: entry?.url ?? null,
				snippet: typeof entry?.snippet === 'string' ? entry.snippet.slice(0, MAX_SNIPPET_LENGTH) : null,
				published_at: entry?.published_at ?? null
			}))
		};
	} catch (error) {
		await logger.log(`❌ Web search failed: ${error.message}`);
		return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'search_failed' };
	}
}

export async function runFetchTool(config, args) {
	const endpoint = botAiFetchEndpoint(config);
	if (!endpoint.api_url || !endpoint.api_key || !endpoint.model) return { ok: false, reason: 'web_fetch_not_configured' };

	const url = String(args?.url ?? '').trim();
	if (!/^https?:\/\//i.test(url)) return { ok: false, reason: 'invalid_url' };

	try {
		const payload = await postJson(endpoint.api_url, endpoint.api_key, {
			model: endpoint.model,
			url,
			format: 'markdown',
			max_characters: MAX_FETCH_CHARACTERS
		});

		const text = payload?.content?.text ?? '';
		if (!text) return { ok: false, reason: 'empty_page', url };

		return {
			ok: true,
			url: payload?.url ?? url,
			title: payload?.title ?? null,
			content: String(text).slice(0, MAX_FETCH_CHARACTERS),
			truncated: String(text).length > MAX_FETCH_CHARACTERS
		};
	} catch (error) {
		await logger.log(`❌ Web fetch failed: ${error.message}`);
		return { ok: false, reason: error.name === 'AbortError' ? 'timeout' : 'fetch_failed' };
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

const VOICE_SEARCH_NOTE = `Say a short filler line like "let me check" only if you need to fill the silence while this runs. Read the answer out loud in one or two short spoken sentences. Never read URLs aloud.`;

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
