import axios from 'axios';
import { discordQuestHttp } from '../config.js';
import { attemptSync } from '../../utils/attempt.js';
import { HTTP, isHttpSuccess } from '../../http.js';
import { SECOND_MS, HOUR_SECONDS, MINUTE_MS, MINUTE_SECONDS, SECONDS_PER_MINUTE } from '../../utils/time.js';

const RETRY_AFTER_DEFAULT_MS = 2 * SECOND_MS;
const RETRY_AFTER_MIN_MS = SECOND_MS;
const RETRY_AFTER_MAX_MS = 2 * MINUTE_MS;
const RATE_LIMIT_BACKOFF_MS = 2 * SECOND_MS;
const ERROR_BODY_PREVIEW_LENGTH = 200;
const IMAGE_URL_SCAN_MAX_DEPTH = 7;
const REWARD_ASSET_SCAN_MAX_DEPTH = 4;
const URL_KEYWORD_SCORE = 100;
const URL_LENGTH_SCORE_CAP = 200;
const URL_LENGTH_SCORE_DIVISOR = 1000;
const QUEST_ASSET_TOKEN = '\u006f\u0072\u0062';
const QUEST_ASSET_TOKEN_RE = new RegExp(QUEST_ASSET_TOKEN, 'i');
const TASK_DETAIL_MAX_LENGTH = 200;
const WHOLE_MINUTE_TOLERANCE_SECONDS = 5;
const BASE64_BLOCK_LENGTH = 4;
const HEARTBEAT_MIN_ITERATIONS = 50;
const HEARTBEAT_MAX_ITERATIONS = 800;
const HEARTBEAT_EXTRA_ITERATIONS = 45;
const HEARTBEAT_DEFAULT_ITERATIONS = 500;
const PROGRESS_TOLERANCE_SECONDS = 0.5;
const VIDEO_MAX_STEPS = 600;
const VIDEO_TIMESTAMP_JITTER_SEC = 0.5;

const CLIENT_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36';

function retryAfterHeaderValue(headers: unknown): string | undefined {
	if (!headers || typeof headers !== 'object') {
		return undefined;
	}
	const h = headers as Record<string, unknown> & { get?: (name: string) => string | undefined };
	if (typeof h.get === 'function') {
		const v = h.get('retry-after');
		if (typeof v === 'string') {
			return v;
		}
	}
	const raw = h['retry-after'] ?? h['Retry-After'];
	if (typeof raw === 'string') {
		return raw;
	}
	if (Array.isArray(raw) && typeof raw[0] === 'string') {
		return raw[0];
	}
	return undefined;
}

function retryAfterMs(headers: unknown): number {
	const ra = retryAfterHeaderValue(headers);
	if (!ra) {
		return RETRY_AFTER_DEFAULT_MS;
	}
	const sec = Number(ra);
	if (Number.isFinite(sec)) {
		return Math.min(RETRY_AFTER_MAX_MS, Math.max(RETRY_AFTER_MIN_MS, sec * SECOND_MS));
	}
	const d = Date.parse(ra);
	if (Number.isFinite(d)) {
		return Math.min(RETRY_AFTER_MAX_MS, Math.max(RETRY_AFTER_MIN_MS, d - Date.now()));
	}
	return RETRY_AFTER_DEFAULT_MS;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function encodeSuperProperties(): string {
	const payload = {
		os: 'Windows',
		browser: 'Chrome',
		device: '',
		system_locale: 'en',
		has_client_mods: false,
		browser_user_agent: CLIENT_USER_AGENT,
		browser_version: '142.0.0.0',
		os_version: '10',
		referrer: '',
		referring_domain: '',
		referrer_current: 'https://discord.com/',
		referring_domain_current: 'discord.com',
		release_channel: 'stable',
		client_build_number: 971383,
		client_event_source: null as null
	};
	return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function discordQuestRequestHeaders(userToken: string): Record<string, string> {
	const t = userToken.trim();
	return {
		Authorization: t,
		Accept: '*/*',
		'Accept-Language': 'en,en-US;q=0.9',
		'Content-Type': 'application/json',
		'User-Agent': CLIENT_USER_AGENT,
		Origin: 'https://discord.com',
		Referer: 'https://discord.com/quest-home',
		Priority: 'u=1, i',
		'Sec-CH-UA': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
		'Sec-CH-UA-Mobile': '?0',
		'Sec-CH-UA-Platform': '"Windows"',
		'Sec-Fetch-Dest': 'empty',
		'Sec-Fetch-Mode': 'cors',
		'Sec-Fetch-Site': 'same-origin',
		'X-Debug-Options': 'bugReporterEnabled',
		'X-Discord-Locale': 'en-US',
		'X-Discord-Timezone': 'Asia/Singapore',
		'X-Super-Properties': encodeSuperProperties()
	};
}

const TASK_KEY_PRIORITY = [
	'WATCH_VIDEO',
	'WATCH_VIDEO_ON_MOBILE',
	'PLAY_ON_DESKTOP',
	'PLAY_ON_DESKTOP_V2',
	'PLAY_ON_XBOX',
	'PLAY_ON_PLAYSTATION',
	'STREAM_ON_DESKTOP',
	'PLAY_ACTIVITY',
	'ACHIEVEMENT_IN_ACTIVITY',
	'ACHIEVEMENT_IN_GAME'
] as const;

const TASK_KEY_LABELS: Record<string, string> = {
	WATCH_VIDEO: 'Watch video',
	WATCH_VIDEO_ON_MOBILE: 'Watch video (mobile)',
	PLAY_ON_DESKTOP: 'Play on desktop',
	PLAY_ON_DESKTOP_V2: 'Play on desktop',
	PLAY_ON_XBOX: 'Play on Xbox',
	PLAY_ON_PLAYSTATION: 'Play on PlayStation',
	STREAM_ON_DESKTOP: 'Stream on desktop',
	PLAY_ACTIVITY: 'Activity',
	ACHIEVEMENT_IN_ACTIVITY: 'Achievement in activity',
	ACHIEVEMENT_IN_GAME: 'Achievement in game'
};

export type DiscordQuestSummary = {
	id: string;
	questName: string;
	gameTitle: string;
	questUrl: string;
	startsAt: string;
	expiresAt: string;
	reward: string;
	taskTypeKey: string;
	taskTypeLabel: string;
	publisher: string;
	gameSubtitle: string;
	questDescription: string;
	thumbnailUrl: string | null;
	bannerUrl: string | null;
};

function taskConfigV2Tasks(cfg: Record<string, unknown>): Record<string, unknown> | null {
	const v2 = cfg.task_config_v2;
	if (!v2 || typeof v2 !== 'object') {
		return null;
	}
	const { tasks } = v2 as Record<string, unknown>;
	if (!tasks || typeof tasks !== 'object') {
		return null;
	}
	return tasks as Record<string, unknown>;
}

function primaryTaskKeyFromConfig(cfg: Record<string, unknown>): string {
	const tasks = taskConfigV2Tasks(cfg);
	if (!tasks) {
		return '';
	}
	for (const k of TASK_KEY_PRIORITY) {
		const t = tasks[k];
		if (t != null && typeof t === 'object') {
			return k;
		}
	}
	for (const k of Object.keys(tasks)) {
		const t = tasks[k];
		if (t != null && typeof t === 'object') {
			return k;
		}
	}
	return '';
}

export function questTaskLabel(key: string): string {
	return labelForTaskKey(key);
}

function labelForTaskKey(key: string): string {
	if (!key) {
		return 'Quest';
	}
	if (TASK_KEY_LABELS[key]) {
		return TASK_KEY_LABELS[key];
	}
	return key
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

function asStr(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

function asNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) {
		return v;
	}
	if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
		return Number(v);
	}
	return null;
}

const HTTPS_IMAGE_RE = /^https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s]*)?$/i;
const DISCORD_CDN_RE = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/\S+$/i;

