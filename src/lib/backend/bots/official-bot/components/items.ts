import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { getLevelRequirement, determineLevel } from './leveling.js';

const EFFECT_CACHE_TTL_MS = 5000;
const memoryEffectCache = new Map();

function effectCacheKey(memberId: any) {
	return `items:effects:${memberId}`;
}

async function readActiveEffects(memberId: any) {
	const rows = await db.getActiveEffectsForMember(memberId).catch(() => null);
	return Array.isArray(rows) ? rows : [];
}

async function getCachedActiveEffects(memberId: any) {
	const key = effectCacheKey(memberId);
	const redis = await getRedisClient().catch(() => null);

	if (redis) {
		try {
			const cached = await redis.get(key);
			if (cached != null) return JSON.parse(cached);
		} catch (_) {}
	} else {
		const entry = memoryEffectCache.get(key);
		if (entry && entry.expiresAt > Date.now()) return entry.value;
	}

	const effects = await readActiveEffects(memberId);

	if (redis) {
		try {
			await redis.set(key, JSON.stringify(effects), { PX: EFFECT_CACHE_TTL_MS });
		} catch (_) {}
	} else {
		memoryEffectCache.set(key, { value: effects, expiresAt: Date.now() + EFFECT_CACHE_TTL_MS });
	}

	return effects;
}

async function invalidateEffectCache(memberId: any) {
	const key = effectCacheKey(memberId);
	memoryEffectCache.delete(key);
	const redis = await getRedisClient().catch(() => null);
	if (redis) {
		try {
			await redis.del(key);
		} catch (_) {}
	}
}

function parseConfig(raw: any) {
	if (!raw) return {} as any;
	if (typeof raw === 'object') return raw;
	try {
		return JSON.parse(raw);
	} catch (_) {
		return {} as any;
	}
}

function effectScopeMatches(effect: any, source: any) {
	const config = parseConfig(effect.config);
	const scope = config.scope || 'all';
	if (scope === 'all') return true;
	return scope === source;
}

export async function computeAwardModifiers(memberId: any, source: any = 'all') {
	const effects = await getCachedActiveEffects(memberId);
	let multiplier = 1;
	let skimPercent = 0;
	const leeches: any[] = [];

	for (const effect of effects) {
		if (effect.effect_type === 'xp_boost' && effectScopeMatches(effect, source)) {
			const m = Number(effect.magnitude) || 0;
			if (m > 0) multiplier *= m;
		} else if (effect.effect_type === 'leech') {
			const pct = Number(effect.magnitude) || 0;
			if (pct > 0 && effect.source_member_id != null) {
				skimPercent += pct;
				leeches.push({ sourceMemberId: Number(effect.source_member_id), percent: pct });
			}
		}
	}

	if (skimPercent > 100) skimPercent = 100;

	return { multiplier, skimPercent, leeches };
}

export async function applyAwardEffects(memberId: any, baseXp: any, source: any = 'all') {
	const safeBase = Math.max(0, Math.floor(Number(baseXp) || 0));
	if (safeBase <= 0) return { memberXp: 0, leechCredits: [] as any[], multiplier: 1, boosted: false, skimPercent: 0, leeched: false };

	const { multiplier, skimPercent, leeches } = await computeAwardModifiers(memberId, source);
	const boosted = Math.floor(safeBase * multiplier);
	const totalSkim = Math.floor((boosted * skimPercent) / 100);
	const memberXp = Math.max(0, boosted - totalSkim);

	const leechCredits: any[] = [];
	let remaining = totalSkim;
	for (let i = 0; i < leeches.length && remaining > 0; i++) {
		const leech = leeches[i];
		const isLast = i === leeches.length - 1;
		const share = isLast ? remaining : Math.floor((boosted * leech.percent) / 100);
		const amount = Math.min(remaining, share);
		if (amount > 0) {
			leechCredits.push({ sourceMemberId: leech.sourceMemberId, amount });
			remaining -= amount;
		}
	}

	return { memberXp, leechCredits, multiplier, boosted: multiplier > 1, skimPercent, leeched: totalSkim > 0 };
}

export async function creditLeechers(leechCredits: any, guildId: any) {
	if (!Array.isArray(leechCredits) || leechCredits.length === 0) return;
	for (const credit of leechCredits) {
		try {
			await db.ensureMemberLevel(credit.sourceMemberId);
			const before = await db.getMemberLevel(credit.sourceMemberId);
			const after = await db.updateMemberLevelStats(credit.sourceMemberId, { experienceIncrement: credit.amount });
			await reevaluateLevel(credit.sourceMemberId, after ?? before, guildId);
		} catch (error: any) {
			await logger.log(`⚠️ Leech credit failed for member ${credit.sourceMemberId}: ${error.message}`);
		}
	}
}

async function reevaluateLevel(memberId: any, stats: any, guildId: any) {
	if (!stats || !guildId) return stats;
	const rawXp = stats.experience ?? 0;
	const xp = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
	const expectedLevel = await determineLevel(xp, guildId);
	let storedLevel = stats.level;
	if (typeof storedLevel === 'bigint') storedLevel = Number(storedLevel);
	if (storedLevel !== expectedLevel) {
		return db.updateMemberLevelStats(memberId, { level: expectedLevel });
	}
	return stats;
}

