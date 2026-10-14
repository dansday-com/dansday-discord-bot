import { createHmac, timingSafeEqual } from 'crypto';
import db from '../../../database.js';
import { itemAvailability, effectiveBagStock, discountedItemCost, DISGUISED_MENTION, floatingWallClockMs } from '../../../items.js';
import { resolveMemberThemeForClient } from '../../storage/memberThemes.js';
import type { BotRow, ServerRow } from '../../../schema.js';
import type { MemberListRow } from '../../../database.js';
import { DAY_MINUTES, MINUTE_MS, MINUTES_PER_HOUR, SECONDS_PER_MINUTE, SECOND_MS } from '../../../utils/time.js';
import { DEFAULT_LEVELING_SETTINGS } from '../../../levelingDefaults.js';

const LAST_MINUTE_OF_DAY = DAY_MINUTES - 1;
const LAST_SECOND_OF_MINUTE = SECONDS_PER_MINUTE - 1;

type ItemDbRow = Omit<Awaited<ReturnType<typeof db.listItems>>[number], 'enabled' | 'usable'> & { enabled: boolean | number; usable: boolean | number };

export type CatalogItem = {
	id: number;
	name: string;
	effect_type: string;
	description: string | null;
	cost: number;
	enabled: boolean;
	usable: boolean;
	availableUntil: number | null;
	available_from: string | null;
	available_to: string | null;
	recurring_schedule: unknown;
	config: Record<string, unknown> | null;
	live: boolean;
};

export function computeCardToken(serverId: number, discordMemberId: string): string {
	const secret = process.env.SECRET;
	if (!secret) {
		throw new Error('SECRET is not configured; account card links cannot be signed.');
	}
	return createHmac('sha256', secret)
		.update(`card:${Number(serverId)}:${discordMemberId}`)
		.digest('hex');
}

export async function resolveMemberByCardToken(serverId: number, token: string): Promise<MemberListRow | null> {
	if (!token) {
		return null;
	}
	const supplied = Buffer.from(String(token), 'utf8');
	const members = await db.getServerMembersList(serverId).catch(() => []);
	for (const m of members) {
		if (!m.discord_member_id) {
			continue;
		}
		const expected = Buffer.from(computeCardToken(serverId, m.discord_member_id), 'utf8');
		if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
			return m;
		}
	}
	return null;
}

export const SENTINEL_GUEST = 'guest';

export function itemsCardTokenFromUrl(urlHash: unknown): string {
	const raw = urlHash != null ? String(urlHash) : '';
	return raw && raw !== SENTINEL_GUEST ? raw : '';
}

export async function resolveActiveBotForServer(server: ServerRow): Promise<BotRow | null> {
	const officialBotId = await db.resolveOfficialBotIdForServer(server).catch(() => null);
	if (officialBotId == null) {
		return null;
	}
	const bot = await db.getBot(officialBotId).catch(() => null);
	return bot ?? null;
}

async function isMemberDisguised(memberId: number | string | null): Promise<boolean> {
	const effects = await db.getActiveEffectsForMember(memberId).catch(() => []);
	return (effects || []).some((e) => e.effect_type === 'disguise' && Number(e.owner_member_id) === Number(memberId));
}

function safeParse(raw: string) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function scheduleMinutes(hhmm: unknown, fallback: number): number {
	if (hhmm == null || hhmm === '') {
		return fallback;
	}
	const [h, m] = String(hhmm)
		.split(':')
		.map((n) => Number(n) || 0);
	return h * MINUTES_PER_HOUR + m;
}

function availableUntilMs(item: { available_to: string | null; recurring_schedule: unknown }): number | null {
	const ends: number[] = [];
	if (item.available_to) {
		const t = floatingWallClockMs(item.available_to, 0);
		if (t != null) {
			ends.push(t);
		}
	}
	const schedule = typeof item.recurring_schedule === 'string' ? safeParse(item.recurring_schedule) : item.recurring_schedule;
	if (schedule && Array.isArray(schedule.days) && schedule.days.length > 0) {
		const now = new Date();
		const toMin = scheduleMinutes(schedule.to, LAST_MINUTE_OF_DAY);
		const endOfWindow =
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0) + (toMin * SECONDS_PER_MINUTE + LAST_SECOND_OF_MINUTE) * SECOND_MS;
		if (Number.isFinite(endOfWindow)) {
			ends.push(endOfWindow);
		}
	}
	if (ends.length === 0) {
		return null;
	}
	return Math.min(...ends);
}