function collectHttpsImageUrls(obj: unknown, depth: number, out: Set<string>): void {
	if (depth > IMAGE_URL_SCAN_MAX_DEPTH || obj == null) {
		return;
	}
	if (typeof obj === 'string') {
		const s = obj.trim();
		if (HTTPS_IMAGE_RE.test(s) || DISCORD_CDN_RE.test(s)) {
			out.add(s);
		}
		return;
	}
	if (typeof obj !== 'object') {
		return;
	}
	if (Array.isArray(obj)) {
		for (const x of obj) {
			collectHttpsImageUrls(x, depth + 1, out);
		}
		return;
	}
	for (const v of Object.values(obj as Record<string, unknown>)) {
		collectHttpsImageUrls(v, depth + 1, out);
	}
}

function discordAppIconUrl(applicationId: string, iconHash: string): string | null {
	if (!applicationId || !iconHash) {
		return null;
	}
	const h = iconHash.trim();
	if (!h || h.startsWith('http')) {
		return h.startsWith('http') ? h : null;
	}
	const ext = h.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/app-icons/${applicationId}/${h}.${ext}?size=256`;
}

function discordAppCoverUrl(applicationId: string, hash: string): string | null {
	if (!applicationId || !hash) {
		return null;
	}
	const h = hash.trim();
	if (!h || h.startsWith('http')) {
		return h.startsWith('http') ? h : null;
	}
	const ext = h.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/app-assets/${applicationId}/${h}.${ext}?size=600`;
}

function resolveApplicationId(cfg: Record<string, unknown>): string {
	const raw = cfg.application;
	if (typeof raw === 'string' && raw.trim()) {
		return raw.trim();
	}
	if (raw && typeof raw === 'object') {
		const id = asStr((raw as Record<string, unknown>).id);
		if (id) {
			return id;
		}
	}
	return asStr(cfg.application_id) || asStr(cfg.target_application_id);
}

function readApplicationIconHash(app: Record<string, unknown> | null, cfg: Record<string, unknown>): string {
	if (app) {
		const h = asStr(app.icon) || asStr(app.icon_hash);
		if (h) {
			return h;
		}
	}
	return asStr(cfg.application_icon) || asStr(cfg.icon);
}

function mediaFromApplication(cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	const appId = resolveApplicationId(cfg);
	if (!appId) {
		return { thumb: null, banner: null };
	}

	const app = cfg.application;
	const appObj = app && typeof app === 'object' ? (app as Record<string, unknown>) : null;

	let thumb: string | null = null;
	const iconHash = readApplicationIconHash(appObj, cfg);
	if (iconHash) {
		thumb = discordAppIconUrl(appId, iconHash);
	}

	let banner: string | null = null;
	const cover = (appObj?.cover_image ?? cfg.cover_image) as unknown;
	if (typeof cover === 'string' && cover) {
		banner = discordAppCoverUrl(appId, cover);
	} else if (cover && typeof cover === 'object') {
		const u = asStr((cover as Record<string, unknown>).url);
		const h = asStr((cover as Record<string, unknown>).hash);
		banner = u || (h ? discordAppCoverUrl(appId, h) : null);
	}
	const splash = appObj ? asStr(appObj.splash) : asStr(cfg.splash);
	if (!banner && splash) {
		const ext = splash.startsWith('a_') ? 'gif' : 'jpg';
		banner = `https://cdn.discordapp.com/splashes/${appId}/${splash}.${ext}?size=512`;
	}
	return { thumb, banner };
}

function messageMediaUrl(applicationId: string, raw: string, kind: 'thumb' | 'banner'): string | null {
	const s = raw.trim();
	if (!s) {
		return null;
	}
	if (s.startsWith('http://') || s.startsWith('https://')) {
		return s;
	}
	if (!applicationId || /\s/.test(s)) {
		return null;
	}
	if (kind === 'banner') {
		const cover = discordAppCoverUrl(applicationId, s);
		if (cover) {
			return cover;
		}
		return discordAppIconUrl(applicationId, s);
	}
	const icon = discordAppIconUrl(applicationId, s);
	if (icon) {
		return icon;
	}
	return discordAppCoverUrl(applicationId, s);
}

const QUEST_ASSET_PATH_RE = /^quests\/[0-9]{5,}\//;

