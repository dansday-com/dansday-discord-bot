import axios from 'axios';

const FEED_URL = 'https://raw.githubusercontent.com/xGustavvo/discord-api-tracker/main/quests.json';
const FEED_TIMEOUT_MS = 20000;
const FEED_TTL_MS = 5 * 60 * 1000;

type FeedPayload = { quests: unknown[] };

let cachedPayload: FeedPayload | null = null;
let cachedEtag: string | null = null;
let cachedAt = 0;

export function questFeedUrl(): string {
	return FEED_URL;
}

export async function fetchPublicQuests(): Promise<FeedPayload> {
	const fresh = cachedPayload && Date.now() - cachedAt < FEED_TTL_MS;
	if (fresh) return cachedPayload!;

	try {
		const res = await axios({
			method: 'GET',
			url: FEED_URL,
			timeout: FEED_TIMEOUT_MS,
			headers: {
				Accept: 'application/json',
				...(cachedEtag ? { 'If-None-Match': cachedEtag } : {})
			},
			validateStatus: () => true
		});

		if (res.status === 304 && cachedPayload) {
			cachedAt = Date.now();
			return cachedPayload;
		}

		if (res.status !== 200) {
			throw new Error(`quest feed returned HTTP ${res.status}`);
		}

		const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
		const quests = Array.isArray(body) ? body : Array.isArray(body?.quests) ? body.quests : null;
		if (!quests) throw new Error('quest feed body was not an array');

		const etag = res.headers?.etag;
		cachedEtag = typeof etag === 'string' ? etag : null;
		cachedPayload = { quests };
		cachedAt = Date.now();
		return cachedPayload;
	} catch (err: any) {
		if (cachedPayload) {
			return cachedPayload;
		}
		throw new Error(`quest feed unavailable: ${String(err?.message || err)}`);
	}
}
