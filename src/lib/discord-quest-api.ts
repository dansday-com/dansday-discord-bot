import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

const DISCORD_API_V9 = 'https://discord.com/api/v9';
const QUESTS_ME_URL = `${DISCORD_API_V9}/quests/@me`;

const CLIENT_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9044 Chrome/120.0.6099.291 Electron/28.2.10 Safari/537.36';

const questProxyAgentCache = new Map<string, ProxyAgent>();
const QUEST_PROXY_AGENT_CACHE_MAX = 32;

function getQuestProxyAgent(proxyUrl: string): ProxyAgent {
	let ag = questProxyAgentCache.get(proxyUrl);
	if (!ag) {
		ag = new ProxyAgent({
			getProxyForUrl: () => proxyUrl
		});
		questProxyAgentCache.set(proxyUrl, ag);
		while (questProxyAgentCache.size > QUEST_PROXY_AGENT_CACHE_MAX) {
			const first = questProxyAgentCache.keys().next().value as string | undefined;
			if (first === undefined) break;
			questProxyAgentCache.get(first)?.destroy();
			questProxyAgentCache.delete(first);
		}
	}
	return ag;
}

function retryAfterHeaderValue(headers: unknown): string | undefined {
	if (!headers || typeof headers !== 'object') return undefined;
	const h = headers as Record<string, unknown> & { get?: (name: string) => string | undefined };
	if (typeof h.get === 'function') {
		const v = h.get('retry-after');
		if (typeof v === 'string') return v;
	}
	const raw = h['retry-after'] ?? h['Retry-After'];
	if (typeof raw === 'string') return raw;
	if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
	return undefined;
}

function retryAfterMs(headers: unknown): number {
	const ra = retryAfterHeaderValue(headers);
	if (!ra) return 2000;
	const sec = Number(ra);
	if (Number.isFinite(sec)) return Math.min(120_000, Math.max(1000, sec * 1000));
	const d = Date.parse(ra);
	if (Number.isFinite(d)) return Math.min(120_000, Math.max(1000, d - Date.now()));
	return 2000;
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

export type QuestOrbSummary = {
	id: string;
	questName: string;
	gameTitle: string;
	description: string;
	questUrl: string;
	startsAt: string;
	expiresAt: string;
	orbHint: string;
	taskTypeKey: string;
	taskTypeLabel: string;
	publisher: string;
	gameSubtitle: string;
	taskDetailLine: string;
	rewardsLine: string;
	thumbnailUrl: string | null;
	bannerUrl: string | null;
};

function taskConfigV2Tasks(cfg: Record<string, unknown>): Record<string, unknown> | null {
	const v2 = cfg.task_config_v2;
	if (!v2 || typeof v2 !== 'object') return null;
	const tasks = (v2 as Record<string, unknown>).tasks;
	if (!tasks || typeof tasks !== 'object') return null;
	return tasks as Record<string, unknown>;
}

function primaryTaskKeyFromConfig(cfg: Record<string, unknown>): string {
	const tasks = taskConfigV2Tasks(cfg);
	if (!tasks) return '';
	for (const k of TASK_KEY_PRIORITY) {
		const t = tasks[k];
		if (t != null && typeof t === 'object') return k;
	}
	for (const k of Object.keys(tasks)) {
		const t = tasks[k];
		if (t != null && typeof t === 'object') return k;
	}
	return '';
}

function labelForTaskKey(key: string): string {
	if (!key) return 'Quest';
	if (TASK_KEY_LABELS[key]) return TASK_KEY_LABELS[key];
	return key
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(' ');
}

function asStr(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

function asNum(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
	return null;
}

const HTTPS_IMAGE_RE = /^https?:\/\/[^\s]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s]*)?$/i;
const DISCORD_CDN_RE = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/\S+$/i;

function collectHttpsImageUrls(obj: unknown, depth: number, out: Set<string>): void {
	if (depth > 7 || obj == null) return;
	if (typeof obj === 'string') {
		const s = obj.trim();
		if (HTTPS_IMAGE_RE.test(s) || DISCORD_CDN_RE.test(s)) out.add(s);
		return;
	}
	if (typeof obj !== 'object') return;
	if (Array.isArray(obj)) {
		for (const x of obj) collectHttpsImageUrls(x, depth + 1, out);
		return;
	}
	for (const v of Object.values(obj as Record<string, unknown>)) collectHttpsImageUrls(v, depth + 1, out);
}

function discordAppIconUrl(applicationId: string, iconHash: string): string | null {
	if (!applicationId || !iconHash) return null;
	const h = iconHash.trim();
	if (!h || h.startsWith('http')) return h.startsWith('http') ? h : null;
	const ext = h.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/app-icons/${applicationId}/${h}.${ext}?size=256`;
}

function discordAppCoverUrl(applicationId: string, hash: string): string | null {
	if (!applicationId || !hash) return null;
	const h = hash.trim();
	if (!h || h.startsWith('http')) return h.startsWith('http') ? h : null;
	const ext = h.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/app-assets/${applicationId}/${h}.${ext}?size=600`;
}