function questAssetPath(questId: string, raw: string): string | null {
	const s = raw.trim().replace(/^\/+/, '').replace(/\?.*$/, '');
	if (!s || /\s/.test(s) || s === 'PLACEHOLDER') {
		return null;
	}
	if (QUEST_ASSET_PATH_RE.test(s)) {
		return s;
	}
	if (!questId) {
		return null;
	}
	const file = s.replace(/^(?:quests\/)?[0-9]{5,}\//, '');
	return file ? `quests/${questId}/${file}` : null;
}

function questAssetUrl(questId: string, raw: string, kind: 'thumb' | 'banner'): string | null {
	const s = raw.trim().replace(/^\/+/, '');
	if (!s) {
		return null;
	}
	if (s.startsWith('http://') || s.startsWith('https://')) {
		return s;
	}
	const path = questAssetPath(questId, s);
	if (!path) {
		return null;
	}
	const query = kind === 'banner' ? '?format=webp&width=1320&height=370' : '?size=256';
	return `https://cdn.discordapp.com/${path}${query}`;
}

const QUEST_VIDEO_RE = /\.(?:mp4|webm|mov)(?:\?|$)/i;
const QUEST_ASSET_FILE_RE = /(?:^|\/)[\w-]+\.(?:png|jpe?g|webp|gif)(?:\?|$)/i;
const QUEST_REWARD_ASSET_FILE_RE = /(?:^|\/)[\w-]+\.(?:png|jpe?g|webp|gif|mp4|webm|mov)(?:\?|$)/i;

const DISCORD_CONTENT_ASSET_RE = /^[0-9a-f]{32,}$/i;

function questRewardAssetUrl(questId: string, raw: string): string | null {
	const s = raw.trim().replace(/^\/+/, '');
	if (!s) {
		return null;
	}
	if (s.startsWith('http://') || s.startsWith('https://')) {
		return rewardMediaAsImage(s);
	}
	if (/\s/.test(s)) {
		return null;
	}

	const bare = s.replace(/\?.*$/, '');
	const stem = bare.replace(/\.[a-z0-9]+$/i, '');
	if (DISCORD_CONTENT_ASSET_RE.test(stem)) {
		const ext = bare.slice(stem.length) || '.png';
		return `https://cdn.discordapp.com/assets/content/${stem}${ext}?format=webp&width=256&height=256`;
	}

	const path = questAssetPath(questId, bare);
	if (!path) {
		return null;
	}
	return `https://cdn.discordapp.com/${path}?format=webp&width=256&height=256`;
}

function rewardMediaAsImage(url: string): string {
	if (!QUEST_VIDEO_RE.test(url)) {
		return url;
	}
	const [path, query = ''] = url.split('?');
	const params = new URLSearchParams(query);
	params.set('format', 'webp');
	if (!params.has('width')) {
		params.set('width', '256');
	}
	if (!params.has('height')) {
		params.set('height', '256');
	}
	return `${path}?${params.toString()}`;
}

const REWARD_ASSET_KEY_RE = /^(?:asset|assets|image|images|icon|tile|hero|art|artwork|thumbnail|asset_url|image_url|reward_tile|platforms_asset)$/i;

type RewardScan = { depth: number; out: string[]; keyed?: boolean };

function collectRewardAssetStrings(value: unknown, { depth, out, keyed: isKeyed = false }: RewardScan): void {
	if (depth > REWARD_ASSET_SCAN_MAX_DEPTH || value == null) {
		return;
	}
	if (typeof value === 'string') {
		const v = value.trim();
		if (v) {
			out.push(v);
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			collectRewardAssetStrings(item, { depth: depth + 1, out, keyed: isKeyed });
		}
		return;
	}
	if (typeof value !== 'object') {
		return;
	}
	for (const [k, val] of Object.entries(value as Record<string, unknown>)) {
		if (typeof val === 'string') {
			if (isKeyed || REWARD_ASSET_KEY_RE.test(k)) {
				collectRewardAssetStrings(val, { depth: depth + 1, out, keyed: isKeyed });
			}
			continue;
		}
		collectRewardAssetStrings(val, { depth: depth + 1, out, keyed: isKeyed });
	}
}

function rewardTileFromQuest(questId: string, quest: Record<string, unknown>, cfg: Record<string, unknown>): string | null {
	const candidates: string[] = [];

	for (const r of rewardListFromQuest(quest)) {
		const rec = r as Record<string, unknown>;
		if (!rec || typeof rec !== 'object') {
			continue;
		}
		for (const k of ['asset', 'assets', 'image', 'icon', 'tile', 'asset_url', 'image_url', 'orb_asset', 'reward_asset', 'tile_asset']) {
			collectRewardAssetStrings(rec[k], { depth: 0, out: candidates, keyed: true });
		}
		collectRewardAssetStrings(rec.messages, { depth: 0, out: candidates });
	}

	const rewardsCfg = (cfg.rewards_config ?? {}) as Record<string, unknown>;
	for (const k of ['assets', 'asset', 'platforms_asset', 'reward_tile', 'hero']) {
		collectRewardAssetStrings(rewardsCfg[k], { depth: 0, out: candidates, keyed: true });
	}

	const assets = (cfg.assets ?? {}) as Record<string, unknown>;
	for (const [k, val] of Object.entries(assets)) {
		if (!/reward/i.test(k)) {
			continue;
		}
		collectRewardAssetStrings(val, { depth: 0, out: candidates, keyed: true });
	}

	for (const c of candidates) {
		const bare = c.replace(/\?.*$/, '').replace(/\.[a-z0-9]+$/i, '');
		if (!QUEST_REWARD_ASSET_FILE_RE.test(c) && !c.startsWith('http') && !DISCORD_CONTENT_ASSET_RE.test(bare)) {
			continue;
		}
		const u = questRewardAssetUrl(questId, c);
		if (u) {
			return u;
		}
	}
	return null;
}

function mediaFromQuestAssets(questId: string, cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	const raw = cfg.assets;
	if (!raw || typeof raw !== 'object') {
		return { thumb: null, banner: null };
	}
	const assets = raw as Record<string, unknown>;

	const usable = (v: string) => v && !QUEST_VIDEO_RE.test(v) && (QUEST_ASSET_FILE_RE.test(v) || v.startsWith('http'));
	const pick = (kind: 'thumb' | 'banner', ...keys: string[]) => {
		for (const k of keys) {
			const v = asStr(assets[k]);
			if (!usable(v)) {
				continue;
			}
			const u = questAssetUrl(questId, v, kind);
			if (u) {
				return u;
			}
		}
		return null;
	};

	const byKey = (kind: 'thumb' | 'banner', re: RegExp, skip: string | null) => {
		for (const [k, val] of Object.entries(assets)) {
			if (!re.test(k)) {
				continue;
			}
			const v = asStr(val);
			if (!usable(v) || v === skip) {
				continue;
			}
			const u = questAssetUrl(questId, v, kind);
			if (u) {
				return u;
			}
		}
		return null;
	};

	const banner = pick('banner', 'hero', 'quest_bar_hero', 'bar_hero') || byKey('banner', /hero|banner|background|cover|tile/i, null);
	const bannerFile = banner ? (banner.split('/').pop() ?? '').split('?')[0] : null;
	const thumb =
		pick('thumb', 'logotype_dark', 'logotype_light', 'game_tile_dark', 'game_tile_light', 'game_tile', 'logotype', 'gamelogo', 'game_logo', 'quest_bar_logo') ||
		byKey('thumb', /logo|icon|tile|badge/i, bannerFile);

	return { banner, thumb: thumb === banner ? null : thumb };
}

function resolveQuestBannerAndThumb(questId: string, cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	const fromAssets = mediaFromQuestAssets(questId, cfg);
	const fromApp = mediaFromApplication(cfg);
	const appId = resolveApplicationId(cfg);
	const m = cfg.messages as Record<string, unknown> | undefined;
	const tryMsg = (kind: 'thumb' | 'banner', ...keys: string[]) => {
		for (const k of keys) {
			const raw = asStr(m?.[k]);
			if (!raw) {
				continue;
			}
			const u = messageMediaUrl(appId, raw, kind);
			if (u) {
				return u;
			}
		}
		return '';
	};
	const explicitThumb = tryMsg('thumb', 'character_artwork', 'game_icon', 'publisher_icon', 'quest_bar_artwork', 'application_icon') || '';
	const explicitBanner = tryMsg('banner', 'game_artwork', 'quest_artwork', 'hero_artwork', 'banner_artwork', 'quest_banner', 'splash_artwork') || '';

	const urlSet = new Set<string>();
	collectHttpsImageUrls(cfg, 0, urlSet);
	const list = [...urlSet];

	const rankBanner = (u: string) => {
		let s = 0;
		if (/banner|hero|splash|artwork|cover|wide|game_art|quest_art/i.test(u)) {
			s += URL_KEYWORD_SCORE;
		}
		return s + Math.min(u.length, URL_LENGTH_SCORE_CAP) / URL_LENGTH_SCORE_DIVISOR;
	};
	const rankThumb = (u: string) => {
		let s = 0;
		if (/icon|logo|thumb|avatar|character|bar/i.test(u) || QUEST_ASSET_TOKEN_RE.test(u)) {
			s += URL_KEYWORD_SCORE;
		}
		return s;
	};

	let bannerPick = fromAssets.banner || explicitBanner || fromApp.banner || null;
	if (!bannerPick && list.length) {
		bannerPick = [...list].sort((a, b) => rankBanner(b) - rankBanner(a))[0] ?? null;
	}

	let thumbPick = fromAssets.thumb || explicitThumb || fromApp.thumb || null;
	if (!thumbPick && list.length) {
		const candidates = list.filter((u) => u !== bannerPick);
		thumbPick = candidates.sort((a, b) => rankThumb(b) - rankThumb(a))[0] ?? null;
	}

	if (thumbPick && bannerPick && thumbPick === bannerPick) {
		const alt = list.find((u) => u !== bannerPick);
		thumbPick = alt || fromApp.thumb;
	}

	if (!bannerPick && thumbPick) {
		bannerPick = thumbPick;
		thumbPick = fromApp.thumb && fromApp.thumb !== bannerPick ? fromApp.thumb : null;
	}

	return { thumb: thumbPick, banner: bannerPick };
}

function primaryTaskObject(cfg: Record<string, unknown>): { key: string; obj: Record<string, unknown> } | null {
	const tasks = taskConfigV2Tasks(cfg);
	if (!tasks) {
		return null;
	}
	const key = primaryTaskKeyFromConfig(cfg);
	if (!key) {
		return null;
	}
	const obj = tasks[key];
	if (!obj || typeof obj !== 'object') {
		return null;
	}
	return { key, obj: obj as Record<string, unknown> };
}

function taskTargetFromTaskObj(taskKey: string, taskObj: Record<string, unknown>): { target: number | null; unit: string } {
	const sec = asNum(taskObj.target_seconds) ?? asNum(taskObj.duration_seconds) ?? asNum(taskObj.seconds_to_watch) ?? asNum(taskObj.watch_time_seconds);
	if (sec != null) {
		return { target: sec, unit: 'seconds' };
	}
	const min = asNum(taskObj.target_minutes) ?? asNum(taskObj.duration_minutes) ?? asNum(taskObj.minutes);
	if (min != null) {
		return { target: min * MINUTE_SECONDS, unit: 'seconds' };
	}
	const generic = asNum(taskObj.target) ?? asNum(taskObj.goal) ?? asNum(taskObj.max);
	if (generic != null) {
		const unitRaw = asStr(taskObj.target_unit).toLowerCase();
		if (unitRaw.includes('minute')) {
			return { target: generic * MINUTE_SECONDS, unit: 'seconds' };
		}
		if (unitRaw.includes('hour')) {
			return { target: generic * HOUR_SECONDS, unit: 'seconds' };
		}
		if (unitRaw.includes('second')) {
			return { target: generic, unit: 'seconds' };
		}
		return { target: generic, unit: taskKey.includes('VIDEO') || taskKey.includes('WATCH') ? 'seconds' : 'steps' };
	}
	return { target: null, unit: 'seconds' };
}

function buildTaskDetailLine(taskKey: string, taskLabel: string, taskObj: Record<string, unknown>): string {
	const messages = taskObj.messages as Record<string, unknown> | undefined;
	const custom = asStr(messages?.title) || asStr(messages?.body) || asStr(messages?.description) || asStr(messages?.subtitle) || asStr(messages?.cta);
	if (custom && custom.length <= TASK_DETAIL_MAX_LENGTH) {
		return custom;
	}

	const { target, unit } = taskTargetFromTaskObj(taskKey, taskObj);
	if (target != null && unit === 'seconds') {
		if (taskKey.includes('VIDEO') || taskKey.includes('WATCH')) {
			const wholeMin = Math.round(target / SECONDS_PER_MINUTE);
			if (wholeMin >= 1 && Math.abs(target - wholeMin * MINUTE_SECONDS) <= WHOLE_MINUTE_TOLERANCE_SECONDS) {
				return `${taskLabel} for ${wholeMin} minute${wholeMin === 1 ? '' : 's'}`;
			}
			return `${taskLabel} for ${target} seconds`;
		}
		return `${taskLabel} · ${target} seconds`;
	}
	if (target != null) {
		return `${taskLabel} · target ${target}`;
	}
	return taskLabel;
}

const DISCORD_QUEST_REWARD_QTY_FIELD = '\u006f\u0072\u0062_quantity';
const QUEST_REWARD_FALLBACK = 'Quest reward';
const QUEST_CURRENCY_LABEL = 'Discord quest currency';

export type QuestRewardPart = { kind: 'currency'; quantity: number } | { kind: 'name'; name: string };

export function parseQuestRewardLine(line: unknown): QuestRewardPart[] {
	const text = String(line ?? '')
		.replace(/^•\s*/, '')
		.trim();
	if (!text || text === QUEST_REWARD_FALLBACK) {
		return [];
	}
	const currency = new RegExp(`^(\\d+)× ${QUEST_CURRENCY_LABEL}$`);
	return text.split(' · ').map((part) => {
		const m = currency.exec(part);
		return m ? { kind: 'currency', quantity: Number(m[1]) } : { kind: 'name', name: part };
	});
}

export type QuestTaskLine =
	| { kind: 'label' }
	| { kind: 'minutes'; value: number }
	| { kind: 'seconds'; value: number }
	| { kind: 'secondsTarget'; value: number }
	| { kind: 'target'; value: number }
	| { kind: 'custom'; text: string };

export function parseQuestTaskLine(line: unknown, taskKey: string): QuestTaskLine {
	const label = labelForTaskKey(taskKey);
	const text = String(line ?? '').trim();
	if (!text || text === label) {
		return { kind: 'label' };
	}
	const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const shapes: [QuestTaskLine['kind'], RegExp][] = [
		['minutes', new RegExp(`^${esc} for (\\d+) minutes?$`)],
		['seconds', new RegExp(`^${esc} for (\\d+(?:\\.\\d+)?) seconds$`)],
		['secondsTarget', new RegExp(`^${esc} · (\\d+(?:\\.\\d+)?) seconds$`)],
		['target', new RegExp(`^${esc} · target (\\d+(?:\\.\\d+)?)$`)]
	];
	for (const [kind, re] of shapes) {
		const m = re.exec(text);
		if (m) {
			return { kind, value: Number(m[1]) } as QuestTaskLine;
		}
	}
	return { kind: 'custom', text };
}

function rewardLineFromQuest(quest: Record<string, unknown>): string {
	const rewards = rewardListFromQuest(quest);
	if (rewards.length === 0) {
		return QUEST_REWARD_FALLBACK;
	}
	const parts: string[] = [];
	for (const r of rewards) {
		const rec = r as Record<string, unknown>;
		const qty = rec[DISCORD_QUEST_REWARD_QTY_FIELD];
		if (typeof qty === 'number' && qty > 0) {
			parts.push(`${qty}× ${QUEST_CURRENCY_LABEL}`);
			continue;
		}
		const nm = (rec.messages as Record<string, unknown> | undefined)?.name;
		if (typeof nm === 'string' && nm.trim()) {
			parts.push(nm.trim());
			continue;
		}
		const typeStr =
			typeof rec.type === 'string'
				? rec.type
				: typeof rec.reward_type === 'string'
					? rec.reward_type
					: typeof rec.rewardType === 'string'
						? rec.rewardType
						: '';
		if (typeStr) {
			parts.push(typeStr);
		}
	}
	return parts.length ? [...new Set(parts)].join(' · ') : QUEST_REWARD_FALLBACK;
}

function rewardListFromQuest(quest: Record<string, unknown>): unknown[] {
	const cfg = quest.config as Record<string, unknown> | undefined;
	const fromConfig = cfg?.rewards_config as Record<string, unknown> | undefined;
	const a = fromConfig?.rewards;
	if (Array.isArray(a)) {
		return a;
	}
	const top = quest.rewards_config as Record<string, unknown> | undefined;
	const b = top?.rewards;
	if (Array.isArray(b)) {
		return b;
	}
	const direct = cfg?.rewards;
	if (Array.isArray(direct)) {
		return direct;
	}
	return [];
}

function questExpired(quest: Record<string, unknown>): boolean {
	const expires = (quest.config as Record<string, unknown> | undefined)?.expires_at;
	if (typeof expires !== 'string') {
		return false;
	}
	const t = Date.parse(expires);
	return Number.isFinite(t) && t < Date.now();
}

function toDiscordQuestSummary(quest: Record<string, unknown>): DiscordQuestSummary {
	const id = String(quest.id ?? '');
	const cfg = (quest.config ?? {}) as Record<string, unknown>;
	const messages = (cfg.messages ?? {}) as Record<string, unknown>;
	const questName = typeof messages.quest_name === 'string' ? messages.quest_name : 'Discord Quest';
	const gameTitle = typeof messages.game_title === 'string' ? messages.game_title : 'Quest';
	const gameSubtitle = asStr(messages.game_name) || asStr(messages.promo_title) || asStr(messages.subtitle) || asStr(messages.secondary_title);
	const startsAt = typeof cfg.starts_at === 'string' ? cfg.starts_at : '';
	const expiresAt = typeof cfg.expires_at === 'string' ? cfg.expires_at : '';
	const reward = rewardLineFromQuest(quest);
	const taskTypeKey = primaryTaskKeyFromConfig(cfg);
	const taskTypeLabel = labelForTaskKey(taskTypeKey);
	const publisher =
		asStr(messages.publisher_name) ||
		asStr(messages.game_publisher) ||
		asStr(messages.publisher) ||
		asStr(messages.brand_name) ||
		asStr(messages.developer_name) ||
		asStr(messages.studio_name) ||
		asStr(messages.company_name) ||
		asStr(messages.vendor_name);

	const pt = primaryTaskObject(cfg);
	const taskObj = pt?.obj ?? {};
	const questDescription = pt ? buildTaskDetailLine(pt.key, taskTypeLabel, taskObj) : taskTypeLabel;

	const { banner, thumb } = resolveQuestBannerAndThumb(id, cfg);
	const rewardTile = rewardTileFromQuest(id, quest, cfg);

	return {
		id,
		questName,
		gameTitle,
		questUrl: `https://discord.com/quests/${id}`,
		startsAt,
		expiresAt,
		reward,
		taskTypeKey,
		taskTypeLabel,
		publisher,
		gameSubtitle,
		questDescription,
		thumbnailUrl: rewardTile ?? thumb,
		bannerUrl: banner
	};
}

export function extractDiscordQuestSummaries(payload: unknown): DiscordQuestSummary[] {
	if (!payload || typeof payload !== 'object') {
		return [];
	}
	const { quests } = payload as Record<string, unknown>;
	if (!Array.isArray(quests)) {
		return [];
	}
	const out: DiscordQuestSummary[] = [];
	for (const q of quests) {
		if (!q || typeof q !== 'object') {
			continue;
		}
		const rec = q as Record<string, unknown>;
		if (rec.preview === true) {
			continue;
		}
		if (questExpired(rec)) {
			continue;
		}
		out.push(toDiscordQuestSummary(rec));
	}
	out.sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || ''));
	return out;
}