export async function loadItemsCatalog(serverId: number): Promise<CatalogItem[]> {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (panelId == null) {
		return [];
	}
	const all = await db.listItems(panelId).catch(() => []);
	const out: CatalogItem[] = [];
	for (const i of all as ItemDbRow[]) {
		const isEnabled = i.enabled !== false && i.enabled !== 0;

		const mapped = {
			id: i.id,
			name: i.name,
			effect_type: i.effect_type,
			description: i.description,
			cost: i.cost,
			enabled: isEnabled,
			usable: i.usable !== false && i.usable !== 0,
			availableUntil: availableUntilMs(i),
			available_from: i.available_from ?? null,
			available_to: i.available_to ?? null,
			recurring_schedule: typeof i.recurring_schedule === 'string' ? safeParse(i.recurring_schedule) : (i.recurring_schedule ?? null),
			config: (typeof i.config === 'string' ? safeParse(i.config) : i.config) as Record<string, unknown> | null
		};
		const { state } = itemAvailability(mapped, Date.now(), 0);
		const isListed = mapped.enabled || mapped.usable;
		out.push({ ...mapped, live: isListed && (state === 'active' || state === 'upcoming') });
	}
	return out;
}

type CardMember = NonNullable<Awaited<ReturnType<typeof resolveMemberByCardToken>>>;
type EffectRow = Awaited<ReturnType<typeof db.getActiveEffectsForMember>>[number];
type AttackAction = 'steal' | 'bomb';
type AttackLimits = { cooldownMin: Record<AttackAction, number>; immunityMin: Record<AttackAction, number>; insuranceCooldownMin: number };

const ATTACK_ACTIONS = ['steal', 'bomb'] as const;

async function levelRequirement(serverId: number, levelingComponent: string) {
	const levelingRow = await db.getServerSettings(serverId, levelingComponent).catch(() => null);
	const req = (levelingRow?.settings?.REQUIREMENTS as { BASE_XP?: unknown; MULTIPLIER?: unknown } | undefined) ?? {};
	return {
		baseXp: Number(req.BASE_XP) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.BASE_XP,
		multiplier: Number(req.MULTIPLIER) || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.MULTIPLIER
	};
}

function memberLabel(sdn: string | null, dn: string | null, un: string | null) {
	return sdn || dn || un || 'a member';
}

async function leechPartner(e: EffectRow, isVictim: boolean) {
	if (!isVictim) {
		return memberLabel(e.target_server_display_name, e.target_display_name, e.target_username);
	}
	return (await isMemberDisguised(e.beneficiary_member_id))
		? DISGUISED_MENTION
		: memberLabel(e.beneficiary_server_display_name, e.beneficiary_display_name, e.beneficiary_username);
}

function memberActiveEffects(member: CardMember, effectRows: EffectRow[]) {
	return Promise.all(
		effectRows.map(async (e) => {
			const isLeech = e.effect_type === 'leech';
			const isVictim = Number(e.target_member_id) === Number(member.id);
			return {
				effect_type: e.effect_type,
				effect_value: Number(e.effect_value) || 0,
				expiresAt: e.expires_at ? new Date(e.expires_at).getTime() : null,
				leechRole: isLeech ? (isVictim ? 'victim' : 'attacker') : (null as 'attacker' | 'victim' | null),
				leechWith: isLeech ? await leechPartner(e, isVictim) : (null as string | null)
			};
		})
	);
}

function pricedCatalog(items: CatalogItem[], luckPercent: number) {
	return items.map((i) => {
		const original = Number(i.cost) || 0;
		const cost = discountedItemCost(original, luckPercent, i.effect_type);
		return cost !== original ? { ...i, cost, original_cost: original } : i;
	});
}