function resolveApplicationId(cfg: Record<string, unknown>): string {
	const raw = cfg.application;
	if (typeof raw === 'string' && raw.trim()) return raw.trim();
	if (raw && typeof raw === 'object') {
		const id = asStr((raw as Record<string, unknown>).id);
		if (id) return id;
	}
	return asStr(cfg.application_id) || asStr(cfg.target_application_id);
}

function readApplicationIconHash(app: Record<string, unknown> | null, cfg: Record<string, unknown>): string {
	if (app) {
		const h = asStr(app.icon) || asStr(app.icon_hash);
		if (h) return h;
	}
	return asStr(cfg.application_icon) || asStr(cfg.icon);
}

function mediaFromApplication(cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	const appId = resolveApplicationId(cfg);
	if (!appId) return { thumb: null, banner: null };

	const app = cfg.application;
	const appObj = app && typeof app === 'object' ? (app as Record<string, unknown>) : null;

	let thumb: string | null = null;
	const iconHash = readApplicationIconHash(appObj, cfg);
	if (iconHash) thumb = discordAppIconUrl(appId, iconHash);

	let banner: string | null = null;
	const cover = (appObj?.cover_image ?? cfg.cover_image) as unknown;
	if (typeof cover === 'string' && cover) banner = discordAppCoverUrl(appId, cover);
	else if (cover && typeof cover === 'object') {
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
	if (!s) return null;
	if (s.startsWith('http://') || s.startsWith('https://')) return s;
	if (!applicationId || /\s/.test(s)) return null;
	if (kind === 'banner') {
		const cover = discordAppCoverUrl(applicationId, s);
		if (cover) return cover;
		return discordAppIconUrl(applicationId, s);
	}
	const icon = discordAppIconUrl(applicationId, s);
	if (icon) return icon;
	return discordAppCoverUrl(applicationId, s);
}

function resolveQuestBannerAndThumb(questId: string, cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	void questId;
	const fromApp = mediaFromApplication(cfg);
	const appId = resolveApplicationId(cfg);
	const m = cfg.messages as Record<string, unknown> | undefined;
	const tryMsg = (kind: 'thumb' | 'banner', ...keys: string[]) => {
		for (const k of keys) {
			const raw = asStr(m?.[k]);
			if (!raw) continue;
			const u = messageMediaUrl(appId, raw, kind);
			if (u) return u;
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
		if (/banner|hero|splash|artwork|cover|wide|game_art|quest_art/i.test(u)) s += 100;
		return s + Math.min(u.length, 200) / 1000;
	};
	const rankThumb = (u: string) => {
		let s = 0;
		if (/icon|logo|thumb|avatar|orb|character|bar/i.test(u)) s += 100;
		return s;
	};

	let bannerPick = explicitBanner || fromApp.banner || null;
	if (!bannerPick && list.length) {
		bannerPick = [...list].sort((a, b) => rankBanner(b) - rankBanner(a))[0] ?? null;
	}

	let thumbPick = explicitThumb || fromApp.thumb || null;
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
	if (!tasks) return null;
	const key = primaryTaskKeyFromConfig(cfg);
	if (!key) return null;
	const obj = tasks[key];
	if (!obj || typeof obj !== 'object') return null;
	return { key, obj: obj as Record<string, unknown> };
}

function taskTargetFromTaskObj(taskKey: string, taskObj: Record<string, unknown>): { target: number | null; unit: string } {
	const sec = asNum(taskObj.target_seconds) ?? asNum(taskObj.duration_seconds) ?? asNum(taskObj.seconds_to_watch) ?? asNum(taskObj.watch_time_seconds);
	if (sec != null) return { target: sec, unit: 'seconds' };
	const min = asNum(taskObj.target_minutes) ?? asNum(taskObj.duration_minutes) ?? asNum(taskObj.minutes);
	if (min != null) return { target: min * 60, unit: 'seconds' };
	const generic = asNum(taskObj.target) ?? asNum(taskObj.goal) ?? asNum(taskObj.max);
	if (generic != null) {
		const unitRaw = asStr(taskObj.target_unit).toLowerCase();
		if (unitRaw.includes('minute')) return { target: generic * 60, unit: 'seconds' };
		if (unitRaw.includes('hour')) return { target: generic * 3600, unit: 'seconds' };
		if (unitRaw.includes('second')) return { target: generic, unit: 'seconds' };
		return { target: generic, unit: taskKey.includes('VIDEO') || taskKey.includes('WATCH') ? 'seconds' : 'steps' };
	}
	return { target: null, unit: 'seconds' };
}

function buildTaskDetailLine(taskKey: string, taskLabel: string, taskObj: Record<string, unknown>): string {
	const messages = taskObj.messages as Record<string, unknown> | undefined;
	const custom = asStr(messages?.title) || asStr(messages?.body) || asStr(messages?.description) || asStr(messages?.subtitle) || asStr(messages?.cta);
	if (custom && custom.length <= 200) return custom;

	const { target, unit } = taskTargetFromTaskObj(taskKey, taskObj);
	if (target != null && unit === 'seconds') {
		if (taskKey.includes('VIDEO') || taskKey.includes('WATCH')) {
			const wholeMin = Math.round(target / 60);
			if (wholeMin >= 1 && Math.abs(target - wholeMin * 60) <= 5) {
				return `${taskLabel} for ${wholeMin} minute${wholeMin === 1 ? '' : 's'}`;
			}
			return `${taskLabel} for ${target} seconds`;
		}
		return `${taskLabel} · ${target} seconds`;
	}
	if (target != null) return `${taskLabel} · target ${target}`;
	return taskLabel;
}

function rewardsDisplayLine(orbHint: string): string {
	if (!orbHint) return 'Orb reward';
	return `• ${orbHint}`;
}

function rewardLooksLikeOrb(r: Record<string, unknown> | null | undefined): boolean {
	if (!r || typeof r !== 'object') return false;
	if (typeof r.orb_quantity === 'number' && r.orb_quantity > 0) return true;
	const typeStr =
		typeof r.type === 'string' ? r.type : typeof r.reward_type === 'string' ? r.reward_type : typeof r.rewardType === 'string' ? r.rewardType : '';
	if (typeStr && /orb/i.test(typeStr)) return true;
	const messages = r.messages as Record<string, unknown> | undefined;
	const name = typeof messages?.name === 'string' ? messages.name : '';
	if (/orb/i.test(name)) return true;
	const sku = typeof r.sku_id === 'string' ? r.sku_id : typeof r.sku === 'string' ? r.sku : '';
	if (sku && /orb/i.test(sku)) return true;
	return false;
}

function rewardListFromQuest(quest: Record<string, unknown>): unknown[] {
	const cfg = quest.config as Record<string, unknown> | undefined;
	const fromConfig = cfg?.rewards_config as Record<string, unknown> | undefined;
	const a = fromConfig?.rewards;
	if (Array.isArray(a)) return a;
	const top = quest.rewards_config as Record<string, unknown> | undefined;
	const b = top?.rewards;
	if (Array.isArray(b)) return b;
	const direct = cfg?.rewards;
	if (Array.isArray(direct)) return direct;
	return [];
}

function questHasOrbReward(quest: Record<string, unknown>): boolean {
	const list = rewardListFromQuest(quest);
	return list.some((x) => rewardLooksLikeOrb(x as Record<string, unknown>));
}

function questExpired(quest: Record<string, unknown>): boolean {
	const expires = (quest.config as Record<string, unknown> | undefined)?.expires_at;
	if (typeof expires !== 'string') return false;
	const t = Date.parse(expires);
	return Number.isFinite(t) && t < Date.now();
}

function orbHintFromQuest(quest: Record<string, unknown>): string {
	const rewards = rewardListFromQuest(quest);
	if (rewards.length === 0) return '';
	const parts: string[] = [];
	for (const r of rewards) {
		if (!rewardLooksLikeOrb(r as Record<string, unknown>)) continue;
		const rec = r as Record<string, unknown>;
		if (typeof rec.orb_quantity === 'number' && rec.orb_quantity > 0) parts.push(`${rec.orb_quantity} Orbs`);
		const nm = (rec.messages as Record<string, unknown> | undefined)?.name;
		if (typeof nm === 'string' && nm.trim()) parts.push(nm.trim());
	}
	return parts.length ? [...new Set(parts)].join(' · ') : 'Orb reward';
}

function toQuestOrbSummary(quest: Record<string, unknown>): QuestOrbSummary {
	const id = String(quest.id ?? '');
	const cfg = (quest.config ?? {}) as Record<string, unknown>;
	const messages = (cfg.messages ?? {}) as Record<string, unknown>;
	const questName = typeof messages.quest_name === 'string' ? messages.quest_name : 'Discord Quest';
	const gameTitle = typeof messages.game_title === 'string' ? messages.game_title : 'Quest';
	const gameSubtitle = asStr(messages.game_name) || asStr(messages.promo_title) || asStr(messages.subtitle) || asStr(messages.secondary_title);
	const startsAt = typeof cfg.starts_at === 'string' ? cfg.starts_at : '';
	const expiresAt = typeof cfg.expires_at === 'string' ? cfg.expires_at : '';
	const orbHint = orbHintFromQuest(quest);
	const taskTypeKey = primaryTaskKeyFromConfig(cfg);
	const taskTypeLabel = labelForTaskKey(taskTypeKey);
	const publisher =
		asStr(messages.publisher_name) ||
		asStr(messages.publisher) ||
		asStr(messages.brand_name) ||
		asStr(messages.developer_name) ||
		asStr(messages.studio_name) ||
		asStr(messages.company_name) ||
		asStr(messages.vendor_name);

	const pt = primaryTaskObject(cfg);
	const taskObj = pt?.obj ?? {};
	const taskDetailLine = pt ? buildTaskDetailLine(pt.key, taskTypeLabel, taskObj) : taskTypeLabel;

	const { thumb, banner } = resolveQuestBannerAndThumb(id, cfg);
	const rewardsLine = rewardsDisplayLine(orbHint);
	const desc = orbHint ? `**Reward:** ${orbHint}` : 'A quest with Orbs is available in the Discord client.';

	return {
		id,
		questName,
		gameTitle,
		description: desc,
		questUrl: `https://discord.com/quests/${id}`,
		startsAt,
		expiresAt,
		orbHint,
		taskTypeKey,
		taskTypeLabel,
		publisher,
		gameSubtitle,
		taskDetailLine,
		rewardsLine,
		thumbnailUrl: thumb,
		bannerUrl: banner
	};
}

export function extractOrbQuests(payload: unknown): QuestOrbSummary[] {
	if (!payload || typeof payload !== 'object') return [];
	const quests = (payload as Record<string, unknown>).quests;
	if (!Array.isArray(quests)) return [];
	const out: QuestOrbSummary[] = [];
	for (const q of quests) {
		if (!q || typeof q !== 'object') continue;
		const rec = q as Record<string, unknown>;
		if (rec.preview === true) continue;
		if (questExpired(rec)) continue;
		if (!questHasOrbReward(rec)) continue;
		out.push(toQuestOrbSummary(rec));
	}
	out.sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || ''));
	return out;
}

