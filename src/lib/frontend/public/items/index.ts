import { createHash } from 'crypto';
import { request as httpRequest } from 'http';
import db from '$lib/database.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/index.js';
import { itemAvailability, effectiveBagStock, discountedItemCost, DISGUISED_MENTION, floatingWallClockMs } from '$lib/items.js';

export function computeCardToken(discordMemberId: string, memberSince: any): string {
	const dt = parseMySQLDateTimeUtc(memberSince);
	const joinedDate = dt ? dt.toISOString().split('T')[0] : '';
	return createHash('sha256').update(`${discordMemberId}_${joinedDate}`).digest('hex').substring(0, 16);
}

export async function resolveMemberByCardToken(serverId: number, token: string): Promise<any | null> {
	if (!token) return null;
	const members = await db.getServerMembersList(serverId).catch(() => []);
	for (const m of members as any[]) {
		if (!m.discord_member_id) continue;
		if (computeCardToken(m.discord_member_id, m.member_since) === token) return m;
	}
	return null;
}

export const SENTINEL_GUEST = 'guest';

export function isGuestHash(hash: any): boolean {
	return !hash || String(hash) === SENTINEL_GUEST;
}

export function itemsCardTokenFromUrl(urlHash: any): string {
	const raw = urlHash != null ? String(urlHash) : '';
	return raw && raw !== SENTINEL_GUEST ? raw : '';
}

export async function resolveActiveBotForServer(server: any): Promise<any | null> {
	const officialBotId = await db.resolveOfficialBotIdForServer(server).catch(() => null);
	if (officialBotId == null) return null;
	const bot = await db.getBot(officialBotId).catch(() => null);
	return bot ?? null;
}

async function isMemberDisguised(memberId: any): Promise<boolean> {
	const effects = await db.getActiveEffectsForMember(memberId).catch(() => []);
	return ((effects as any[]) || []).some((e) => e.effect_type === 'disguise' && Number(e.owner_member_id) === Number(memberId));
}

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function scheduleMinutes(hhmm: any, fallback: number): number {
	if (hhmm == null || hhmm === '') return fallback;
	const [h, m] = String(hhmm)
		.split(':')
		.map((n) => Number(n) || 0);
	return h * 60 + m;
}

function availableUntilMs(item: any): number | null {
	const ends: number[] = [];
	if (item.available_to) {
		const t = floatingWallClockMs(item.available_to, 0);
		if (t != null) ends.push(t);
	}
	const schedule = typeof item.recurring_schedule === 'string' ? safeParse(item.recurring_schedule) : item.recurring_schedule;
	if (schedule && Array.isArray(schedule.days) && schedule.days.length > 0) {
		const now = new Date();
		const toMin = scheduleMinutes(schedule.to, 1439);
		const endOfWindow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) + (toMin * 60 + 59) * 1000;
		if (Number.isFinite(endOfWindow)) ends.push(endOfWindow);
	}
	if (ends.length === 0) return null;
	return Math.min(...ends);
}

export async function loadItemsCatalog(serverId: number): Promise<any[]> {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) return [];
	const all = await db.listItems(panelId).catch(() => []);
	const out: any[] = [];
	for (const i of all as any[]) {
		const enabled = i.enabled !== false && i.enabled !== 0;

		const mapped = {
			id: i.id,
			name: i.name,
			effect_type: i.effect_type,
			category: i.category,
			description: i.description,
			cost: i.cost,
			enabled,
			usable: i.usable !== false && i.usable !== 0,
			availableUntil: availableUntilMs(i),
			available_from: i.available_from ?? null,
			available_to: i.available_to ?? null,
			recurring_schedule: typeof i.recurring_schedule === 'string' ? safeParse(i.recurring_schedule) : (i.recurring_schedule ?? null),
			config: typeof i.config === 'string' ? safeParse(i.config) : i.config
		};
		const state = itemAvailability(mapped, Date.now(), 0).state;
		out.push({ ...mapped, live: state === 'active' || state === 'upcoming' });
	}
	return out;
}