type QuestApiCall = { method: 'GET' | 'POST' | 'DELETE'; path: string; body?: unknown };

async function questApiRequest(userToken: string, { method, path, body }: QuestApiCall): Promise<{ status: number; data: unknown }> {
	const headers = discordQuestRequestHeaders(userToken);
	const url = path.startsWith('http') ? path : `${discordQuestHttp.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await axios({
			method,
			url,
			headers,
			data: body === undefined ? undefined : body,
			validateStatus: () => true
		});

		if (res.status === HTTP.TOO_MANY_REQUESTS && attempt < maxAttempts) {
			await sleep(retryAfterMs(res.headers));
			continue;
		}

		let data: unknown = res.data;
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data) as unknown;
			} catch {}
		}
		return { status: res.status, data };
	}
	return { status: HTTP.NETWORK_TIMEOUT, data: null };
}

export async function fetchQuestsMe(userToken: string): Promise<unknown> {
	const maxAttempts = 3;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await questApiRequest(userToken, { method: 'GET', path: discordQuestHttp.paths.questsMe });

		if (res.status === HTTP.TOO_MANY_REQUESTS && attempt < maxAttempts) {
			await sleep(RATE_LIMIT_BACKOFF_MS);
			continue;
		}

		if (res.status !== HTTP.OK) {
			let err = `Discord API ${res.status}`;
			const { data } = res;
			if (data && typeof data === 'object' && typeof (data as Record<string, unknown>).message === 'string') {
				err += `: ${(data as Record<string, unknown>).message}`;
			} else if (typeof data === 'string' && data) {
				err += `: ${data.slice(0, ERROR_BODY_PREVIEW_LENGTH)}`;
			}
			throw new Error(err);
		}

		return res.data;
	}
	throw new Error('Discord quests request failed');
}

function findQuestByIdInPayload(payload: unknown, questId: string): Record<string, unknown> | null {
	if (!payload || typeof payload !== 'object') {
		return null;
	}
	const { quests } = payload as Record<string, unknown>;
	if (!Array.isArray(quests)) {
		return null;
	}
	for (const q of quests) {
		if (q && typeof q === 'object' && String((q as Record<string, unknown>).id) === String(questId)) {
			return q as Record<string, unknown>;
		}
	}
	return null;
}

function getQuestUserStatus(quest: Record<string, unknown>): Record<string, unknown> | null {
	const a = quest.user_status;
	const b = quest.userStatus;
	const v = (typeof a === 'object' && a) || (typeof b === 'object' && b);
	return v ? (v as Record<string, unknown>) : null;
}

function readProgressSeconds(quest: Record<string, unknown>, taskKey: string): number {
	const us = getQuestUserStatus(quest);
	if (!us) {
		return 0;
	}
	const p = us.progress as Record<string, unknown> | undefined;
	if (!p || typeof p !== 'object') {
		return 0;
	}
	const t = p[taskKey] as Record<string, unknown> | undefined;
	if (t && typeof t.value === 'number') {
		return t.value;
	}
	return 0;
}

function extractProgressFromHeartbeatPayload(data: unknown, taskKey: string): { value: number; completed: boolean } {
	if (!data || typeof data !== 'object') {
		return { value: 0, completed: false };
	}
	const d = data as Record<string, unknown>;
	const p = d.progress;
	if (p && typeof p === 'object') {
		const t = (p as Record<string, unknown>)[taskKey];
		if (t && typeof t === 'object') {
			const tr = t as Record<string, unknown>;
			const value = typeof tr.value === 'number' ? tr.value : 0;
			const isCompleted = tr.completed_at != null || tr.completedAt != null;
			return { value, completed: isCompleted };
		}
	}
	return { value: 0, completed: false };
}

function heartbeatResponseOk(data: unknown): boolean {
	if (!data || typeof data !== 'object') {
		return false;
	}
	return (data as Record<string, unknown>).user_id != null;
}

function heartbeatDurationTargetSec(taskKey: string, taskObj: Record<string, unknown>): number | null {
	const explicit = asNum(taskObj.target_seconds) ?? asNum(taskObj.duration_seconds) ?? asNum(taskObj.seconds_to_watch) ?? asNum(taskObj.watch_time_seconds);
	if (explicit != null && explicit > 0) {
		return explicit;
	}
	const min = asNum(taskObj.target_minutes) ?? asNum(taskObj.duration_minutes) ?? asNum(taskObj.minutes);
	if (min != null && min > 0) {
		return min * MINUTE_SECONDS;
	}
	const generic = asNum(taskObj.target) ?? asNum(taskObj.goal) ?? asNum(taskObj.max);
	if (generic == null || generic <= 0) {
		return null;
	}
	const unitRaw = asStr(taskObj.target_unit).toLowerCase();
	if (unitRaw.includes('minute')) {
		return generic * MINUTE_SECONDS;
	}
	if (unitRaw.includes('hour')) {
		return generic * HOUR_SECONDS;
	}
	if (unitRaw.includes('second')) {
		return generic;
	}
	const isDurationish =
		taskKey === 'WATCH_VIDEO' ||
		taskKey === 'WATCH_VIDEO_ON_MOBILE' ||
		taskKey.startsWith('PLAY_ON_') ||
		taskKey.startsWith('STREAM_') ||
		taskKey === 'PLAY_ACTIVITY';
	if (isDurationish) {
		return generic;
	}
	return null;
}

function achievementProgressTarget(taskObj: Record<string, unknown>): number | null {
	const t = asNum(taskObj.target) ?? asNum(taskObj.goal);
	return t != null && t > 0 ? t : null;
}

function discordUserIdFromToken(userToken: string): string | null {
	const parts = userToken.trim().split('.');
	if (parts.length < 2) {
		return null;
	}
	try {
		let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const pad = (BASE64_BLOCK_LENGTH - (b64.length % BASE64_BLOCK_LENGTH)) % BASE64_BLOCK_LENGTH;
		b64 += '='.repeat(pad);
		const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
		const id = payload.id ?? payload.user_id;
		return typeof id === 'string' ? id : null;
	} catch {
		return null;
	}
}

async function discordUserIdFromUserToken(userToken: string): Promise<string | null> {
	const fromJwt = discordUserIdFromToken(userToken);
	if (fromJwt) {
		return fromJwt;
	}
	const res = await questApiRequest(userToken, { method: 'GET', path: discordQuestHttp.paths.usersMe });
	if (res.status !== HTTP.OK || !res.data || typeof res.data !== 'object') {
		return null;
	}
	const { id } = res.data as Record<string, unknown>;
	return typeof id === 'string' ? id : null;
}

type QuestTaskRef = { questId: string; taskKey: string };

async function runQuestHeartbeatUntilDone(
	userToken: string,
	{ questId, taskKey }: QuestTaskRef,
	config: {
		knownTargetSec: number | null;
		intervalMs: number;
		makeBody: (isTerminal: boolean) => Record<string, unknown>;
	}
): Promise<{ sawTaskComplete: boolean; reachedTarget: boolean; lastError: string }> {
	const { knownTargetSec, intervalMs, makeBody } = config;
	const secPerTick = Math.max(1, intervalMs / SECOND_MS);
	const maxIters =
		knownTargetSec != null
			? Math.min(HEARTBEAT_MAX_ITERATIONS, Math.max(HEARTBEAT_MIN_ITERATIONS, Math.ceil(knownTargetSec / secPerTick) * 2 + HEARTBEAT_EXTRA_ITERATIONS))
			: HEARTBEAT_DEFAULT_ITERATIONS;
	let lastError = '';
	let hasSeenTaskComplete = false;
	let hasReachedTarget = false;

	for (let i = 0; i < maxIters; i++) {
		const hb = await questApiRequest(userToken, { method: 'POST', path: `/quests/${questId}/heartbeat`, body: makeBody(false) });
		const body = hb.data && typeof hb.data === 'object' ? (hb.data as Record<string, unknown>) : null;

		if (!heartbeatResponseOk(hb.data)) {
			lastError = body?.message && typeof body.message === 'string' ? body.message : `HTTP ${hb.status}`;
			break;
		}

		const slice = extractProgressFromHeartbeatPayload(hb.data, taskKey);
		if (slice.completed) {
			hasSeenTaskComplete = true;
			break;
		}
		if (knownTargetSec != null && slice.value >= knownTargetSec - PROGRESS_TOLERANCE_SECONDS) {
			hasReachedTarget = true;
			break;
		}

		await sleep(intervalMs);
	}

	if (hasSeenTaskComplete || hasReachedTarget) {
		await questApiRequest(userToken, { method: 'POST', path: `/quests/${questId}/heartbeat`, body: makeBody(true) });
	}

	return { sawTaskComplete: hasSeenTaskComplete, reachedTarget: hasReachedTarget, lastError };
}

const SAYS_HEADERS = { 'User-Agent': CLIENT_USER_AGENT, 'Content-Type': 'application/json' };

async function authorizeSaysApp(userToken: string, applicationId: string): Promise<string | null> {
	const authQuery = new URLSearchParams({
		response_type: 'code',
		client_id: applicationId,
		scope: 'identify applications.commands applications.entitlements',
		state: ''
	});
	const authRes = await questApiRequest(userToken, {
		method: 'POST',
		path: `/oauth2/authorize?${authQuery.toString()}`,
		body: { permissions: '0', authorize: true, integration_type: 1, location_context: { guild_id: '10000', channel_id: '10000', channel_type: 10000 } }
	});
	const authBody = authRes.data && typeof authRes.data === 'object' ? (authRes.data as Record<string, unknown>) : null;
	const location = typeof authBody?.location === 'string' ? authBody.location : '';
	if (!location) {
		return null;
	}
	const parsed = attemptSync(() => new URL(location).searchParams.get('code'));
	return parsed.ok ? parsed.value : null;
}

async function saysToken(applicationId: string, authCode: string): Promise<{ token: string | null; status: number }> {
	const saysAuth = await axios({
		method: 'POST',
		url: `https://${applicationId}.discordsays.com/.proxy/acf/authorize`,
		data: { code: authCode },
		headers: SAYS_HEADERS,
		validateStatus: () => true
	});
	const isOk = isHttpSuccess(saysAuth.status) && saysAuth.data && typeof saysAuth.data === 'object';
	const token = isOk ? (saysAuth.data as Record<string, unknown>).token : null;
	return { token: typeof token === 'string' ? token : null, status: saysAuth.status };
}