export function questPayloadOrbDiagnostics(payload: unknown): {
	questCount: number;
	afterPreviewExpired: number;
	orbRewardCount: number;
} {
	if (!payload || typeof payload !== 'object') {
		return { questCount: 0, afterPreviewExpired: 0, orbRewardCount: 0 };
	}
	const quests = (payload as Record<string, unknown>).quests;
	if (!Array.isArray(quests)) {
		return { questCount: 0, afterPreviewExpired: 0, orbRewardCount: 0 };
	}
	let afterPreviewExpired = 0;
	let orbRewardCount = 0;
	for (const q of quests) {
		if (!q || typeof q !== 'object') continue;
		const rec = q as Record<string, unknown>;
		if (rec.preview === true) continue;
		if (questExpired(rec)) continue;
		afterPreviewExpired += 1;
		if (questHasOrbReward(rec)) orbRewardCount += 1;
	}
	return { questCount: quests.length, afterPreviewExpired, orbRewardCount };
}

async function questApiRequest(
	userToken: string,
	method: 'GET' | 'POST' | 'DELETE',
	path: string,
	body?: unknown,
	opts?: { httpProxyUrl?: string | null }
): Promise<{ status: number; data: unknown }> {
	const headers = discordQuestRequestHeaders(userToken);
	const proxyUrl = opts?.httpProxyUrl?.trim() || undefined;
	const agent = proxyUrl ? getQuestProxyAgent(proxyUrl) : undefined;
	const url = path.startsWith('http') ? path : `${DISCORD_API_V9}${path.startsWith('/') ? path : `/${path}`}`;
	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await axios({
			method,
			url,
			headers,
			data: body === undefined ? undefined : body,
			...(agent ? { httpAgent: agent, httpsAgent: agent } : {}),
			validateStatus: () => true
		});

		if (res.status === 429 && attempt < maxAttempts) {
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
	return { status: 599, data: null };
}

export async function fetchQuestsMe(userToken: string, opts?: { httpProxyUrl?: string | null }): Promise<unknown> {
	const maxAttempts = 3;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await questApiRequest(userToken, 'GET', '/quests/@me', undefined, opts);

		if (res.status === 429 && attempt < maxAttempts) {
			await sleep(2000);
			continue;
		}

		if (res.status !== 200) {
			let err = `Discord API ${res.status}`;
			const data = res.data;
			if (data && typeof data === 'object' && typeof (data as Record<string, unknown>).message === 'string') {
				err += `: ${(data as Record<string, unknown>).message}`;
			} else if (typeof data === 'string' && data) {
				err += `: ${data.slice(0, 200)}`;
			}
			throw new Error(err);
		}

		return res.data;
	}
	throw new Error('Discord quests request failed');
}

