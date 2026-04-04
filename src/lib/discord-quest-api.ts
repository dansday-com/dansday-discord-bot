import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

const QUESTS_ME_URL = 'https://discord.com/api/v9/quests/@me';

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
	/** Legacy single-line body; still sent for older clients. */
	description: string;
	questUrl: string;
	startsAt: string;
	expiresAt: string;
	orbHint: string;
	taskTypeKey: string;
	taskTypeLabel: string;
	/** Publisher / studio from quest messages. */
	publisher: string;
	/** Longer game or promo line when present. */
	gameSubtitle: string;
	/** Human task line, e.g. watch duration. */
	taskDetailLine: string;
	/** Bullet line for rewards section. */
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

function collectHttpsImageUrls(obj: unknown, depth: number, out: Set<string>): void {
	if (depth > 7 || obj == null) return;
	if (typeof obj === 'string') {
		const s = obj.trim();
		if (HTTPS_IMAGE_RE.test(s)) out.add(s);
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

/** Application cover / splash style asset (hash). */
function discordAppCoverUrl(applicationId: string, hash: string): string | null {
	if (!applicationId || !hash) return null;
	const h = hash.trim();
	if (!h || h.startsWith('http')) return h.startsWith('http') ? h : null;
	const ext = h.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/app-assets/${applicationId}/${h}.${ext}?size=600`;
}

function mediaFromApplication(cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	const app = cfg.application as Record<string, unknown> | undefined;
	const appId = asStr(app?.id) || asStr(cfg.application_id);
	if (!appId || !app) return { thumb: null, banner: null };
	let thumb: string | null = null;
	let banner: string | null = null;
	const icon = asStr(app.icon);
	if (icon) thumb = discordAppIconUrl(appId, icon);
	const cover = app.cover_image;
	if (typeof cover === 'string' && cover) banner = discordAppCoverUrl(appId, cover);
	else if (cover && typeof cover === 'object') {
		const u = asStr((cover as Record<string, unknown>).url);
		const h = asStr((cover as Record<string, unknown>).hash);
		banner = u || (h ? discordAppCoverUrl(appId, h) : null);
	}
	const splash = asStr(app.splash);
	if (!banner && splash) {
		const ext = splash.startsWith('a_') ? 'gif' : 'jpg';
		banner = `https://cdn.discordapp.com/splashes/${appId}/${splash}.${ext}?size=512`;
	}
	return { thumb, banner };
}

function resolveQuestBannerAndThumb(questId: string, cfg: Record<string, unknown>): { thumb: string | null; banner: string | null } {
	void questId;
	const fromApp = mediaFromApplication(cfg);
	const m = cfg.messages as Record<string, unknown> | undefined;
	const explicitThumb = asStr(m?.character_artwork) || asStr(m?.game_icon) || asStr(m?.publisher_icon) || asStr(m?.quest_bar_artwork);
	const explicitBanner = asStr(m?.game_artwork) || asStr(m?.quest_artwork) || asStr(m?.hero_artwork) || asStr(m?.banner_artwork);

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
	const publisher = asStr(messages.publisher_name) || asStr(messages.publisher) || asStr(messages.brand_name);

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

/** For diagnostics when orb filter returns empty but the API responded. */
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

export async function fetchQuestsMe(userToken: string, opts?: { httpProxyUrl?: string | null }): Promise<unknown> {
	const headers = discordQuestRequestHeaders(userToken);
	const proxyUrl = opts?.httpProxyUrl?.trim() || undefined;
	const agent = proxyUrl ? getQuestProxyAgent(proxyUrl) : undefined;
	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await axios.get<unknown>(QUESTS_ME_URL, {
			headers,
			...(agent ? { httpAgent: agent, httpsAgent: agent } : {}),
			validateStatus: () => true
		});

		if (res.status === 429 && attempt < maxAttempts) {
			await sleep(retryAfterMs(res.headers));
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

		if (typeof res.data === 'string') {
			try {
				return JSON.parse(res.data) as unknown;
			} catch {
				throw new Error('Invalid JSON from Discord quests endpoint');
			}
		}
		return res.data;
	}
}