async function revokeSaysToken(userToken: string, applicationId: string) {
	const tokensRes = await questApiRequest(userToken, { method: 'GET', path: '/oauth2/tokens' });
	if (tokensRes.status !== HTTP.OK || !Array.isArray(tokensRes.data)) {
		return;
	}
	const tokenInfo = (tokensRes.data as Record<string, unknown>[]).find((t) => {
		const app = t && typeof t === 'object' ? (t.application as Record<string, unknown> | undefined) : undefined;
		return app != null && String(app.id) === String(applicationId);
	});
	const tid = tokenInfo && typeof tokenInfo.id === 'string' ? tokenInfo.id : null;
	if (tid) {
		await questApiRequest(userToken, { method: 'DELETE', path: `/oauth2/tokens/${tid}` });
	}
}

async function completeAchievementViaDiscordSays(userToken: string, applicationId: string, questTarget: number): Promise<{ ok: boolean; error: string }> {
	const authCode = await authorizeSaysApp(userToken, applicationId);
	if (!authCode) {
		return { ok: false, error: 'OAuth authorize did not return a code (achievement quests need a supported Discord Says app).' };
	}

	const says = await saysToken(applicationId, authCode);
	if (!says.token) {
		return { ok: false, error: `Discord Says authorize failed (HTTP ${says.status}).` };
	}

	const prog = await axios({
		method: 'POST',
		url: `https://${applicationId}.discordsays.com/.proxy/acf/quest/progress`,
		data: { progress: questTarget },
		headers: { ...SAYS_HEADERS, 'x-auth-token': says.token },
		validateStatus: () => true
	});
	if (!isHttpSuccess(prog.status)) {
		return { ok: false, error: `Discord Says progress failed (HTTP ${prog.status}).` };
	}

	await revokeSaysToken(userToken, applicationId);
	return { ok: true, error: '' };
}