export async function loadItemsShared(server: any, hash: string, subKey?: 'items' | 'assets' | 'minigames' | null) {
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics).catch(() => null);
	const ps = (psRow as any)?.settings ?? {};
	if (ps.enabled === false) return { notFound: true } as const;
	if (subKey && ps[`${subKey}_enabled`] !== true) return { notFound: true } as const;

	const levelingRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const req = (levelingRow as any)?.settings?.REQUIREMENTS ?? {};
	const levelReq = { baseXp: Number(req.BASE_XP) || 100, multiplier: Number(req.MULTIPLIER) || 1.2 };

	const items = await loadItemsCatalog(server.id);
	const enabledCategories = [...new Set((items as any[]).filter((i) => i.live).map((i) => i.effect_type))];

	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;

	if (!member) return { guest: true as const };

	const invRows = await db.getMemberInventory(member.id).catch(() => []);
	const bagStock = effectiveBagStock(invRows as any[]);

	const effectRows = await db.getActiveEffectsForMember(member.id).catch(() => []);
	const nameOf = (sdn: any, dn: any, un: any) => sdn || dn || un || 'a member';
	const activeEffects = await Promise.all(
		(effectRows as any[]).map(async (e) => {
			const base = {
				effect_type: e.effect_type,
				effect_value: Number(e.effect_value) || 0,
				expiresAt: e.expires_at ? new Date(e.expires_at).getTime() : null,
				leechRole: null as 'attacker' | 'victim' | null,
				leechWith: null as string | null
			};
			if (e.effect_type === 'leech') {
				const isVictim = Number(e.target_member_id) === Number(member.id);
				base.leechRole = isVictim ? 'victim' : 'attacker';
				base.leechWith = isVictim
					? (await isMemberDisguised(e.beneficiary_member_id))
						? DISGUISED_MENTION
						: nameOf(e.beneficiary_server_display_name, e.beneficiary_display_name, e.beneficiary_username)
					: nameOf(e.target_server_display_name, e.target_display_name, e.target_username);
			}
			return base;
		})
	);

	const luckEffect = (effectRows as any[]).find((e) => e.effect_type === 'luck');
	const luckPercent = luckEffect ? Number(luckEffect.effect_value) || 0 : 0;
	const pricedItems = (items as any[]).map((i) => {
		const original = Number(i.cost) || 0;
		const cost = discountedItemCost(original, luckPercent, i.effect_type);
		return cost !== original ? { ...i, cost, original_cost: original } : i;
	});

	const cooldownMinByAction: Record<'steal' | 'bomb', number> = { steal: 0, bomb: 0 };
	const immunityMinByAction: Record<'steal' | 'bomb', number> = { steal: 0, bomb: 0 };
	for (const it of items as any[]) {
		if (it.effect_type !== 'steal' && it.effect_type !== 'bomb') continue;
		const cfg = it.config || {};
		const action = it.effect_type as 'steal' | 'bomb';
		cooldownMinByAction[action] = Math.max(cooldownMinByAction[action], Number(cfg.cooldown_minutes) || 0);
		immunityMinByAction[action] = Math.max(immunityMinByAction[action], Number(cfg.immunity_minutes) || 0);
	}

	const attackCooldowns: { action: 'steal' | 'bomb'; until: number }[] = [];
	for (const action of ['steal', 'bomb'] as const) {
		const min = cooldownMinByAction[action];
		if (min <= 0) continue;
		const last = await db.getLastAttackActionByActor(member.id, [action]).catch(() => null);
		if (!last) continue;
		const ends = last.getTime() + min * 60000;
		if (ends > Date.now()) attackCooldowns.push({ action, until: ends });
	}

	let immuneUntil: number | null = null;
	for (const action of ['steal', 'bomb'] as const) {
		const min = immunityMinByAction[action];
		if (min <= 0) continue;
		const last = await db.getLastActionAgainstTarget(member.id, [action]).catch(() => null);
		if (!last) continue;
		const ends = last.getTime() + min * 60000;
		if (ends > Date.now() && (immuneUntil === null || ends > immuneUntil)) immuneUntil = ends;
	}

	let insuranceCooldownUntil: number | null = null;
	let maxInsuranceCooldownMin = 0;
	for (const it of items as any[]) {
		if (it.effect_type !== 'insurance') continue;
		maxInsuranceCooldownMin = Math.max(maxInsuranceCooldownMin, Number((it.config || {}).cooldown_minutes) || 0);
	}
	if (maxInsuranceCooldownMin > 0) {
		const last = await db.getLastActionByActor(member.id, 'insurance').catch(() => null);
		if (last) {
			const ends = last.getTime() + maxInsuranceCooldownMin * 60000;
			if (ends > Date.now()) insuranceCooldownUntil = ends;
		}
	}

	const bountyTotal = await db.getActiveBountyTotal(member.id).catch(() => 0);

	return {
		readOnly: false as const,
		member,
		items: pricedItems,
		hash,
		bagStock,
		categories: [...new Set([...enabledCategories, ...(invRows as any[]).map((r) => r.effect_type)])],
		memberName: member.server_display_name || member.display_name || member.username,
		memberDiscordId: String(member.discord_member_id),
		memberAvatar: member.avatar ?? null,
		memberCard: {
			discord_member_id: String(member.discord_member_id),
			username: member.username ?? null,
			display_name: member.display_name ?? null,
			server_display_name: member.server_display_name ?? null,
			avatar: member.avatar ?? null,
			level: Number(member.level ?? 0) || 0,
			experience: Number(member.experience ?? 0) || 0,
			rank: member.rank != null ? Number(member.rank) : null,
			chat_total: Number(member.chat_total ?? 0) || 0,
			voice_minutes_active: Number(member.voice_minutes_active ?? 0) || 0,
			member_since: member.member_since ? new Date(member.member_since).toISOString() : null,
			roles: (member.roles ?? []).map((r: any) => ({ name: r.name, color: r.color, position: r.position }))
		},
		balance: {
			experience: Number(member.experience ?? 0) || 0,
			level: Number(member.level ?? 1) || 1,
			rank: member.rank != null ? Number(member.rank) : null
		},
		activeEffects,
		attackCooldowns,
		immuneUntil,
		insuranceCooldownUntil,
		bountyTotal,
		levelReq,
		luckPercent
	};
}

export function postBotWebhook(bot: any, payload: any): Promise<{ status: number; body: any }> {
	const body = JSON.stringify(payload);
	return new Promise((resolve) => {
		const req = httpRequest(
			{
				hostname: 'localhost',
				port: bot.port,
				path: '/',
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Secret-Key': bot.secret_key }
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode ?? 500, body: null });
					}
				});
			}
		);
		req.on('error', () => resolve({ status: 502, body: null }));
		req.write(body);
		req.end();
	});
}