function findQuestByIdInPayload(payload: unknown, questId: string): Record<string, unknown> | null {
	if (!payload || typeof payload !== 'object') return null;
	const quests = (payload as Record<string, unknown>).quests;
	if (!Array.isArray(quests)) return null;
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
	if (!us) return 0;
	const p = us.progress as Record<string, unknown> | undefined;
	if (!p || typeof p !== 'object') return 0;
	const t = p[taskKey] as Record<string, unknown> | undefined;
	if (t && typeof t.value === 'number') return t.value;
	return 0;
}

function extractProgressFromHeartbeatPayload(data: unknown, taskKey: string): { value: number; completed: boolean } {
	if (!data || typeof data !== 'object') return { value: 0, completed: false };
	const d = data as Record<string, unknown>;
	const p = d.progress;
	if (p && typeof p === 'object') {
		const t = (p as Record<string, unknown>)[taskKey];
		if (t && typeof t === 'object') {
			const tr = t as Record<string, unknown>;
			const value = typeof tr.value === 'number' ? tr.value : 0;
			const completed = tr.completed_at != null || tr.completedAt != null;
			return { value, completed };
		}
	}
	return { value: 0, completed: false };
}

function heartbeatResponseOk(data: unknown): boolean {
	if (!data || typeof data !== 'object') return false;
	return (data as Record<string, unknown>).user_id != null;
}