function userQuestCompleted(quest: Record<string, unknown>): boolean {
	const us = getQuestUserStatus(quest);
	if (!us) {
		return false;
	}
	if (us.completed_at != null || us.completedAt != null) {
		return true;
	}
	return false;
}

function userQuestRewardClaimed(quest: Record<string, unknown>): boolean {
	const us = getQuestUserStatus(quest);
	if (!us) {
		return false;
	}
	if (us.reward_claimed === true || us.rewardClaimed === true) {
		return true;
	}
	if (us.reward_claimed_at != null || us.rewardClaimedAt != null) {
		return true;
	}
	if (us.claimed_at != null || us.claimedAt != null) {
		return true;
	}
	const rew = us.reward;
	if (rew && typeof rew === 'object') {
		const r = rew as Record<string, unknown>;
		if (r.claimed === true || r.claimed_at != null || r.claimedAt != null) {
			return true;
		}
	}
	return false;
}

export type QuestEnrollmentPrecheck = { ok: true } | { ok: false; code: 'not_found' | 'expired' | 'reward_claimed' | 'completed' };

export function precheckQuestPayloadForEnrollment(payload: unknown, questId: string): QuestEnrollmentPrecheck {
	const quest = findQuestByIdInPayload(payload, questId);
	if (!quest) {
		return { ok: false, code: 'not_found' };
	}
	if (questExpired(quest)) {
		return { ok: false, code: 'expired' };
	}
	if (userQuestRewardClaimed(quest)) {
		return { ok: false, code: 'reward_claimed' };
	}
	if (userQuestCompleted(quest)) {
		return { ok: false, code: 'completed' };
	}
	return { ok: true };
}