export async function getSpendableXp(memberId: any, guildId: any) {
	const stats = await db.getMemberLevel(memberId);
	if (!stats) return { total: 0, spendable: 0, floor: 0, level: 1 };
	const rawXp = stats.experience ?? 0;
	const total = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
	let level = stats.level;
	if (typeof level === 'bigint') level = Number(level);
	level = Number(level) || 1;
	const floor = await getLevelRequirement(level, guildId);
	const spendable = Math.max(0, total - floor);
	return { total, spendable, floor, level };
}

export async function spendXp(memberId: any, amount: any, guildId: any) {
	const cost = Math.max(0, Math.floor(Number(amount) || 0));
	if (cost <= 0) return { ok: true, stats: await db.getMemberLevel(memberId) };
	const stats = await db.getMemberLevel(memberId);
	const rawXp = stats?.experience ?? 0;
	const total = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
	if (total < cost) return { ok: false, reason: 'insufficient_xp', stats };
	const updated = await db.updateMemberLevelStats(memberId, { experienceIncrement: -cost });
	const reevaluated = await reevaluateLevel(memberId, updated, guildId);
	return { ok: true, stats: reevaluated };
}

function rollPercent(minPercent: any, maxPercent: any) {
	const min = Math.max(0, Math.min(100, Number(minPercent) || 0));
	const max = Math.max(min, Math.min(100, Number(maxPercent) || min));
	return min + Math.floor(Math.random() * (max - min + 1));
}

async function hasActiveShield(memberId: any) {
	const effects = await getCachedActiveEffects(memberId);
	return effects.some((e: any) => e.effect_type === 'shield');
}

async function attackCooldownUntil(actorMemberId: any, cooldownMinutes: any): Promise<Date | null> {
	const minutes = Math.max(0, Number(cooldownMinutes) || 0);
	if (minutes <= 0) return null;
	const last = await db.getLastAttackActionByActor(actorMemberId);
	if (!last) return null;
	const until = new Date(last.getTime() + minutes * 60000);
	return until.getTime() > Date.now() ? until : null;
}

async function targetImmuneUntil(targetMemberId: any, immunityMinutes: any): Promise<Date | null> {
	const minutes = Math.max(0, Number(immunityMinutes) || 0);
	if (minutes <= 0) return null;
	const last = await db.getLastActionAgainstTarget(targetMemberId, ['steal', 'bomb']);
	if (!last) return null;
	const until = new Date(last.getTime() + minutes * 60000);
	return until.getTime() > Date.now() ? until : null;
}

export async function resolveSteal({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	if (await attackCooldownUntil(actorMemberId, cfg.cooldown_minutes)) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'steal', xp_amount: 0, outcome: 'blocked' });
		return { outcome: 'blocked', xp: 0 };
	}
	if (await targetImmuneUntil(targetMemberId, cfg.immunity_minutes)) {
		return { outcome: 'immune', xp: 0 };
	}

	const target = await getSpendableXp(targetMemberId, guildId);
	const pct = rollPercent(cfg.min_percent ?? 1, cfg.max_percent ?? 25);
	const amount = Math.min(target.total, Math.floor((target.total * pct) / 100));

	if (await consumeReactiveDefense(targetMemberId, 'reflect')) {
		if (amount > 0) {
			await spendXp(actorMemberId, amount, guildId);
			await invalidateEffectCache(actorMemberId);
		}
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'steal', xp_amount: amount, outcome: 'reflected' });
		return { outcome: 'reflected', xp: amount };
	}

	if (amount <= 0) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'steal', xp_amount: 0, outcome: 'success' });
		return { outcome: 'success', xp: 0 };
	}

	const spent = await spendXp(targetMemberId, amount, guildId);
	if (!spent.ok) return { outcome: 'immune', xp: 0 };

	await db.ensureMemberLevel(actorMemberId);
	const actorStats = await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: amount });
	await reevaluateLevel(actorMemberId, actorStats, guildId);

	let refunded = 0;
	if (await consumeReactiveDefense(targetMemberId, 'insurance')) {
		const refundStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: amount });
		await reevaluateLevel(targetMemberId, refundStats, guildId);
		refunded = amount;
	}

	const bountyCollected = await payoutBountyOnHit(targetMemberId, actorMemberId, guildId);

	await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'steal', xp_amount: amount, outcome: 'success' });
	await invalidateEffectCache(targetMemberId);
	const grantedImmunityUntil = newImmunityUntil(cfg.immunity_minutes);
	return { outcome: 'success', xp: amount, percent: pct, refunded, bountyCollected, immuneUntil: grantedImmunityUntil };
}