function attackLimits(items: CatalogItem[]): AttackLimits {
	const limits: AttackLimits = { cooldownMin: { steal: 0, bomb: 0 }, immunityMin: { steal: 0, bomb: 0 }, insuranceCooldownMin: 0 };
	for (const it of items) {
		const cfg = it.config || {};
		if (it.effect_type === 'insurance') {
			limits.insuranceCooldownMin = Math.max(limits.insuranceCooldownMin, Number(cfg.cooldown_minutes) || 0);
		}
		if (it.effect_type === 'steal' || it.effect_type === 'bomb') {
			limits.cooldownMin[it.effect_type] = Math.max(limits.cooldownMin[it.effect_type], Number(cfg.cooldown_minutes) || 0);
			limits.immunityMin[it.effect_type] = Math.max(limits.immunityMin[it.effect_type], Number(cfg.immunity_minutes) || 0);
		}
	}
	return limits;
}

function endsAfter(last: Date | null, minutes: number): number | null {
	if (!last || minutes <= 0) {
		return null;
	}
	const ends = last.getTime() + minutes * MINUTE_MS;
	return ends > Date.now() ? ends : null;
}

async function memberAttackTimings(memberId: number, limits: AttackLimits) {
	const attackCooldowns: { action: AttackAction; until: number }[] = [];
	let immuneUntil: number | null = null;
	for (const action of ATTACK_ACTIONS) {
		const cooldownMin = limits.cooldownMin[action];
		const cooldownEnds = cooldownMin > 0 ? endsAfter(await db.getLastAttackActionByActor(memberId, [action]).catch(() => null), cooldownMin) : null;
		if (cooldownEnds !== null) {
			attackCooldowns.push({ action, until: cooldownEnds });
		}
	}
	for (const action of ATTACK_ACTIONS) {
		const immunityMin = limits.immunityMin[action];
		const immunityEnds = immunityMin > 0 ? endsAfter(await db.getLastActionAgainstTarget(memberId, [action]).catch(() => null), immunityMin) : null;
		if (immunityEnds !== null && (immuneUntil === null || immunityEnds > immuneUntil)) {
			immuneUntil = immunityEnds;
		}
	}
	const insuranceCooldownUntil =
		limits.insuranceCooldownMin > 0 ? endsAfter(await db.getLastActionByActor(memberId, 'insurance').catch(() => null), limits.insuranceCooldownMin) : null;
	return { attackCooldowns, immuneUntil, insuranceCooldownUntil };
}

export async function loadItemsShared(server: Pick<ServerRow, 'id'>, hash: string, subKey?: 'items' | 'market' | 'minigames' | null) {
	const { SERVER_SETTINGS, publicSubfeatureEnabled } = await import('../../panelServer.js');

	const psRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public).catch(() => null);
	const ps = psRow?.settings ?? {};
	if (subKey && !publicSubfeatureEnabled(ps, subKey)) {
		return { notFound: true } as const;
	}

	const levelReq = await levelRequirement(server.id, SERVER_SETTINGS.component.leveling);
	const items = await loadItemsCatalog(server.id);
	const enabledCategories = [...new Set(items.filter((i) => i.live).map((i) => i.effect_type))];

	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;
	if (!member) {
		return { guest: true as const };
	}

	const invRows = await db.getMemberInventory(member.id).catch(() => []);
	const bagStock = effectiveBagStock(invRows);
	const effectRows = await db.getActiveEffectsForMember(member.id).catch(() => []);
	const activeEffects = await memberActiveEffects(member, effectRows);

	const luckEffect = effectRows.find((e) => e.effect_type === 'luck');
	const luckPercent = luckEffect ? Number(luckEffect.effect_value) || 0 : 0;
	const pricedItems = pricedCatalog(items, luckPercent);
	const { attackCooldowns, immuneUntil, insuranceCooldownUntil } = await memberAttackTimings(member.id, attackLimits(items));

	const bountyTotal = await db.getActiveBountyTotal(member.id).catch(() => 0);
	const memberTheme = resolveMemberThemeForClient(await db.getMemberTheme(member.id).catch(() => null));

	return {
		readOnly: false as const,
		member,
		items: pricedItems,
		hash,
		bagStock,
		categories: [
			...new Set([
				...enabledCategories,
				...invRows.filter((r) => (r.enabled !== false && r.enabled !== 0) || (r.usable !== false && r.usable !== 0)).map((r) => r.effect_type)
			])
		],
		memberName: member.server_display_name || member.display_name || member.username,
		memberDiscordId: String(member.discord_member_id),
		memberAvatar: member.avatar ?? null,
		memberTheme,
		balance: {
			xp: Number(member.xp ?? 0) || 0,
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
