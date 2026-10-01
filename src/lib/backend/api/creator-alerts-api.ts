import { XMLParser } from 'fast-xml-parser';
import {
	CREATOR_ALERTS_FETCH_TIMEOUT_MS,
	CREATOR_ALERTS_TIKTOK_COOLDOWN_MS,
	CREATOR_ALERTS_TIKTOK_MAX_PER_TICK,
	CREATOR_ALERTS_TIKTOK_SPACING_MS,
	CREATOR_ALERTS_YOUTUBE_CONCURRENCY
} from '../config.js';
import { logger } from '../../utils/index.js';

export type CreatorPlatform = 'youtube' | 'twitch' | 'tiktok';
export type CreatorContentType = 'video' | 'live' | 'post';

export const CREATOR_PLATFORM_TYPES: Record<CreatorPlatform, readonly CreatorContentType[]> = {
	youtube: ['video', 'live', 'post'],
	twitch: ['video', 'live'],
	tiktok: ['post', 'live']
};

export type CreatorProfile = {
	platform: CreatorPlatform;
	accountId: string;
	handle: string | null;
	name: string | null;
	thumbnailUrl: string | null;
};

export type CreatorContent = {
	contentId: string;
	type: CreatorContentType;
	title: string | null;
	url: string;
	thumbnailUrl: string | null;
	publishedAt: string | null;
};

export type CreatorSnapshot = {
	profile: CreatorProfile;
	contents: CreatorContent[];
};