export async function resolveBomb({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	if (await attackCooldownUntil(actorMemberId, cfg.cooldown_minutes)) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'bomb', xp_amount: 0, outcome: 'blocked' });
		return { outcome: 'blocked', xp: 0 };
	}
	if (await targetImmuneUntil(targetMemberId, cfg.immunity_minutes)) {
		return { outcome: 'immune', xp: 0 };
	}

	const target = await getSpendableXp(targetMemberId, guildId);
	const pct = rollPercent(cfg.min_percent ?? 1, cfg.max_percent ?? 50);
	const amount = Math.min(target.total, Math.floor((target.total * pct) / 100));

	if (await consumeReactiveDefense(targetMemberId, 'reflect')) {
		if (amount > 0) {
			await spendXp(actorMemberId, amount, guildId);
			await invalidateEffectCache(actorMemberId);
		}
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'bomb', xp_amount: amount, outcome: 'reflected' });
		return { outcome: 'reflected', xp: amount };
	}

	if (amount > 0) {
		await spendXp(targetMemberId, amount, guildId);
	}

	let refunded = 0;
	if (amount > 0 && (await consumeReactiveDefense(targetMemberId, 'insurance'))) {
		const refundStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: amount });
		await reevaluateLevel(targetMemberId, refundStats, guildId);
		refunded = amount;
	}

	await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'bomb', xp_amount: amount, outcome: 'success' });
	await invalidateEffectCache(targetMemberId);
	const grantedImmunityUntil = newImmunityUntil(cfg.immunity_minutes);
	return { outcome: 'success', xp: amount, percent: pct, refunded, immuneUntil: grantedImmunityUntil };
}

function computeExpiry(durationMinutes: any) {
	const minutes = Math.max(1, Number(durationMinutes) || 60);
	return new Date(Date.now() + minutes * 60000);
}

function newImmunityUntil(immunityMinutes: any): Date | null {
	const minutes = Math.max(0, Number(immunityMinutes) || 0);
	if (minutes <= 0) return null;
	return new Date(Date.now() + minutes * 60000);
}

export async function resolveBoost({ memberItemId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { magnitude: Number(cfg.multiplier ?? 2), expires_at: expiresAt });
	return { outcome: 'success', expiresAt };
}

export async function resolveShield({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { magnitude: 1, expires_at: expiresAt });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt };
}

export async function resolveLeech({ memberItemId, actorMemberId, targetMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, {
		magnitude: Number(cfg.skim_percent ?? 10),
		source_member_id: actorMemberId,
		expires_at: expiresAt
	});
	await invalidateEffectCache(targetMemberId);
	return { outcome: 'success', expiresAt };
}

export async function resolveReflect({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { magnitude: 1, expires_at: expiresAt });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt };
}

export async function resolveInsurance({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { magnitude: 1, expires_at: expiresAt });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt };
}

export async function resolveGift({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const amount = Math.max(0, Math.floor(Number(cfg.gift_amount) || 0));
	if (amount <= 0) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'gift', xp_amount: 0, outcome: 'success' });
		return { outcome: 'success', xp: 0 };
	}
	const taxPercent = Math.max(0, Math.min(100, Number(cfg.tax_percent) || 0));
	const received = Math.max(0, amount - Math.floor((amount * taxPercent) / 100));

	await db.ensureMemberLevel(targetMemberId);
	const targetStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: received });
	await reevaluateLevel(targetMemberId, targetStats, guildId);

	await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'gift', xp_amount: received, outcome: 'success' });
	return { outcome: 'success', xp: received };
}

export async function resolveGamble({ actorMemberId, actorMemberItemId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const stake = Math.max(0, Math.floor(Number(cfg.stake) || 0));
	const winChance = Math.max(0, Math.min(100, Number(cfg.win_chance) || 0));
	const payoutMultiplier = Math.max(0, Number(cfg.payout_multiplier) || 0);

	if (stake <= 0) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: null, action: 'gamble', xp_amount: 0, outcome: 'win' });
		return { outcome: 'win', xp: 0, won: true };
	}

	const spend = await spendXp(actorMemberId, stake, guildId);
	if (!spend.ok) return { outcome: 'insufficient', xp: 0 };

	const roll = Math.floor(Math.random() * 100) + 1;
	const won = roll <= winChance;

	let netChange = -stake;
	if (won) {
		const payout = Math.floor(stake * payoutMultiplier);
		await db.ensureMemberLevel(actorMemberId);
		const stats = await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: payout });
		await reevaluateLevel(actorMemberId, stats, guildId);
		netChange = payout - stake;
	}

	await db.logMemberItemAction(actorMemberItemId, { target_member_id: null, action: 'gamble', xp_amount: Math.abs(netChange), outcome: won ? 'win' : 'lose' });
	return { outcome: won ? 'win' : 'lose', won, stake, net: netChange };
}

export async function resolveBounty({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const amount = Math.max(0, Math.floor(Number(cfg.bounty_amount) || 0));
	if (amount <= 0) return { outcome: 'success', xp: 0 };

	const spend = await spendXp(actorMemberId, amount, guildId);
	if (!spend.ok) return { outcome: 'insufficient', xp: 0 };

	await db.placeBounty(targetMemberId, actorMemberId, amount);
	await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'bounty', xp_amount: amount, outcome: 'success' });
	return { outcome: 'success', xp: amount };
}

export async function resolveCosmetic({ actorMemberId, itemId, config }: any) {
	const cfg = parseConfig(config);
	const kind = cfg.cosmetic_kind || 'theme';
	const value = cfg.value ?? '';
	await db.equipCosmetic(actorMemberId, kind, value, itemId);
	return { outcome: 'success', cosmetic_kind: kind, value };
}