function enrolledAtMsFromQuest(quest: Record<string, unknown>): number {
	const us = getQuestUserStatus(quest);
	if (!us) {
		return Date.now();
	}
	const e = us.enrolled_at ?? us.enrolledAt;
	if (typeof e === 'string') {
		const t = Date.parse(e);
		if (Number.isFinite(t)) {
			return t;
		}
	}
	return Date.now();
}

export type QuestAutomationCode =
	| 'notFound'
	| 'expired'
	| 'alreadyComplete'
	| 'enrollFailed'
	| 'complete'
	| 'enrolledNoTask'
	| 'achievementMissing'
	| 'achievementDone'
	| 'achievementIncomplete'
	| 'activityNoUser'
	| 'activityDone'
	| 'activityIncomplete'
	| 'enrolledNeedsAppId'
	| 'platformDone'
	| 'platformIncomplete'
	| 'unsupportedTask'
	| 'videoNoDuration'
	| 'videoDone'
	| 'videoIncomplete';

export type QuestAutomationResult = {
	ok: boolean;
	questName: string;
	rewardLine: string;
	questUrl: string;
	code: QuestAutomationCode;
	taskKey?: string;
	error?: string;
	httpStatus?: number;
};

async function postVideoProgress(userToken: string, questId: string, timestamp: number): Promise<{ isComplete: boolean; error: string | null }> {
	const vp = await questApiRequest(userToken, { method: 'POST', path: `/quests/${questId}/video-progress`, body: { timestamp } });
	const body = vp.data && typeof vp.data === 'object' ? (vp.data as Record<string, unknown>) : null;
	if (body?.completed_at != null || body?.completedAt != null) {
		return { isComplete: true, error: null };
	}
	if (vp.status < HTTP.BAD_REQUEST) {
		return { isComplete: false, error: null };
	}
	const message = body?.message;
	return { isComplete: false, error: typeof message === 'string' ? `HTTP ${vp.status}: ${message}` : `HTTP ${vp.status}` };
}

type QuestOutcome = Omit<QuestAutomationResult, 'questName' | 'rewardLine' | 'questUrl'>;
type QuestTask = { key: string; obj: Record<string, unknown> };
type QuestRun = { token: string; questId: string; quest: Record<string, unknown>; cfg: Record<string, unknown>; task: QuestTask };
type QuestTaskKind = 'video' | 'achievement' | 'activity' | 'platform' | 'other';
type HeartbeatResult = Awaited<ReturnType<typeof runQuestHeartbeatUntilDone>>;

const VIDEO_TASKS = new Set(['WATCH_VIDEO', 'WATCH_VIDEO_ON_MOBILE']);
const ACHIEVEMENT_TASKS = new Set(['ACHIEVEMENT_IN_ACTIVITY', 'ACHIEVEMENT_IN_GAME']);
const PLATFORM_TASKS = new Set(['PLAY_ON_DESKTOP', 'PLAY_ON_DESKTOP_V2', 'PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION', 'STREAM_ON_DESKTOP']);
const STREAM_TASKS = new Set(['PLAY_ON_DESKTOP', 'PLAY_ON_DESKTOP_V2', 'STREAM_ON_DESKTOP']);
const VIDEO_MAX_FUTURE_SEC = 10;
const VIDEO_STEP_SEC = 7;

function questTaskKind(taskKey: string): QuestTaskKind {
	if (VIDEO_TASKS.has(taskKey)) {
		return 'video';
	}
	if (ACHIEVEMENT_TASKS.has(taskKey)) {
		return 'achievement';
	}
	if (taskKey === 'PLAY_ACTIVITY') {
		return 'activity';
	}
	return PLATFORM_TASKS.has(taskKey) ? 'platform' : 'other';
}

async function refreshQuest(token: string, questId: string, fallback: Record<string, unknown>) {
	return findQuestByIdInPayload(await fetchQuestsMe(token), questId) ?? fallback;
}

async function enrollInQuest(token: string, questId: string): Promise<QuestOutcome | null> {
	const enrollRes = await questApiRequest(token, {
		method: 'POST',
		path: `/quests/${questId}/enroll`,
		body: { location: 11, is_targeted: false, metadata_raw: null }
	});
	const isEnrollOk = isHttpSuccess(enrollRes.status);
	const enrollMsg =
		enrollRes.data && typeof enrollRes.data === 'object' && typeof (enrollRes.data as Record<string, unknown>).message === 'string'
			? String((enrollRes.data as Record<string, unknown>).message).toLowerCase()
			: '';
	const enrollBodyStr = JSON.stringify(enrollRes.data ?? '').toLowerCase();
	if (
		!isEnrollOk &&
		enrollRes.status !== HTTP.BAD_REQUEST &&
		enrollRes.status !== HTTP.CONFLICT &&
		!enrollMsg.includes('already') &&
		!enrollBodyStr.includes('already')
	) {
		return { ok: false, code: 'enrollFailed', httpStatus: enrollRes.status };
	}
	return null;
}