export type CreatorRef = {
	platform: CreatorPlatform;
	accountId: string;
	handle: string | null;
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const YOUTUBE_HEADERS = {
	'User-Agent': BROWSER_UA,
	'Accept-Language': 'en-US,en;q=0.9',
	Cookie: 'SOCS=CAI; CONSENT=YES+1'
};

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const TWITCH_BATCH = 100;

const xml = new XMLParser({ ignoreAttributes: false });

export function creatorRefKey(ref: Pick<CreatorRef, 'platform' | 'accountId'>): string {
	return `${ref.platform}:${ref.accountId}`;
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function str(v: unknown): string | null {
	return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isoFromSeconds(v: unknown): string | null {
	const n = Number(v);
	return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}

function isoOrNull(v: unknown): string | null {
	const s = str(v);
	if (!s) return null;
	const t = new Date(s).getTime();
	return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

async function fetchText(url: string, headers: Record<string, string>): Promise<{ status: number; text: string }> {
	const res = await fetch(url, { headers, signal: AbortSignal.timeout(CREATOR_ALERTS_FETCH_TIMEOUT_MS) });
	return { status: res.status, text: await res.text() };
}

export function parseCreatorInput(raw: string): { platform: CreatorPlatform; handle: string } | null {
	const input = raw.trim();
	if (!input) return null;
	let url: URL | null = null;
	try {
		url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
	} catch {
		url = null;
	}
	const host = url?.hostname.replace(/^(www\.|m\.)/, '').toLowerCase() ?? '';
	const segments = url?.pathname.split('/').filter(Boolean) ?? [];

	if (host === 'youtube.com' || host === 'youtu.be') {
		const first = segments[0] ?? '';
		if (first.startsWith('@')) return { platform: 'youtube', handle: first };
		if (first === 'channel' && /^UC[\w-]{22}$/.test(segments[1] ?? '')) return { platform: 'youtube', handle: segments[1] };
		return null;
	}
	if (host === 'twitch.tv') {
		const login = (segments[0] ?? '').toLowerCase();
		return /^[a-z0-9_]{3,25}$/.test(login) ? { platform: 'twitch', handle: login } : null;
	}
	if (host === 'tiktok.com') {
		const first = segments[0] ?? '';
		return first.startsWith('@') && first.length > 1 ? { platform: 'tiktok', handle: first.slice(1) } : null;
	}
	return null;
}

function twitchVideoContent(node: any): CreatorContent | null {
	const id = str(node?.id);
	if (!id) return null;
	return {
		contentId: id,
		type: 'video',
		title: str(node.title),
		url: `https://www.twitch.tv/videos/${id}`,
		thumbnailUrl: str(node.previewThumbnailURL),
		publishedAt: isoOrNull(node.publishedAt)
	};
}

function twitchSnapshot(user: any): CreatorSnapshot | null {
	const accountId = str(user?.id);
	const login = str(user?.login);
	if (!accountId || !login) return null;
	const contents: CreatorContent[] = [];
	const stream = user.stream;
	if (stream && str(stream.id)) {
		contents.push({
			contentId: String(stream.id),
			type: 'live',
			title: str(stream.title),
			url: `https://www.twitch.tv/${login}`,
			thumbnailUrl: str(stream.previewImageURL),
			publishedAt: isoOrNull(stream.createdAt)
		});
	}
	for (const edge of user.videos?.edges ?? []) {
		const video = twitchVideoContent(edge?.node);
		if (video) contents.push(video);
	}
	return {
		profile: { platform: 'twitch', accountId, handle: login, name: str(user.displayName) ?? login, thumbnailUrl: str(user.profileImageURL) },
		contents
	};
}

const TWITCH_USER_FIELDS = `id login displayName profileImageURL(width: 70)
	stream { id title createdAt previewImageURL(width: 440, height: 248) }
	videos(first: 3, sort: TIME, types: [UPLOAD, HIGHLIGHT]) { edges { node { id title publishedAt previewThumbnailURL(width: 440, height: 248) } } }`;

async function twitchQuery(query: string, variables: Record<string, unknown>): Promise<any[]> {
	const res = await fetch(TWITCH_GQL_URL, {
		method: 'POST',
		headers: { 'Client-Id': TWITCH_CLIENT_ID, 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(CREATOR_ALERTS_FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`twitch gql ${res.status}`);
	const body: any = await res.json();
	if (Array.isArray(body?.errors) && body.errors.length > 0) throw new Error(`twitch gql: ${body.errors[0]?.message ?? 'error'}`);
	return Array.isArray(body?.data?.users) ? body.data.users : [];
}

async function fetchTwitchSnapshots(refs: CreatorRef[]): Promise<Map<string, CreatorSnapshot>> {
	const out = new Map<string, CreatorSnapshot>();
	for (let i = 0; i < refs.length; i += TWITCH_BATCH) {
		const ids = refs.slice(i, i + TWITCH_BATCH).map((r) => r.accountId);
		try {
			const users = await twitchQuery(`query($i: [ID!]) { users(ids: $i) { ${TWITCH_USER_FIELDS} } }`, { i: ids });
			for (const user of users) {
				const snap = twitchSnapshot(user);
				if (snap) out.set(creatorRefKey(snap.profile), snap);
			}
		} catch (err: any) {
			await logger.log(`⚠️ Creator alerts: twitch batch failed: ${err?.message || err}`);
		}
	}
	return out;
}

async function resolveTwitch(login: string): Promise<CreatorProfile | null> {
	const users = await twitchQuery(`query($l: [String!]) { users(logins: $l) { ${TWITCH_USER_FIELDS} } }`, { l: [login.toLowerCase()] });
	return users[0] ? (twitchSnapshot(users[0])?.profile ?? null) : null;
}

function youtubeProfileFromPage(html: string): CreatorProfile | null {
	const accountId = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1];
	if (!accountId) return null;
	const name = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? null;
	const avatar = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1] ?? null;
	const vanity = html.match(/"vanityChannelUrl":"[^"]*\/(@[^"/]+)"/)?.[1] ?? null;
	return { platform: 'youtube', accountId, handle: vanity ? decodeURIComponent(vanity) : null, name: name ? decodeEntities(name) : null, thumbnailUrl: avatar };
}

function decodeEntities(s: string): string {
	return s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

async function resolveYouTube(handle: string): Promise<CreatorProfile | null> {
	const path = /^UC[\w-]{22}$/.test(handle) ? `channel/${handle}` : `${handle.startsWith('@') ? handle : `@${handle}`}`;
	const { status, text } = await fetchText(`https://www.youtube.com/${path}?hl=en`, YOUTUBE_HEADERS);
	if (status !== 200) return null;
	return youtubeProfileFromPage(text);
}

function youtubeVideo(id: string, title: string | null, kind: 'video' | 'short', publishedAt: string | null): CreatorContent {
	return {
		contentId: id,
		type: 'video',
		title,
		url: kind === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
		thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
		publishedAt
	};
}

async function youtubeFeed(playlistId: string, kind: 'video' | 'short'): Promise<CreatorContent[]> {
	const { status, text } = await fetchText(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`, YOUTUBE_HEADERS);
	if (status === 404) return [];
	if (status !== 200) throw new Error(`youtube feed ${status}`);
	const feed = xml.parse(text)?.feed;
	if (!feed) throw new Error('youtube feed unparsable');
	const entries = feed.entry == null ? [] : Array.isArray(feed.entry) ? feed.entry : [feed.entry];
	const out: CreatorContent[] = [];
	for (const e of entries) {
		const id = str(e?.['yt:videoId']);
		if (!id) continue;
		out.push(youtubeVideo(id, str(typeof e.title === 'object' ? e.title?.['#text'] : e.title), kind, isoOrNull(e.published)));
	}
	return out;
}

async function youtubeLive(accountId: string): Promise<CreatorContent[]> {
	const { status, text } = await fetchText(`https://www.youtube.com/channel/${accountId}/live?hl=en`, YOUTUBE_HEADERS);
	if (status !== 200) throw new Error(`youtube live ${status}`);
	const canonical = text.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? '';
	if (!canonical.includes('/watch?v=')) return [];
	const raw = text.match(/var ytInitialPlayerResponse = (\{.*?\});(?:var|<\/script>)/s)?.[1];
	if (!raw) throw new Error('youtube live player response missing');
	const details = JSON.parse(raw)?.videoDetails;
	const id = str(details?.videoId);
	if (!id || details?.isLive !== true) return [];
	const thumbs: any[] = details.thumbnail?.thumbnails ?? [];
	return [
		{
			contentId: id,
			type: 'live',
			title: str(details.title),
			url: `https://www.youtube.com/watch?v=${id}`,
			thumbnailUrl: str(thumbs[thumbs.length - 1]?.url) ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
			publishedAt: null
		}
	];
}

function collectRenderers(node: any, key: string, out: any[]) {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const n of node) collectRenderers(n, key, out);
		return;
	}
	for (const [k, v] of Object.entries(node)) {
		if (k === key) out.push(v);
		else collectRenderers(v, key, out);
	}
}

async function youtubeInitialData(accountId: string, tab: string): Promise<any | null> {
	const { status, text } = await fetchText(`https://www.youtube.com/channel/${accountId}/${tab}?hl=en`, YOUTUBE_HEADERS);
	if (status === 404) return null;
	if (status !== 200) throw new Error(`youtube ${tab} ${status}`);
	const raw = text.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
	if (!raw) throw new Error(`youtube ${tab} initial data missing`);
	return JSON.parse(raw);
}

function youtubeSelectedTab(data: any, tab: string): any {
	const tabs: any[] = [];
	collectRenderers(data, 'tabRenderer', tabs);
	const selected = tabs.find((t) => t?.selected === true);
	const url = str(selected?.endpoint?.commandMetadata?.webCommandMetadata?.url) ?? '';
	return url.endsWith(`/${tab}`) ? (selected.content ?? null) : null;
}

async function youtubeTab(accountId: string, kind: 'video' | 'short'): Promise<CreatorContent[]> {
	const tab = kind === 'short' ? 'shorts' : 'videos';
	const data = await youtubeInitialData(accountId, tab);
	const content = data ? youtubeSelectedTab(data, tab) : null;
	if (!content) return [];
	const out: CreatorContent[] = [];
	if (kind === 'short') {
		const items: any[] = [];
		collectRenderers(content, 'shortsLockupViewModel', items);
		for (const item of items) {
			const id = str(item?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId);
			if (id) out.push(youtubeVideo(id, str(item.overlayMetadata?.primaryText?.content), kind, null));
		}
		return out;
	}
	const items: any[] = [];
	collectRenderers(content, 'lockupViewModel', items);
	for (const item of items) {
		const id = str(item?.contentId);
		if (!id || item.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') continue;
		out.push(youtubeVideo(id, str(item.metadata?.lockupMetadataViewModel?.title?.content), kind, null));
	}
	return out;
}

async function youtubeUploads(accountId: string, kind: 'video' | 'short'): Promise<CreatorContent[]> {
	try {
		return await youtubeTab(accountId, kind);
	} catch (err) {
		const feed = await youtubeFeed(`${kind === 'short' ? 'UUSH' : 'UULF'}${accountId.slice(2)}`, kind).catch(() => null);
		if (feed && feed.length > 0) return feed;
		throw err;
	}
}

async function youtubePosts(accountId: string): Promise<CreatorContent[]> {
	const data = await youtubeInitialData(accountId, 'posts');
	if (!data) return [];
	const posts: any[] = [];
	collectRenderers(data, 'backstagePostRenderer', posts);
	const out: CreatorContent[] = [];
	for (const p of posts) {
		const id = str(p?.postId);
		if (!id) continue;
		const text = (p.contentText?.runs ?? []).map((r: any) => (typeof r?.text === 'string' ? r.text : '')).join('');
		const images: any[] = [];
		collectRenderers(p.backstageAttachment, 'backstageImageRenderer', images);
		const thumbs: any[] = images[0]?.image?.thumbnails ?? [];
		out.push({
			contentId: id,
			type: 'post',
			title: str(text),
			url: `https://www.youtube.com/post/${id}`,
			thumbnailUrl: str(thumbs[thumbs.length - 1]?.url),
			publishedAt: null
		});
	}
	return out;
}

async function fetchYouTubeSnapshot(ref: CreatorRef): Promise<CreatorSnapshot> {
	const results = await Promise.allSettled([
		youtubeUploads(ref.accountId, 'video'),
		youtubeUploads(ref.accountId, 'short'),
		youtubeLive(ref.accountId),
		youtubePosts(ref.accountId)
	]);
	if (results[0].status === 'rejected') throw results[0].reason;
	const contents: CreatorContent[] = [];
	for (const r of results) {
		if (r.status === 'fulfilled') contents.push(...r.value);
	}
	return { profile: { platform: 'youtube', accountId: ref.accountId, handle: ref.handle, name: null, thumbnailUrl: null }, contents };
}

async function fetchYouTubeSnapshots(refs: CreatorRef[]): Promise<Map<string, CreatorSnapshot>> {
	const out = new Map<string, CreatorSnapshot>();
	let cursor = 0;
	const worker = async () => {
		while (cursor < refs.length) {
			const ref = refs[cursor++];
			const snap = await fetchYouTubeSnapshot(ref).catch(() => null);
			if (snap) out.set(creatorRefKey(ref), snap);
		}
	};
	await Promise.all(Array.from({ length: Math.min(CREATOR_ALERTS_YOUTUBE_CONCURRENCY, refs.length) }, worker));
	return out;
}

let tiktokLib: any = null;
let tiktokCursor = 0;
let tiktokFailures = 0;
let tiktokCooldownUntil = 0;

async function loadTikTok() {
	if (!tiktokLib) tiktokLib = await import('tiktok-live-connector');
	return tiktokLib;
}

function tiktokTripped(): boolean {
	return Date.now() < tiktokCooldownUntil;
}

const TIKTOK_BLOCK_PATTERN = /blocked|overload|403|429|composite|captcha|timeout|fetch failed|ECONNRESET/i;

async function tiktokFailed(reason: string) {
	if (!TIKTOK_BLOCK_PATTERN.test(reason)) return;
	tiktokFailures++;
	if (tiktokFailures >= 2) {
		tiktokCooldownUntil = Date.now() + CREATOR_ALERTS_TIKTOK_COOLDOWN_MS;
		tiktokFailures = 0;
		await logger.log(`⚠️ Creator alerts: tiktok paused for ${Math.round(CREATOR_ALERTS_TIKTOK_COOLDOWN_MS / 60_000)}m after repeated failures (${reason})`);
	}
}

async function tiktokRoomInfo(uniqueId: string): Promise<any> {
	const lib = await loadTikTok();
	const conn = new lib.TikTokLiveConnection(uniqueId, {});
	const res = await lib.RouteConfig.fetchRoomInfoFromApiLive({ webClient: conn.webClient, uniqueId });
	const data = res?.data;
	if (!data?.user?.id) throw new Error('tiktok room info missing user');
	return data;
}

async function tiktokEmbed(uniqueId: string): Promise<any> {
	const { status, text } = await fetchText(`https://www.tiktok.com/embed/@${encodeURIComponent(uniqueId)}`, {
		'User-Agent': BROWSER_UA,
		'Accept-Language': 'en-US,en;q=0.9'
	});
	if (status !== 200) throw new Error(`tiktok embed ${status}`);
	const raw = text.match(/<script id="__FRONTITY_CONNECT_STATE__" type="application\/json">(.*?)<\/script>/s)?.[1];
	if (!raw) throw new Error(text.length < 200 ? `tiktok embed blocked: ${text.trim().slice(0, 60)}` : 'tiktok embed state missing');
	const data = JSON.parse(raw)?.source?.data ?? {};
	const entry = Object.entries(data).find(([k]) => k.toLowerCase() === `/embed/@${uniqueId.toLowerCase()}`)?.[1] as any;
	if (!entry?.userInfo) throw new Error('tiktok embed user missing');
	return entry;
}

function tiktokProfile(user: any): CreatorProfile {
	return {
		platform: 'tiktok',
		accountId: String(user.id),
		handle: str(user.uniqueId),
		name: str(user.nickname) ?? str(user.uniqueId),
		thumbnailUrl: str(user.avatarMedium) ?? str(user.avatarThumb) ?? str(user.avatarThumbUrl)
	};
}

async function fetchTikTokSnapshot(ref: CreatorRef): Promise<CreatorSnapshot> {
	const uniqueId = ref.handle ?? '';
	if (!uniqueId) throw new Error('tiktok handle missing');
	const room = await tiktokRoomInfo(uniqueId);
	const profile = tiktokProfile(room.user);
	const contents: CreatorContent[] = [];
	const liveRoom = room.liveRoom;
	const roomId = str(room.user.roomId);
	if (liveRoom && Number(liveRoom.status) !== 4 && roomId) {
		contents.push({
			contentId: roomId,
			type: 'live',
			title: str(liveRoom.title),
			url: `https://www.tiktok.com/@${profile.handle ?? uniqueId}/live`,
			thumbnailUrl: str(liveRoom.coverUrl),
			publishedAt: isoFromSeconds(liveRoom.startTime)
		});
	}
	await sleep(CREATOR_ALERTS_TIKTOK_SPACING_MS);
	const embed = await tiktokEmbed(profile.handle ?? uniqueId);
	for (const v of embed.videoList ?? []) {
		const id = str(v?.id);
		if (!id) continue;
		contents.push({
			contentId: id,
			type: 'post',
			title: str(v.desc),
			url: `https://www.tiktok.com/@${profile.handle ?? uniqueId}/video/${id}`,
			thumbnailUrl: str(v.originCoverUrl) ?? str(v.coverUrl),
			publishedAt: null
		});
	}
	return { profile, contents };
}

async function fetchTikTokSnapshots(refs: CreatorRef[]): Promise<Map<string, CreatorSnapshot>> {
	const out = new Map<string, CreatorSnapshot>();
	if (refs.length === 0 || tiktokTripped()) return out;
	const count = Math.min(refs.length, CREATOR_ALERTS_TIKTOK_MAX_PER_TICK);
	const start = tiktokCursor % refs.length;
	for (let i = 0; i < count; i++) {
		if (tiktokTripped()) break;
		const ref = refs[(start + i) % refs.length];
		if (i > 0) await sleep(CREATOR_ALERTS_TIKTOK_SPACING_MS);
		try {
			out.set(creatorRefKey(ref), await fetchTikTokSnapshot(ref));
			tiktokFailures = 0;
		} catch (err: any) {
			await tiktokFailed(`${ref.handle}: ${err?.message || err}`);
		}
	}
	tiktokCursor = (start + count) % refs.length;
	return out;
}

async function resolveTikTok(uniqueId: string): Promise<CreatorProfile | null> {
	if (tiktokTripped()) throw new Error('tiktok cooling down');
	const room = await tiktokRoomInfo(uniqueId.replace(/^@/, ''));
	return tiktokProfile(room.user);
}

export async function resolveCreator(platform: CreatorPlatform, handle: string): Promise<CreatorProfile | null> {
	if (platform === 'twitch') return await resolveTwitch(handle);
	if (platform === 'youtube') return await resolveYouTube(handle);
	return await resolveTikTok(handle);
}

export async function fetchCreatorSnapshots(refs: CreatorRef[]): Promise<Map<string, CreatorSnapshot>> {
	const by = (p: CreatorPlatform) => refs.filter((r) => r.platform === p);
	const [twitch, youtube, tiktok] = await Promise.all([
		fetchTwitchSnapshots(by('twitch')),
		fetchYouTubeSnapshots(by('youtube')),
		fetchTikTokSnapshots(by('tiktok'))
	]);
	return new Map([...twitch, ...youtube, ...tiktok]);
}