async function payoutBountyOnHit(targetMemberId: any, attackerMemberId: any, guildId: any) {
	const total = await db.collectBounties(targetMemberId).catch(() => 0);
	if (!total || total <= 0) return 0;
	await db.ensureMemberLevel(attackerMemberId);
	const stats = await db.updateMemberLevelStats(attackerMemberId, { experienceIncrement: total });
	await reevaluateLevel(attackerMemberId, stats, guildId);
	return total;
}

async function consumeReactiveDefense(memberId: any, kind: string) {
	const effects = await getCachedActiveEffects(memberId);
	const match = effects.find((e: any) => e.effect_type === kind);
	if (!match) return false;
	await db.expireMemberItemActive(match.id).catch(() => null);
	await invalidateEffectCache(memberId);
	return true;
}

async function resolveServerMemberId(serverId: any, discordMemberId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordMemberId)).catch(() => null);
	return member?.id ?? null;
}

const TARGETED_EFFECTS = new Set(['xp_steal', 'xp_bomb', 'leech', 'gift', 'bounty']);

export async function handleItemUse(client: any, payload: any) {
	const { guild_id, actor_discord_id, target_discord_id, member_item_id } = payload || {};
	if (!guild_id || !actor_discord_id || !member_item_id) {
		return { ok: false, error: 'missing_fields' };
	}

	const { getServerForCurrentBot, isComponentFeatureEnabled, serverSettingsComponent } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}

	if (!(await isComponentFeatureEnabled(guild_id, serverSettingsComponent.items))) {
		return { ok: false, error: 'shop_disabled' };
	}

	const memberItem = await db.getMemberItem(member_item_id).catch(() => null);
	if (!memberItem) return { ok: false, error: 'item_not_found' };

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId || Number(memberItem.member_id) !== Number(actorMemberId)) {
		return { ok: false, error: 'not_owner' };
	}
	if (Number(memberItem.quantity) <= 0) return { ok: false, error: 'out_of_stock' };

	const item = await db.getBotItem(memberItem.item_id).catch(() => null);
	if (!item) return { ok: false, error: 'catalog_item_missing' };

	const config = parseConfig(item.config);
	const effectType = item.effect_type;

	let targetMemberId: any = null;
	if (TARGETED_EFFECTS.has(effectType)) {
		if (!target_discord_id) return { ok: false, error: 'target_required' };
		targetMemberId = await resolveServerMemberId(server.id, target_discord_id);
		if (!targetMemberId) return { ok: false, error: 'target_not_found' };
		if (Number(targetMemberId) === Number(actorMemberId)) return { ok: false, error: 'cannot_target_self' };
	}

	const consumed = await db.consumeMemberItem(member_item_id, 1);
	if (!consumed) return { ok: false, error: 'out_of_stock' };

	let result: any;
	try {
		if (effectType === 'xp_steal') {
			result = await resolveSteal({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'xp_bomb') {
			result = await resolveBomb({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'xp_boost') {
			result = await resolveBoost({ memberItemId: member_item_id, config });
			await invalidateEffectCache(actorMemberId);
		} else if (effectType === 'shield') {
			result = await resolveShield({ memberItemId: member_item_id, ownerMemberId: actorMemberId, config });
		} else if (effectType === 'leech') {
			result = await resolveLeech({ memberItemId: member_item_id, actorMemberId, targetMemberId, config });
		} else if (effectType === 'reflect') {
			result = await resolveReflect({ memberItemId: member_item_id, ownerMemberId: actorMemberId, config });
		} else if (effectType === 'insurance') {
			result = await resolveInsurance({ memberItemId: member_item_id, ownerMemberId: actorMemberId, config });
		} else if (effectType === 'gift') {
			result = await resolveGift({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'gamble') {
			result = await resolveGamble({ actorMemberId, actorMemberItemId: member_item_id, config, guildId: guild_id });
		} else if (effectType === 'bounty') {
			result = await resolveBounty({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'cosmetic') {
			result = await resolveCosmetic({ actorMemberId, itemId: memberItem.item_id, config });
		} else {
			result = { outcome: 'unsupported' };
		}
	} catch (err: any) {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		await logger.log(`❌ Item use failed (${effectType}): ${err.message}`);
		return { ok: false, error: 'resolution_failed' };
	}

	if (result?.outcome === 'cooldown' || result?.outcome === 'immune' || result?.outcome === 'insufficient') {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		return { ok: false, error: result.outcome, outcome: result.outcome };
	}

	await announceItemUse(client, {
		guildId: guild_id,
		actorDiscordId: actor_discord_id,
		targetDiscordId: target_discord_id,
		effectType,
		item,
		result
	}).catch(() => null);

	return { ok: true, outcome: result?.outcome ?? 'success', effect_type: effectType, result };
}

function isItemAvailableNow(item: any) {
	const nowMs = Date.now();
	if (item.available_from) {
		const from = new Date(item.available_from).getTime();
		if (Number.isFinite(from) && nowMs < from) return false;
	}
	if (item.available_to) {
		const to = new Date(item.available_to).getTime();
		if (Number.isFinite(to) && nowMs > to) return false;
	}
	const schedule = parseConfig(item.recurring_schedule);
	if (schedule && Array.isArray(schedule.days) && schedule.days.length > 0) {
		const now = new Date(nowMs);
		const day = now.getUTCDay();
		if (!schedule.days.includes(day)) return false;
		if (schedule.from && schedule.to) {
			const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
			const toMin = (hhmm: any) => {
				const [h, m] = String(hhmm)
					.split(':')
					.map((n) => Number(n) || 0);
				return h * 60 + m;
			};
			const start = toMin(schedule.from);
			const end = toMin(schedule.to);
			if (minutes < start || minutes > end) return false;
		}
	}
	return true;
}

export async function handleItemBuy(client: any, payload: any) {
	const { guild_id, actor_discord_id, item_id, quantity } = payload || {};
	if (!guild_id || !actor_discord_id || !item_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isComponentFeatureEnabled, serverSettingsComponent } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isComponentFeatureEnabled(guild_id, serverSettingsComponent.items))) {
		return { ok: false, error: 'shop_disabled' };
	}

	const item = await db.getBotItem(item_id).catch(() => null);
	if (!item || item.enabled !== true) return { ok: false, error: 'item_unavailable' };
	if (!isItemAvailableNow(item)) return { ok: false, error: 'item_not_in_window' };

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
	const totalCost = (Number(item.cost) || 0) * qty;

	const spend = await spendXp(actorMemberId, totalCost, guild_id);
	if (!spend.ok) return { ok: false, error: spend.reason || 'insufficient_xp' };

	await db.ensureMemberLevel(actorMemberId);
	const owned = await db.grantMemberItem(actorMemberId, item_id, qty);
	return { ok: true, member_item_id: owned?.id, quantity: owned?.quantity, cost: totalCost };
}

const ANNOUNCED_EFFECTS = new Set(['xp_steal', 'xp_bomb', 'leech', 'gift', 'bounty', 'gamble', 'shield', 'reflect', 'insurance', 'xp_boost', 'vault']);

function discordRelative(date: any): string | null {
	if (!date) return null;
	const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
	if (!Number.isFinite(ms)) return null;
	return `<t:${Math.floor(ms / 1000)}:R>`;
}

function fmtXp(n: any): string {
	return `${(Number(n) || 0).toLocaleString()} XP`;
}

function buildItemUseEmbed(EmbedBuilder: any, embedConfig: any, ctx: any) {
	const { effectType, result, actor, target, item } = ctx;
	const outcome = result?.outcome;
	const icon = item?.icon ? `${item.icon} ` : '';
	const actorMention = actor ? `${actor}` : 'A member';
	const targetMention = target ? `${target}` : 'a member';
	const immuneRel = discordRelative(result?.immuneUntil);

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setFooter({ text: embedConfig.FOOTER || 'Items' })
		.setTimestamp();
	if (actor?.user) embed.setThumbnail(actor.user.displayAvatarURL({ dynamic: true }));

	const fields: any[] = [];

	if (effectType === 'xp_steal' || effectType === 'xp_bomb') {
		const verbPast = effectType === 'xp_steal' ? 'robbed' : 'bombed';
		const emoji = effectType === 'xp_steal' ? '💰' : '💥';

		if (outcome === 'blocked') {
			embed
				.setColor(0x38bdf8)
				.setTitle('🛡️ Attack Blocked')
				.setDescription(`${targetMention}'s **Shield** blocked ${actorMention}'s ${effectType === 'xp_steal' ? 'steal' : 'bomb'}!`);
			return embed;
		}
		if (outcome === 'reflected') {
			embed
				.setColor(0xc084fc)
				.setTitle('🪞 Attack Reflected')
				.setDescription(`${targetMention} reflected the attack back at ${actorMention}!`)
				.addFields({ name: 'XP lost by attacker', value: fmtXp(result?.xp), inline: true });
			return embed;
		}

		embed.setTitle(`${emoji} Member ${verbPast.charAt(0).toUpperCase() + verbPast.slice(1)}!`);
		embed.setDescription(
			effectType === 'xp_steal'
				? `${actorMention} robbed ${targetMention}${item?.name ? ` with **${icon}${item.name}**` : ''}!`
				: `${actorMention} bombed ${targetMention}${item?.name ? ` with **${icon}${item.name}**` : ''}!`
		);
		fields.push({ name: 'Attacker', value: actorMention, inline: true });
		fields.push({ name: 'Victim', value: targetMention, inline: true });
		fields.push({
			name: effectType === 'xp_steal' ? 'XP stolen' : 'XP destroyed',
			value: `${fmtXp(result?.xp)}${result?.percent ? ` (${result.percent}%)` : ''}`,
			inline: true
		});
		if (result?.refunded) fields.push({ name: '💵 Insurance refund', value: `${targetMention} was refunded ${fmtXp(result.refunded)}`, inline: false });
		if (result?.bountyCollected)
			fields.push({ name: '🎯 Bounty collected', value: `${actorMention} also claimed ${fmtXp(result.bountyCollected)}`, inline: false });
		if (immuneRel) fields.push({ name: '🛡️ Immunity', value: `${targetMention} is immune until ${immuneRel}`, inline: false });
		embed.addFields(fields);
		return embed;
	}

	if (effectType === 'leech') {
		embed
			.setColor(0xfb7185)
			.setTitle('🩸 Leech Attached')
			.setDescription(`${actorMention} attached a leech to ${targetMention} — siphoning a cut of their XP while active.`);
		return embed;
	}

	if (effectType === 'gift') {
		embed
			.setColor(0x4ade80)
			.setTitle('🎁 Gift Sent')
			.setDescription(`${actorMention} sent a gift to ${targetMention}!`)
			.addFields({ name: 'Received', value: fmtXp(result?.xp), inline: true });
		return embed;
	}

	if (effectType === 'bounty') {
		embed
			.setColor(0xfbbf24)
			.setTitle('🎯 Bounty Placed')
			.setDescription(`${actorMention} placed a bounty on ${targetMention} — whoever robs them next collects it.`)
			.addFields({ name: 'Bounty', value: fmtXp(result?.xp), inline: true });
		return embed;
	}

	if (effectType === 'gamble') {
		if (result?.won) {
			embed
				.setColor(0x4ade80)
				.setTitle('🎲 Gamble — Win!')
				.setDescription(`${actorMention} gambled and **won**!`)
				.addFields({ name: 'Net gain', value: `+${fmtXp(result?.net)}`, inline: true });
		} else {
			embed
				.setColor(0xfb7185)
				.setTitle('🎲 Gamble — Lost')
				.setDescription(`${actorMention} gambled and **lost**.`)
				.addFields({ name: 'XP lost', value: fmtXp(result?.stake), inline: true });
		}
		return embed;
	}

	if (effectType === 'shield' || effectType === 'reflect' || effectType === 'insurance') {
		const meta: Record<string, { emoji: string; title: string; desc: string; color: number }> = {
			shield: { emoji: '🛡️', title: 'Shield Activated', desc: 'is now protected — incoming steals and bombs will be blocked', color: 0x38bdf8 },
			reflect: { emoji: '🪞', title: 'Reflect Activated', desc: 'will bounce the next attack back at the attacker', color: 0xc084fc },
			insurance: { emoji: '💵', title: 'Insurance Activated', desc: 'will be refunded the next time they are robbed', color: 0x5eead4 }
		};
		const m = meta[effectType];
		const untilRel = discordRelative(result?.expiresAt);
		embed
			.setColor(m.color)
			.setTitle(`${m.emoji} ${m.title}`)
			.setDescription(`${actorMention} ${m.desc}${untilRel ? ` (until ${untilRel})` : ''}.`);
		return embed;
	}

	if (effectType === 'xp_boost') {
		const untilRel = discordRelative(result?.expiresAt);
		embed
			.setColor(0xfbbf24)
			.setTitle('⚡ XP Boost Activated')
			.setDescription(`${actorMention} activated an XP boost${untilRel ? ` — active until ${untilRel}` : ''}. Earnings are multiplied while it lasts.`);
		return embed;
	}

	if (effectType === 'vault') {
		const dir = result?.direction === 'withdraw' ? 'withdrew' : 'deposited';
		embed
			.setColor(0x9aa7b2)
			.setTitle('🏦 Vault')
			.setDescription(
				`${actorMention} ${dir} ${fmtXp(result?.xp)}${result?.direction === 'withdraw' ? ' from their vault.' : ' into their vault (safe from theft).'}`
			);
		return embed;
	}

	return null;
}

const itemsUrlCache = new Map<string, { url: string | null; at: number }>();
async function buildItemsButtonRow(guildId: any, discordMemberId: any) {
	if (!discordMemberId) return null;
	const cacheKey = `${guildId}:${discordMemberId}`;
	const cached = itemsUrlCache.get(cacheKey);
	let url: string | null;
	if (cached && Date.now() - cached.at < 300_000) {
		url = cached.url;
	} else {
		url = await resolveMemberItemsUrl(guildId, discordMemberId);
		itemsUrlCache.set(cacheKey, { url, at: Date.now() });
	}
	if (!url) return null;

	const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
	return new ActionRowBuilder<any>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Open Items').setEmoji('🛒'));
}

async function resolveMemberItemsUrl(guildId: any, discordMemberId: any): Promise<string | null> {
	try {
		const { publicItemsUrl } = await import('../../../../url.js');
		const { computePublicServerSlugForServerId } = await import('../../../../frontend/public/server-slug/index.js');
		const { computeCardToken } = await import('../../../../frontend/public/items/index.js');
		const { getServerForCurrentBot } = await import('../../../config.js');

		const server = await getServerForCurrentBot(String(guildId));
		const member = await db.getMemberByDiscordId(server.id, String(discordMemberId)).catch(() => null);
		if (!member?.member_since) return null;
		const slug = await computePublicServerSlugForServerId(Number(server.id));
		if (!slug) return null;
		const token = computeCardToken(String(discordMemberId), member.member_since);
		return publicItemsUrl(slug, token);
	} catch (_) {
		return null;
	}
}

async function announceItemUse(client: any, ctx: any) {
	const { guildId, actorDiscordId, targetDiscordId, effectType, item, result } = ctx;
	if (!ANNOUNCED_EFFECTS.has(effectType)) return;
	if (!result || result.outcome === 'unsupported') return;

	const { getLevelingSettings, getEmbedConfig } = await import('../../../config.js');
	const settings = await getLevelingSettings(guildId).catch(() => null);
	const channelId = settings?.PROGRESS_CHANNEL_ID;
	if (!channelId) return;

	const guild = client?.guilds?.cache?.get(guildId);
	if (!guild) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return;

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Items' }));

	const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
	const target = targetDiscordId ? await guild.members.fetch(String(targetDiscordId)).catch(() => null) : null;

	const embed = buildItemUseEmbed(EmbedBuilder, embedConfig, { effectType, result, actor, target, item });
	if (!embed) return;

	const mentions = [actor, target].filter(Boolean).map((m: any) => `${m}`);
	const content = mentions.length > 0 ? mentions.join(' ') : undefined;

	const row = await buildItemsButtonRow(guildId, actorDiscordId);
	await channel.send({ content, embeds: [embed], components: row ? [row] : undefined }).catch(() => null);
}

const EXPIRY_SWEEP_MS = 60_000;
let expirySweepTimer: any = null;

const EXPIRING_BUFFS: Record<string, { emoji: string; label: string; color: number; selfDesc: (mag: number) => string }> = {
	xp_boost: { emoji: '⚡', label: 'XP Boost', color: 0xfbbf24, selfDesc: (m) => `Your **${m || 2}× XP Boost** has worn off.` },
	shield: { emoji: '🛡️', label: 'Shield', color: 0x38bdf8, selfDesc: () => `Your **Shield** has worn off — you can be attacked again.` },
	reflect: { emoji: '🪞', label: 'Reflect', color: 0xc084fc, selfDesc: () => `Your **Reflect** has worn off.` },
	insurance: { emoji: '💵', label: 'Insurance', color: 0x5eead4, selfDesc: () => `Your **Insurance** has expired.` },
	leech: { emoji: '🩸', label: 'Leech', color: 0xfb7185, selfDesc: (m) => `The **${m || 0}% Leech** on you has ended.` }
};

async function embedConfigFor(guildId: any) {
	const { getEmbedConfig } = await import('../../../config.js');
	return getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Items' }));
}

async function getProgressChannel(client: any, guild: any) {
	const { getLevelingSettings } = await import('../../../config.js');
	const settings = await getLevelingSettings(guild.id).catch(() => null);
	const channelId = settings?.PROGRESS_CHANNEL_ID;
	if (!channelId) return null;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	return channel && channel.isTextBased() ? channel : null;
}

async function deliverToMemberAndChannel(client: any, guild: any, member: any, embed: any, dmAllowed: boolean, channelContent?: string) {
	const row = member?.id ? await buildItemsButtonRow(guild.id, member.id) : null;
	const components = row ? [row] : undefined;
	if (member?.user && dmAllowed) await member.user.send({ embeds: [embed], components }).catch(() => null);
	const channel = await getProgressChannel(client, guild);
	if (channel) await channel.send({ content: channelContent, embeds: [embed], components }).catch(() => null);
}

function dmAllowedFromRow(row: any): boolean {
	const v = row?.dm_notifications_enabled;
	return v === undefined || v === null || v === 1 || v === true;
}

async function sweepExpiredBuffs(client: any, botId: any, EmbedBuilder: any) {
	const rows = await db.getNewlyExpiredEffects(botId).catch(() => []);
	if (!rows || rows.length === 0) return;

	const handledIds: number[] = [];
	for (const row of rows) {
		const meta = EXPIRING_BUFFS[row.effect_type];
		if (meta) {
			const guild = client?.guilds?.cache?.get(String(row.discord_server_id));
			const member = guild ? await guild.members.fetch(String(row.discord_member_id)).catch(() => null) : null;
			if (guild) {
				const embedConfig = await embedConfigFor(guild.id);
				const mag = Number(row.magnitude) || 0;
				const embed = new EmbedBuilder()
					.setColor(meta.color)
					.setTitle(`${meta.emoji} ${meta.label} Ended`)
					.setDescription(member ? `${member} — ${meta.selfDesc(mag)}` : meta.selfDesc(mag))
					.setFooter({ text: embedConfig.FOOTER || 'Items' })
					.setTimestamp();
				await deliverToMemberAndChannel(client, guild, member, embed, dmAllowedFromRow(row), member ? `${member}` : undefined);
			}
		}
		handledIds.push(Number(row.id));
	}
	if (handledIds.length > 0) await db.markEffectExpiryNotified(handledIds).catch(() => null);
}

async function sweepDerivedEvents(client: any, botId: any, EmbedBuilder: any) {
	const now = Date.now();

	const hits = await db.getRecentVictimHits(botId).catch(() => []);
	for (const hit of hits || []) {
		const lastHit = hit.last_hit instanceof Date ? hit.last_hit.getTime() : new Date(hit.last_hit).getTime();
		if (!Number.isFinite(lastHit)) continue;
		const immunityMs = await defaultImmunityMsForServer(hit.discord_server_id).catch(() => 0);
		if (immunityMs <= 0) continue;
		const endsAt = lastHit + immunityMs;
		if (endsAt > now || now - endsAt > EXPIRY_SWEEP_MS) continue;
		const fresh = await db.recordItemEventNotif(hit.member_id, 'immunity_ended', new Date(endsAt)).catch(() => false);
		if (!fresh) continue;

		const guild = client?.guilds?.cache?.get(String(hit.discord_server_id));
		if (!guild) continue;
		const member = await guild.members.fetch(String(hit.discord_member_id)).catch(() => null);
		const embedConfig = await embedConfigFor(guild.id);
		const embed = new EmbedBuilder()
			.setColor(0xfb7185)
			.setTitle('🛡️ Immunity Ended')
			.setDescription(member ? `${member} is no longer immune — fair game again!` : `A member is no longer immune.`)
			.setFooter({ text: embedConfig.FOOTER || 'Items' })
			.setTimestamp();
		await deliverToMemberAndChannel(client, guild, member, embed, dmAllowedFromRow(hit), member ? `${member}` : undefined);
	}

	const attacks = await db.getRecentAttackerActions(botId).catch(() => []);
	for (const atk of attacks || []) {
		const lastAtk = atk.last_attack instanceof Date ? atk.last_attack.getTime() : new Date(atk.last_attack).getTime();
		if (!Number.isFinite(lastAtk)) continue;
		const cooldownMs = await defaultCooldownMsForServer(atk.discord_server_id).catch(() => 0);
		if (cooldownMs <= 0) continue;
		const endsAt = lastAtk + cooldownMs;
		if (endsAt > now || now - endsAt > EXPIRY_SWEEP_MS) continue;
		const fresh = await db.recordItemEventNotif(atk.member_id, 'cooldown_ready', new Date(endsAt)).catch(() => false);
		if (!fresh) continue;

		const guild = client?.guilds?.cache?.get(String(atk.discord_server_id));
		if (!guild) continue;
		const member = await guild.members.fetch(String(atk.discord_member_id)).catch(() => null);
		const embedConfig = await embedConfigFor(guild.id);
		const embed = new EmbedBuilder()
			.setColor(0x4ade80)
			.setTitle('✅ Cooldown Ready')
			.setDescription(member ? `${member} — your attack cooldown is up. You can steal or bomb again!` : `Attack cooldown is up.`)
			.setFooter({ text: embedConfig.FOOTER || 'Items' })
			.setTimestamp();
		await deliverToMemberAndChannel(client, guild, member, embed, dmAllowedFromRow(atk), member ? `${member}` : undefined);
	}
}

async function defaultCooldownMsForServer(discordServerId: any): Promise<number> {
	return maxAttackConfigMs(discordServerId, 'cooldown_minutes');
}
async function defaultImmunityMsForServer(discordServerId: any): Promise<number> {
	return maxAttackConfigMs(discordServerId, 'immunity_minutes');
}

const attackCfgCache = new Map<string, { value: number; at: number }>();
async function maxAttackConfigMs(discordServerId: any, key: string): Promise<number> {
	const cacheKey = `${discordServerId}:${key}`;
	const cached = attackCfgCache.get(cacheKey);
	if (cached && Date.now() - cached.at < 60_000) return cached.value;

	const { getServerForCurrentBot } = await import('../../../config.js');
	let server: any;
	try {
		server = await getServerForCurrentBot(String(discordServerId));
	} catch (_) {
		return 0;
	}
	const items = await db.listBotItems(server.bot_id, {}).catch(() => []);
	let maxMin = 0;
	for (const it of (items as any[]) || []) {
		if (it.effect_type !== 'xp_steal' && it.effect_type !== 'xp_bomb') continue;
		const cfg = parseConfig(it.config);
		const v = Math.max(0, Number(cfg[key]) || 0);
		if (v > maxMin) maxMin = v;
	}
	const ms = maxMin * 60000;
	attackCfgCache.set(cacheKey, { value: ms, at: Date.now() });
	return ms;
}

async function runExpirySweep(client: any) {
	try {
		const { getBotConfig } = await import('../../../config.js');
		const botConfig = getBotConfig();
		if (!botConfig?.id) return;
		const { EmbedBuilder } = await import('discord.js');
		await sweepExpiredBuffs(client, botConfig.id, EmbedBuilder);
		await sweepDerivedEvents(client, botConfig.id, EmbedBuilder);
	} catch (err: any) {
		await logger.log(`⚠️ Item expiry sweep failed: ${err.message}`);
	}
}

export function initExpirySweeper(client: any) {
	if (expirySweepTimer) clearInterval(expirySweepTimer);
	expirySweepTimer = setInterval(() => {
		runExpirySweep(client).catch(() => null);
	}, EXPIRY_SWEEP_MS);
}

export function stopExpirySweeper() {
	if (expirySweepTimer) clearInterval(expirySweepTimer);
	expirySweepTimer = null;
}

export { invalidateEffectCache };
