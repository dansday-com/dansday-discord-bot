import axios from 'axios';
import { ProxyAgent } from 'proxy-agent';

/** Match discord-quests-bot / Discord client: user-quest list is requested against v9. */
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
	description: string;
	questUrl: string;
	startsAt: string;
	orbHint: string;
	taskTypeKey: string;
	taskTypeLabel: string;
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
	const startsAt = typeof cfg.starts_at === 'string' ? cfg.starts_at : '';
	const orbHint = orbHintFromQuest(quest);
	const taskTypeKey = primaryTaskKeyFromConfig(cfg);
	const taskTypeLabel = labelForTaskKey(taskTypeKey);
	return {
		id,
		questName,
		gameTitle,
		description: orbHint ? `**Reward:** ${orbHint}` : 'A quest with Orbs is available in the Discord client.',
		questUrl: `https://discord.com/quests/${id}`,
		startsAt,
		orbHint,
		taskTypeKey,
		taskTypeLabel
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