async function heartbeatFinished(run: QuestRun, hb: HeartbeatResult, knownTargetSec: number | null): Promise<boolean> {
	const quest = await refreshQuest(run.token, run.questId, run.quest);
	const finalProgress = readProgressSeconds(quest, run.task.key);
	return hb.sawTaskComplete || userQuestCompleted(quest) || (knownTargetSec != null && finalProgress >= knownTargetSec - PROGRESS_TOLERANCE_SECONDS);
}

async function runAchievementTask(run: QuestRun): Promise<QuestOutcome> {
	const applicationId = resolveApplicationId(run.cfg);
	const questTarget = achievementProgressTarget(run.task.obj);
	if (!applicationId || questTarget == null) {
		return { ok: false, code: 'achievementMissing', taskKey: run.task.key };
	}
	const ach = await completeAchievementViaDiscordSays(run.token, applicationId, questTarget);
	const quest = await refreshQuest(run.token, run.questId, run.quest);
	if (ach.ok || userQuestCompleted(quest)) {
		return { ok: true, code: 'achievementDone' };
	}
	return { ok: false, code: 'achievementIncomplete', error: ach.error };
}

async function runActivityTask(run: QuestRun): Promise<QuestOutcome> {
	const userId = await discordUserIdFromUserToken(run.token);
	if (!userId) {
		return { ok: false, code: 'activityNoUser' };
	}
	const knownTargetSec = heartbeatDurationTargetSec(run.task.key, run.task.obj);
	const streamKey = `call:${userId}:1`;
	const hb = await runQuestHeartbeatUntilDone(
		run.token,
		{ questId: run.questId, taskKey: run.task.key },
		{
			knownTargetSec,
			intervalMs: 20_000,
			makeBody: (isTerminal) => ({ stream_key: streamKey, terminal: isTerminal })
		}
	);
	if (await heartbeatFinished(run, hb, knownTargetSec)) {
		return { ok: true, code: 'activityDone' };
	}
	return { ok: false, code: 'activityIncomplete', error: hb.lastError };
}

async function runPlatformTask(run: QuestRun): Promise<QuestOutcome> {
	const taskKey = run.task.key;
	const knownTargetSec = heartbeatDurationTargetSec(taskKey, run.task.obj);
	const applicationId = resolveApplicationId(run.cfg);
	if (!applicationId && !STREAM_TASKS.has(taskKey)) {
		return { ok: true, code: 'enrolledNeedsAppId', taskKey };
	}

	const streamKey = `call:${run.questId}:1`;
	const hb = await runQuestHeartbeatUntilDone(
		run.token,
		{ questId: run.questId, taskKey },
		applicationId
			? { knownTargetSec, intervalMs: 20_000, makeBody: (isTerminal) => ({ application_id: applicationId, terminal: isTerminal }) }
			: { knownTargetSec, intervalMs: 30_000, makeBody: (isTerminal) => ({ stream_key: streamKey, terminal: isTerminal }) }
	);
	if (await heartbeatFinished(run, hb, knownTargetSec)) {
		return { ok: true, code: 'platformDone', taskKey };
	}
	return { ok: false, code: 'platformIncomplete', error: hb.lastError };
}

async function playVideoProgress(run: QuestRun, targetSec: number): Promise<string> {
	const enrolledAt = enrolledAtMsFromQuest(run.quest);
	let secondsDone = readProgressSeconds(run.quest, run.task.key);
	let lastError = '';

	for (let i = 0; i < VIDEO_MAX_STEPS && secondsDone < targetSec; i++) {
		const maxAllowed = Math.floor((Date.now() - enrolledAt) / SECOND_MS) + VIDEO_MAX_FUTURE_SEC;
		if (maxAllowed - secondsDone >= VIDEO_STEP_SEC) {
			const timestamp = Math.min(targetSec, secondsDone + VIDEO_STEP_SEC + Math.random() * VIDEO_TIMESTAMP_JITTER_SEC);
			const step = await postVideoProgress(run.token, run.questId, timestamp);
			if (step.isComplete) {
				break;
			}
			if (step.error) {
				lastError = step.error;
			} else {
				secondsDone = timestamp;
			}
		}
		await sleep(SECOND_MS);
	}
	return lastError;
}

async function runVideoTask(run: QuestRun): Promise<QuestOutcome> {
	const { target, unit } = taskTargetFromTaskObj(run.task.key, run.task.obj);
	const targetSec = unit === 'seconds' && target != null && target > 0 ? target : null;
	if (targetSec == null) {
		return { ok: false, code: 'videoNoDuration' };
	}

	const lastError = await playVideoProgress(run, targetSec);
	const quest = await refreshQuest(run.token, run.questId, run.quest);
	if (userQuestCompleted(quest) || readProgressSeconds(quest, run.task.key) >= targetSec - PROGRESS_TOLERANCE_SECONDS) {
		return { ok: true, code: 'videoDone' };
	}
	return { ok: false, code: 'videoIncomplete', error: lastError };
}

const QUEST_TASK_RUNNERS: Record<QuestTaskKind, (run: QuestRun) => Promise<QuestOutcome>> = {
	video: runVideoTask,
	achievement: runAchievementTask,
	activity: runActivityTask,
	platform: runPlatformTask,
	other: async (run) => ({ ok: true, code: 'unsupportedTask', taskKey: run.task.key })
};

async function automateQuest(token: string, questId: string, quest: Record<string, unknown>): Promise<QuestOutcome> {
	if (questExpired(quest)) {
		return { ok: false, code: 'expired' };
	}
	if (userQuestCompleted(quest)) {
		return { ok: true, code: 'alreadyComplete' };
	}

	const enrollFailure = await enrollInQuest(token, questId);
	if (enrollFailure) {
		return enrollFailure;
	}

	const live = await refreshQuest(token, questId, quest);
	if (userQuestCompleted(live)) {
		return { ok: true, code: 'complete' };
	}

	const cfg = (live.config ?? {}) as Record<string, unknown>;
	const task = primaryTaskObject(cfg);
	if (!task) {
		return { ok: true, code: 'enrolledNoTask' };
	}
	return QUEST_TASK_RUNNERS[questTaskKind(task.key)]({ token, questId, quest: live, cfg, task });
}

export async function runQuestUserAutomation(userToken: string, questId: string): Promise<QuestAutomationResult> {
	const questUrl = `https://discord.com/quests/${questId}`;
	let token = userToken.trim();
	const wipe = () => {
		token = '';
	};

	try {
		const quest = findQuestByIdInPayload(await fetchQuestsMe(token), questId);
		if (!quest) {
			return { ok: false, questName: 'Unknown quest', rewardLine: '', questUrl, code: 'notFound' };
		}

		const cfg = (quest.config ?? {}) as Record<string, unknown>;
		const messages = (cfg.messages ?? {}) as Record<string, unknown>;
		const questName = typeof messages.quest_name === 'string' ? messages.quest_name : `Quest ${questId}`;
		const rewardLine = rewardLineFromQuest(quest);
		const outcome = await automateQuest(token, questId, quest);
		return { questName, rewardLine, questUrl, ...outcome };
	} finally {
		wipe();
	}
}