function heartbeatDurationTargetSec(taskKey: string, taskObj: Record<string, unknown>): number | null {
	const explicit = asNum(taskObj.target_seconds) ?? asNum(taskObj.duration_seconds) ?? asNum(taskObj.seconds_to_watch) ?? asNum(taskObj.watch_time_seconds);
	if (explicit != null && explicit > 0) return explicit;
	const min = asNum(taskObj.target_minutes) ?? asNum(taskObj.duration_minutes) ?? asNum(taskObj.minutes);
	if (min != null && min > 0) return min * 60;
	const generic = asNum(taskObj.target) ?? asNum(taskObj.goal) ?? asNum(taskObj.max);
	if (generic == null || generic <= 0) return null;
	const unitRaw = asStr(taskObj.target_unit).toLowerCase();
	if (unitRaw.includes('minute')) return generic * 60;
	if (unitRaw.includes('hour')) return generic * 3600;
	if (unitRaw.includes('second')) return generic;
	const durationish =
		taskKey === 'WATCH_VIDEO' ||
		taskKey === 'WATCH_VIDEO_ON_MOBILE' ||
		taskKey.startsWith('PLAY_ON_') ||
		taskKey.startsWith('STREAM_') ||
		taskKey === 'PLAY_ACTIVITY';
	if (durationish) return generic;
	return null;
}

function achievementProgressTarget(taskObj: Record<string, unknown>): number | null {
	const t = asNum(taskObj.target) ?? asNum(taskObj.goal);
	return t != null && t > 0 ? t : null;
}

function discordUserIdFromToken(userToken: string): string | null {
	const parts = userToken.trim().split('.');
	if (parts.length < 2) return null;
	try {
		let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const pad = (4 - (b64.length % 4)) % 4;
		b64 += '='.repeat(pad);
		const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
		const id = payload.id ?? payload.user_id;
		return typeof id === 'string' ? id : null;
	} catch {
		return null;
	}
}

async function discordUserIdFromUserToken(userToken: string, opts?: { httpProxyUrl?: string | null }): Promise<string | null> {
	const fromJwt = discordUserIdFromToken(userToken);
	if (fromJwt) return fromJwt;
	const res = await questApiRequest(userToken, 'GET', '/users/@me', undefined, opts);
	if (res.status !== 200 || !res.data || typeof res.data !== 'object') return null;
	const id = (res.data as Record<string, unknown>).id;
	return typeof id === 'string' ? id : null;
}

async function runQuestHeartbeatUntilDone(
	userToken: string,
	questId: string,
	taskKey: string,
	opts: { httpProxyUrl?: string | null } | undefined,
	config: {
		knownTargetSec: number | null;
		intervalMs: number;
		makeBody: (terminal: boolean) => Record<string, unknown>;
	}
): Promise<{ sawTaskComplete: boolean; reachedTarget: boolean; lastError: string }> {
	const { knownTargetSec, intervalMs, makeBody } = config;
	const secPerTick = Math.max(1, intervalMs / 1000);
	const maxIters = knownTargetSec != null ? Math.min(800, Math.max(50, Math.ceil(knownTargetSec / secPerTick) * 2 + 45)) : 500;
	let lastError = '';
	let sawTaskComplete = false;
	let reachedTarget = false;

	for (let i = 0; i < maxIters; i++) {
		const hb = await questApiRequest(userToken, 'POST', `/quests/${questId}/heartbeat`, makeBody(false), opts);
		const body = hb.data && typeof hb.data === 'object' ? (hb.data as Record<string, unknown>) : null;

		if (!heartbeatResponseOk(hb.data)) {
			lastError = body?.message && typeof body.message === 'string' ? body.message : `HTTP ${hb.status}`;
			break;
		}

		const slice = extractProgressFromHeartbeatPayload(hb.data, taskKey);
		if (slice.completed) {
			sawTaskComplete = true;
			break;
		}
		if (knownTargetSec != null && slice.value >= knownTargetSec - 0.5) {
			reachedTarget = true;
			break;
		}

		await sleep(intervalMs);
	}

	if (sawTaskComplete || reachedTarget) {
		await questApiRequest(userToken, 'POST', `/quests/${questId}/heartbeat`, makeBody(true), opts);
	}

	return { sawTaskComplete, reachedTarget, lastError };
}

