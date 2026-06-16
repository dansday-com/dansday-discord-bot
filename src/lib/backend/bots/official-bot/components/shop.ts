import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { getLevelRequirement, determineLevel } from './leveling.js';

const EFFECT_CACHE_TTL_MS = 5000;
const memoryEffectCache = new Map();

function effectCacheKey(memberId: any) {
	return `shop:effects:${memberId}`;
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
	if (safeBase <= 0) return { memberXp: 0, leechCredits: [] as any[] };

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

	return { memberXp, leechCredits };
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

async function isUnderAttackCooldown(actorMemberId: any, cooldownMinutes: any) {
	const minutes = Math.max(0, Number(cooldownMinutes) || 0);
	if (minutes <= 0) return false;
	const last = await db.getLastActionByActor(actorMemberId, 'attack');
	if (!last) return false;
	const elapsedMs = Date.now() - last.getTime();
	return elapsedMs < minutes * 60000;
}

async function isTargetImmune(targetMemberId: any, immunityMinutes: any) {
	const minutes = Math.max(0, Number(immunityMinutes) || 0);
	if (minutes <= 0) return false;
	const last = await db.getLastActionAgainstTarget(targetMemberId, ['steal', 'bomb']);
	if (!last) return false;
	const elapsedMs = Date.now() - last.getTime();
	return elapsedMs < minutes * 60000;
}

export async function resolveSteal({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	if (await isUnderAttackCooldown(actorMemberId, cfg.cooldown_minutes)) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'steal', xp_amount: 0, outcome: 'blocked' });
		return { outcome: 'blocked', xp: 0 };
	}
	if (await isTargetImmune(targetMemberId, cfg.immunity_minutes)) {
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
	return { outcome: 'success', xp: amount, percent: pct, refunded, bountyCollected };
}

export async function resolveBomb({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	if (await isUnderAttackCooldown(actorMemberId, cfg.cooldown_minutes)) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberItemId, { target_member_id: targetMemberId, action: 'bomb', xp_amount: 0, outcome: 'blocked' });
		return { outcome: 'blocked', xp: 0 };
	}
	if (await isTargetImmune(targetMemberId, cfg.immunity_minutes)) {
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
	return { outcome: 'success', xp: amount, percent: pct, refunded };
}

function computeExpiry(durationMinutes: any) {
	const minutes = Math.max(1, Number(durationMinutes) || 60);
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

export async function resolveVault({ actorMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const direction = cfg.vault_direction === 'withdraw' ? 'withdraw' : 'deposit';
	const amount = Math.max(0, Math.floor(Number(cfg.vault_amount) || 0));
	if (amount <= 0) return { outcome: 'success', xp: 0 };

	if (direction === 'deposit') {
		const stats = await db.getMemberLevel(actorMemberId);
		const total = Number(stats?.experience ?? 0) || 0;
		const moved = Math.min(total, amount);
		if (moved <= 0) return { outcome: 'success', xp: 0 };
		await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: -moved });
		await db.addVaultXp(actorMemberId, moved);
		const after = await db.getMemberLevel(actorMemberId);
		await reevaluateLevel(actorMemberId, after, guildId);
		return { outcome: 'success', xp: moved, direction };
	}

	const vaulted = await db.getVaultXp(actorMemberId);
	const moved = Math.min(vaulted, amount);
	if (moved <= 0) return { outcome: 'success', xp: 0 };
	await db.addVaultXp(actorMemberId, -moved);
	await db.ensureMemberLevel(actorMemberId);
	const stats = await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: moved });
	await reevaluateLevel(actorMemberId, stats, guildId);
	return { outcome: 'success', xp: moved, direction };
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

export async function handleShopItemUse(client: any, payload: any) {
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

	if (!(await isComponentFeatureEnabled(guild_id, serverSettingsComponent.shop))) {
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
		} else if (effectType === 'vault') {
			result = await resolveVault({ actorMemberId, config, guildId: guild_id });
		} else if (effectType === 'bounty') {
			result = await resolveBounty({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'cosmetic') {
			result = await resolveCosmetic({ actorMemberId, itemId: memberItem.item_id, config });
		} else {
			result = { outcome: 'unsupported' };
		}
	} catch (err: any) {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		await logger.log(`❌ Shop item use failed (${effectType}): ${err.message}`);
		return { ok: false, error: 'resolution_failed' };
	}

	if (result?.outcome === 'cooldown' || result?.outcome === 'immune' || result?.outcome === 'insufficient') {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		return { ok: false, error: result.outcome, outcome: result.outcome };
	}

	await notifyTargetIfNeeded(client, guild_id, server, targetMemberId, effectType, result).catch(() => null);

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
				const [h, m] = String(hhmm).split(':').map((n) => Number(n) || 0);
				return h * 60 + m;
			};
			const start = toMin(schedule.from);
			const end = toMin(schedule.to);
			if (minutes < start || minutes > end) return false;
		}
	}
	return true;
}

export async function handleShopItemBuy(client: any, payload: any) {
	const { guild_id, actor_discord_id, item_id, quantity } = payload || {};
	if (!guild_id || !actor_discord_id || !item_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isComponentFeatureEnabled, serverSettingsComponent } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isComponentFeatureEnabled(guild_id, serverSettingsComponent.shop))) {
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

async function notifyTargetIfNeeded(client: any, guildId: any, server: any, targetMemberId: any, effectType: any, result: any) {
	if (!TARGETED_EFFECTS.has(effectType) || !targetMemberId) return;
	const okOutcomes = new Set(['success', 'blocked', 'reflected']);
	if (!result || !okOutcomes.has(result.outcome)) return;

	const { getLevelingSettings } = await import('../../../config.js');
	const settings = await getLevelingSettings(guildId).catch(() => null);
	const channelId = settings?.PROGRESS_CHANNEL_ID;
	if (!channelId) return;

	const guild = client?.guilds?.cache?.get(guildId);
	if (!guild) return;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return;

	const amount = result.xp ? ` ${result.xp} XP` : '';
	let line: string;
	if (effectType === 'gift') {
		line = `🎁 A member just received a gift of${amount || ' XP'}!`;
	} else if (result.outcome === 'blocked') {
		line = `🛡️ A shop attack was blocked by an active shield.`;
	} else if (result.outcome === 'reflected') {
		line = `🪞 A shop attack was reflected back at the attacker!${amount}`;
	} else {
		const verb = effectType === 'xp_steal' ? 'robbed' : effectType === 'xp_bomb' ? 'bombed' : 'leeched';
		line = `💥 A member just got ${verb}!${amount}`;
	}
	await channel.send(line).catch(() => null);
}

export { invalidateEffectCache };