async function completeAchievementViaDiscordSays(
	userToken: string,
	applicationId: string,
	questTarget: number,
	opts?: { httpProxyUrl?: string | null }
): Promise<{ ok: boolean; error: string }> {
	const proxyUrl = opts?.httpProxyUrl?.trim();
	const agent = proxyUrl ? getQuestProxyAgent(proxyUrl) : undefined;
	const baseHeaders = {
		'User-Agent': CLIENT_USER_AGENT,
		'Content-Type': 'application/json'
	};

	const authQuery = new URLSearchParams({
		response_type: 'code',
		client_id: applicationId,
		scope: 'identify applications.commands applications.entitlements',
		state: ''
	});
	const authRes = await questApiRequest(
		userToken,
		'POST',
		`/oauth2/authorize?${authQuery.toString()}`,
		{
			permissions: '0',
			authorize: true,
			integration_type: 1,
			location_context: {
				guild_id: '10000',
				channel_id: '10000',
				channel_type: 10000
			}
		},
		opts
	);
	const authBody = authRes.data && typeof authRes.data === 'object' ? (authRes.data as Record<string, unknown>) : null;
	const location = typeof authBody?.location === 'string' ? authBody.location : '';
	let authCode: string | null = null;
	if (location) {
		try {
			authCode = new URL(location).searchParams.get('code');
		} catch {}
	}
	if (!authCode) {
		return { ok: false, error: 'OAuth authorize did not return a code (achievement quests need a supported Discord Says app).' };
	}

	const saysUrl = `https://${applicationId}.discordsays.com/.proxy/acf/authorize`;
	const saysAuth = await axios({
		method: 'POST',
		url: saysUrl,
		data: { code: authCode },
		headers: baseHeaders,
		...(agent ? { httpAgent: agent, httpsAgent: agent } : {}),
		validateStatus: () => true
	});
	let saysToken: string | null = null;
	if (saysAuth.status >= 200 && saysAuth.status < 300 && saysAuth.data && typeof saysAuth.data === 'object') {
		const t = (saysAuth.data as Record<string, unknown>).token;
		if (typeof t === 'string') saysToken = t;
	}
	if (!saysToken) {
		return { ok: false, error: `Discord Says authorize failed (HTTP ${saysAuth.status}).` };
	}

	const progressUrl = `https://${applicationId}.discordsays.com/.proxy/acf/quest/progress`;
	const prog = await axios({
		method: 'POST',
		url: progressUrl,
		data: { progress: questTarget },
		headers: { ...baseHeaders, 'x-auth-token': saysToken },
		...(agent ? { httpAgent: agent, httpsAgent: agent } : {}),
		validateStatus: () => true
	});
	if (prog.status < 200 || prog.status >= 300) {
		return { ok: false, error: `Discord Says progress failed (HTTP ${prog.status}).` };
	}

	const tokensRes = await questApiRequest(userToken, 'GET', '/oauth2/tokens', undefined, opts);
	if (tokensRes.status === 200 && Array.isArray(tokensRes.data)) {
		const tokenInfo = (tokensRes.data as Record<string, unknown>[]).find((t) => {
			if (!t || typeof t !== 'object') return false;
			const app = t.application as Record<string, unknown> | undefined;
			return app != null && String(app.id) === String(applicationId);
		});
		const tid = tokenInfo && typeof tokenInfo.id === 'string' ? tokenInfo.id : null;
		if (tid) {
			await questApiRequest(userToken, 'DELETE', `/oauth2/tokens/${tid}`, undefined, opts);
		}
	}

	return { ok: true, error: '' };
}

function userQuestCompleted(quest: Record<string, unknown>): boolean {
	const us = getQuestUserStatus(quest);
	if (!us) return false;
	if (us.completed_at != null || us.completedAt != null) return true;
	return false;
}

function enrolledAtMsFromQuest(quest: Record<string, unknown>): number {
	const us = getQuestUserStatus(quest);
	if (!us) return Date.now();
	const e = us.enrolled_at ?? us.enrolledAt;
	if (typeof e === 'string') {
		const t = Date.parse(e);
		if (Number.isFinite(t)) return t;
	}
	return Date.now();
}

export type OrbQuestAutomationResult = {
	ok: boolean;
	questName: string;
	orbLine: string;
	questUrl: string;
	title: string;
	description: string;
};

export async function runOrbQuestUserAutomation(
	userToken: string,
	questId: string,
	opts?: { httpProxyUrl?: string | null }
): Promise<OrbQuestAutomationResult> {
	const qUrl = `https://discord.com/quests/${questId}`;
	let token = userToken.trim();
	const wipe = () => {
		token = '';
	};

	try {
		let payload = await fetchQuestsMe(token, opts);
		let quest = findQuestByIdInPayload(payload, questId);
		if (!quest) {
			return {
				ok: false,
				questName: 'Unknown quest',
				orbLine: '',
				questUrl: qUrl,
				title: 'Orb enroll',
				description: 'This quest was not returned for that account. Open **Quests** in Discord, accept it if needed, and ensure the token matches that user.'
			};
		}

		const cfg = (quest.config ?? {}) as Record<string, unknown>;
		const messages = (cfg.messages ?? {}) as Record<string, unknown>;
		const questName = typeof messages.quest_name === 'string' ? messages.quest_name : `Quest ${questId}`;
		const orbLine = orbHintFromQuest(quest);

		if (questExpired(quest)) {
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Orb enroll',
				description: 'That quest has expired.'
			};
		}

		if (userQuestCompleted(quest)) {
			return {
				ok: true,
				questName,
				orbLine,
				questUrl: qUrl,
				title: '✅ Quest already complete',
				description: `**Reward:** ${orbLine || 'Orb reward'}\nClaim it in the Discord client under **Quests** if you have not yet.`
			};
		}

		const enrollRes = await questApiRequest(token, 'POST', `/quests/${questId}/enroll`, { location: 11, is_targeted: false, metadata_raw: null }, opts);
		const enrollOk = enrollRes.status >= 200 && enrollRes.status < 300;
		const enrollMsg =
			enrollRes.data && typeof enrollRes.data === 'object' && typeof (enrollRes.data as Record<string, unknown>).message === 'string'
				? String((enrollRes.data as Record<string, unknown>).message).toLowerCase()
				: '';
		const enrollBodyStr = JSON.stringify(enrollRes.data ?? '').toLowerCase();
		if (!enrollOk && enrollRes.status !== 400 && enrollRes.status !== 409 && !enrollMsg.includes('already') && !enrollBodyStr.includes('already')) {
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Orb enroll failed',
				description: `Discord returned HTTP ${enrollRes.status} when enrolling. You may need to accept the quest in the client first, or your token may be invalid.`
			};
		}

		payload = await fetchQuestsMe(token, opts);
		quest = findQuestByIdInPayload(payload, questId) ?? quest;

		if (userQuestCompleted(quest)) {
			return {
				ok: true,
				questName,
				orbLine,
				questUrl: qUrl,
				title: '✅ Quest complete',
				description: `**Reward:** ${orbLine || 'Orb reward'}\nOpen **Discord → Quests** in the client to claim if prompted.`
			};
		}

		const cfgLive = (quest.config ?? {}) as Record<string, unknown>;
		const pt = primaryTaskObject(cfgLive);
		const taskKey = pt?.key ?? primaryTaskKeyFromConfig(cfgLive);

		if (!pt) {
			return {
				ok: true,
				questName,
				orbLine,
				questUrl: qUrl,
				title: '⚠️ Enrolled only',
				description: `Enrolled in **${questName}**. No runnable task was detected in the quest config — finish in the **Discord** client if needed.\n\n**Reward:** ${orbLine || 'Orb reward'}`
			};
		}

		const isVideo = taskKey === 'WATCH_VIDEO' || taskKey === 'WATCH_VIDEO_ON_MOBILE';
		const isAchievement = taskKey === 'ACHIEVEMENT_IN_ACTIVITY' || taskKey === 'ACHIEVEMENT_IN_GAME';
		const isPlayActivity = taskKey === 'PLAY_ACTIVITY';
		const isPlatformHeartbeat =
			taskKey === 'PLAY_ON_DESKTOP' ||
			taskKey === 'PLAY_ON_DESKTOP_V2' ||
			taskKey === 'PLAY_ON_XBOX' ||
			taskKey === 'PLAY_ON_PLAYSTATION' ||
			taskKey === 'STREAM_ON_DESKTOP';

		if (isAchievement) {
			const applicationId = resolveApplicationId(cfgLive);
			const questTarget = achievementProgressTarget(pt.obj);
			if (!applicationId || questTarget == null) {
				return {
					ok: false,
					questName,
					orbLine,
					questUrl: qUrl,
					title: 'Achievement quest',
					description: `Missing application id or achievement target in the quest config. Finish **${labelForTaskKey(taskKey)}** in the Discord client.\n\n**Reward:** ${orbLine || 'Orb reward'}`
				};
			}
			const ach = await completeAchievementViaDiscordSays(token, applicationId, questTarget, opts);
			payload = await fetchQuestsMe(token, opts);
			quest = findQuestByIdInPayload(payload, questId) ?? quest;
			if (ach.ok || userQuestCompleted(quest)) {
				return {
					ok: true,
					questName,
					orbLine,
					questUrl: qUrl,
					title: '✅ Achievement quest finished',
					description: `**${questName}**\n**Reward:** ${orbLine || 'Orb reward'}\nClaim in **Discord → Quests** if prompted.`
				};
			}
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Achievement quest — incomplete',
				description: `${ach.error}\n\n**Reward:** ${orbLine || 'Orb reward'}`
			};
		}

		if (isPlayActivity) {
			const userId = await discordUserIdFromUserToken(token, opts);
			if (!userId) {
				return {
					ok: false,
					questName,
					orbLine,
					questUrl: qUrl,
					title: 'Activity quest',
					description: `Could not resolve your user id from the token. Use a normal **user** token (not a bot token).\n\n**Reward:** ${orbLine || 'Orb reward'}`
				};
			}
			const knownTargetSec = heartbeatDurationTargetSec(taskKey, pt.obj);
			const streamKey = `call:${userId}:1`;
			const hb = await runQuestHeartbeatUntilDone(token, questId, taskKey, opts, {
				knownTargetSec,
				intervalMs: 20_000,
				makeBody: (terminal) => ({ stream_key: streamKey, terminal })
			});
			payload = await fetchQuestsMe(token, opts);
			quest = findQuestByIdInPayload(payload, questId) ?? quest;
			const finalProgress = readProgressSeconds(quest, taskKey);
			const done = hb.sawTaskComplete || userQuestCompleted(quest) || (knownTargetSec != null && finalProgress >= knownTargetSec - 0.5);
			if (done) {
				return {
					ok: true,
					questName,
					orbLine,
					questUrl: qUrl,
					title: '✅ Activity quest finished',
					description: `**${questName}**\n**Reward:** ${orbLine || 'Orb reward'}\nClaim in **Discord → Quests** if prompted.`
				};
			}
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Activity quest — incomplete',
				description: `Progress did not finish in time${hb.lastError ? ` (${hb.lastError})` : ''}.\n\n**Reward:** ${orbLine || 'Orb reward'}`
			};
		}

		if (isPlatformHeartbeat) {
			const knownTargetSec = heartbeatDurationTargetSec(taskKey, pt.obj);
			const applicationId = resolveApplicationId(cfgLive);
			let hb: { sawTaskComplete: boolean; reachedTarget: boolean; lastError: string };

			if (applicationId) {
				hb = await runQuestHeartbeatUntilDone(token, questId, taskKey, opts, {
					knownTargetSec,
					intervalMs: 20_000,
					makeBody: (terminal) => ({ application_id: applicationId, terminal })
				});
			} else if (taskKey === 'PLAY_ON_DESKTOP' || taskKey === 'PLAY_ON_DESKTOP_V2' || taskKey === 'STREAM_ON_DESKTOP') {
				const streamKey = `call:${questId}:1`;
				hb = await runQuestHeartbeatUntilDone(token, questId, taskKey, opts, {
					knownTargetSec,
					intervalMs: 30_000,
					makeBody: (terminal) => ({ stream_key: streamKey, terminal })
				});
			} else {
				return {
					ok: true,
					questName,
					orbLine,
					questUrl: qUrl,
					title: '⚠️ Enrolled only',
					description: `Enrolled in **${questName}**. **${labelForTaskKey(taskKey)}** needs an **application id** in the quest config for API heartbeats — finish in the Discord client (desktop / console).\n\n**Reward:** ${orbLine || 'Orb reward'}`
				};
			}

			payload = await fetchQuestsMe(token, opts);
			quest = findQuestByIdInPayload(payload, questId) ?? quest;
			const finalProgress = readProgressSeconds(quest, taskKey);
			const done = hb.sawTaskComplete || userQuestCompleted(quest) || (knownTargetSec != null && finalProgress >= knownTargetSec - 0.5);
			if (done) {
				return {
					ok: true,
					questName,
					orbLine,
					questUrl: qUrl,
					title: '✅ Quest finished',
					description: `**${questName}** (${labelForTaskKey(taskKey)})\n**Reward:** ${orbLine || 'Orb reward'}\nClaim in **Discord → Quests** if prompted.`
				};
			}
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Quest — incomplete',
				description: `Progress did not finish in time${hb.lastError ? ` (${hb.lastError})` : ''}. For **stream** or **console** quests, keep the real client active or retry later.\n\n**Reward:** ${orbLine || 'Orb reward'}`
			};
		}

		if (!isVideo) {
			return {
				ok: true,
				questName,
				orbLine,
				questUrl: qUrl,
				title: '⚠️ Enrolled only',
				description: `Enrolled in **${questName}**. Unsupported task type (**${labelForTaskKey(taskKey)}**) — complete it in the Discord client.\n\n**Reward:** ${orbLine || 'Orb reward'}`
			};
		}

		const { target, unit } = taskTargetFromTaskObj(pt.key, pt.obj);
		const targetSec = unit === 'seconds' && target != null && target > 0 ? target : null;
		if (targetSec == null) {
			return {
				ok: false,
				questName,
				orbLine,
				questUrl: qUrl,
				title: 'Orb enroll',
				description: 'Could not read the video duration for this quest.'
			};
		}

		const enrolledAt = enrolledAtMsFromQuest(quest);
		let secondsDone = readProgressSeconds(quest, pt.key);
		const maxFuture = 10;
		const speed = 7;
		let lastError = '';

		for (let i = 0; i < 600 && secondsDone < targetSec; i++) {
			const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
			if (maxAllowed - secondsDone >= speed) {
				const timestamp = Math.min(targetSec, secondsDone + speed + Math.random() * 0.5);
				const vp = await questApiRequest(token, 'POST', `/quests/${questId}/video-progress`, { timestamp }, opts);
				const body = vp.data && typeof vp.data === 'object' ? (vp.data as Record<string, unknown>) : null;
				if (body?.completed_at != null || body?.completedAt != null) {
					secondsDone = targetSec;
					break;
				}
				if (vp.status >= 400) {
					lastError = `HTTP ${vp.status}`;
					const m = body?.message;
					if (typeof m === 'string') lastError += `: ${m}`;
				} else {
					secondsDone = timestamp;
				}
			}
			await sleep(1000);
		}

		payload = await fetchQuestsMe(token, opts);
		quest = findQuestByIdInPayload(payload, questId) ?? quest;

		if (userQuestCompleted(quest) || readProgressSeconds(quest, pt.key) >= targetSec - 0.5) {
			return {
				ok: true,
				questName,
				orbLine,
				questUrl: qUrl,
				title: '✅ Video quest finished',
				description: `**${questName}**\n**Reward:** ${orbLine || 'Orb reward'}\nClaim in **Discord → Quests** if prompted.`
			};
		}

		return {
			ok: false,
			questName,
			orbLine,
			questUrl: qUrl,
			title: 'Orb enroll — incomplete',
			description: `Progress did not reach the target in time${lastError ? ` (${lastError})` : ''}. Finish watching in the Discord client or try again.`
		};
	} finally {
		wipe();
	}
}
