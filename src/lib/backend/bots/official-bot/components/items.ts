import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { getLevelRequirement, determineLevel, evaluateMemberLevelAndRank } from './leveling.js';
import { TARGETED_EFFECTS, ANNOUNCED_EFFECTS, getItemEffect, BAG_CAPACITY, effectAccentInt } from '../../../../items.js';

const EFFECT_CACHE_TTL_MS = 5000;
const GAMBLE_ANNOUNCE_DELAY_MS = 3900;
const memoryEffectCache = new Map();
const SELF_BUFFS = new Set(['boost', 'shield', 'reflect', 'insurance']);

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
		if (effect.effect_type === 'boost' && effectScopeMatches(effect, source)) {
			const m = Number(effect.effect_value) || 0;
			if (m > 0) multiplier *= m;
		} else if (effect.effect_type === 'leech') {
			const pct = Number(effect.effect_value) || 0;
			const targetsThisMember = Number(effect.target_member_id) === Number(memberId);
			if (pct > 0 && targetsThisMember && effect.beneficiary_member_id != null) {
				skimPercent += pct;
				leeches.push({ beneficiaryMemberId: Number(effect.beneficiary_member_id), percent: pct });
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
			leechCredits.push({ beneficiaryMemberId: leech.beneficiaryMemberId, amount, percent: leech.percent });
			remaining -= amount;
		}
	}

	return { memberXp, leechCredits, multiplier, boosted: multiplier > 1, skimPercent, leeched: totalSkim > 0 };
}

export async function creditLeechers(leechCredits: any, guildId: any) {
	const applied: any[] = [];
	if (!Array.isArray(leechCredits) || leechCredits.length === 0) return applied;
	for (const credit of leechCredits) {
		try {
			await db.ensureMemberLevel(credit.beneficiaryMemberId);
			const before = await db.getMemberLevel(credit.beneficiaryMemberId);
			const after = await db.updateMemberLevelStats(credit.beneficiaryMemberId, { experienceIncrement: credit.amount });
			const stats = (await reevaluateLevel(credit.beneficiaryMemberId, after ?? before, guildId)) ?? after ?? before;
			await db
				.logMemberLevelGain(credit.beneficiaryMemberId, {
					source: 'leech',
					amount: credit.amount,
					total_xp: stats?.experience != null ? Number(stats.experience) : null,
					level: stats?.level != null ? Number(stats.level) : null,
					rank: stats?.rank != null ? Number(stats.rank) : null,
					skim_percent: credit.percent ?? null
				})
				.catch(() => null);
			await evaluateMemberLevelAndRank(guildId, credit.beneficiaryMemberId, {
				previousLevel: before?.level != null ? Number(before.level) : null,
				previousRank: before?.rank != null ? Number(before.rank) : null,
				previousExperience: before?.experience != null ? Number(before.experience) : null,
				reason: 'item-leech-credit'
			}).catch(() => null);
			const beneficiary = await db.getServerMemberById(credit.beneficiaryMemberId).catch(() => null);
			applied.push({ ...credit, beneficiary });
		} catch (error: any) {
			await logger.log(`⚠️ Leech credit failed for member ${credit.beneficiaryMemberId}: ${error.message}`);
		}
	}
	return applied;
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

async function snapshotMembers(memberIds: any[]) {
	const ids = [...new Set(memberIds.filter((id) => id != null).map((id) => Number(id)))];
	const snapshots = new Map<number, { level: any; rank: any; experience: any }>();
	for (const id of ids) {
		const stats = await db.getMemberLevel(id).catch(() => null);
		snapshots.set(id, {
			level: stats?.level ?? null,
			rank: stats?.rank ?? null,
			experience: stats?.experience ?? null
		});
	}
	return snapshots;
}

async function finalizeXpChanges(guildId: any, snapshots: Map<number, { level: any; rank: any; experience: any }>, reason: string) {
	for (const [memberId, before] of snapshots) {
		await evaluateMemberLevelAndRank(guildId, memberId, {
			previousLevel: before.level != null ? Number(before.level) : null,
			previousRank: before.rank != null ? Number(before.rank) : null,
			previousExperience: before.experience != null ? Number(before.experience) : null,
			reason
		}).catch(() => null);
	}
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

async function attackCooldownUntil(actorMemberId: any, cooldownMinutes: any, action: 'steal' | 'bomb'): Promise<Date | null> {
	const minutes = Math.max(0, Number(cooldownMinutes) || 0);
	if (minutes <= 0) return null;
	const last = await db.getLastAttackActionByActor(actorMemberId, [action]);
	if (!last) return null;
	const until = new Date(last.getTime() + minutes * 60000);
	return until.getTime() > Date.now() ? until : null;
}

async function activationCooldownUntil(actorMemberId: any, cooldownMinutes: any, action: string): Promise<Date | null> {
	const minutes = Math.max(0, Number(cooldownMinutes) || 0);
	if (minutes <= 0) return null;
	const last = await db.getLastActionByActor(actorMemberId, action).catch(() => null);
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
	if (await attackCooldownUntil(actorMemberId, cfg.cooldown_minutes, 'steal')) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'steal',
			xp_amount: 0,
			outcome: 'blocked'
		});
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
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'steal',
			xp_amount: amount,
			outcome: 'reflected'
		});
		return { outcome: 'reflected', xp: amount };
	}

	if (amount <= 0) {
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'steal',
			xp_amount: 0,
			outcome: 'success'
		});
		return { outcome: 'success', xp: 0 };
	}

	const spent = await spendXp(targetMemberId, amount, guildId);
	if (!spent.ok) return { outcome: 'immune', xp: 0 };

	await db.ensureMemberLevel(actorMemberId);
	const actorStats = await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: amount });
	await reevaluateLevel(actorMemberId, actorStats, guildId);

	let refunded = 0;
	const insuranceSteal = await consumeReactiveDefense(targetMemberId, 'insurance');
	if (insuranceSteal) {
		refunded = insuranceRefundAmount(amount, insuranceSteal.effect_value);
		if (refunded > 0) {
			const refundStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: refunded });
			await reevaluateLevel(targetMemberId, refundStats, guildId);
		}
		await db.logMemberItemAction(targetMemberId, {
			target_member_id: actorMemberId,
			action: 'insurance',
			xp_amount: refunded,
			outcome: 'refunded'
		});
	}

	const bountyCollected = await payoutBountyOnHit(targetMemberId, actorMemberId, guildId);

	await db.logMemberItemAction(actorMemberId, {
		member_item_id: actorMemberItemId,
		target_member_id: targetMemberId,
		action: 'steal',
		xp_amount: amount,
		outcome: 'success'
	});
	await invalidateEffectCache(targetMemberId);
	const grantedImmunityUntil = newImmunityUntil(cfg.immunity_minutes);
	return { outcome: 'success', xp: amount, percent: pct, refunded, bountyCollected, immuneUntil: grantedImmunityUntil };
}

export async function resolveBomb({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	if (await attackCooldownUntil(actorMemberId, cfg.cooldown_minutes, 'bomb')) {
		return { outcome: 'cooldown', xp: 0 };
	}
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'bomb',
			xp_amount: 0,
			outcome: 'blocked'
		});
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
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'bomb',
			xp_amount: amount,
			outcome: 'reflected'
		});
		return { outcome: 'reflected', xp: amount };
	}

	if (amount > 0) {
		await spendXp(targetMemberId, amount, guildId);
	}

	let refunded = 0;
	if (amount > 0) {
		const insuranceBomb = await consumeReactiveDefense(targetMemberId, 'insurance');
		if (insuranceBomb) {
			refunded = insuranceRefundAmount(amount, insuranceBomb.effect_value);
			if (refunded > 0) {
				const refundStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: refunded });
				await reevaluateLevel(targetMemberId, refundStats, guildId);
			}
			await db.logMemberItemAction(targetMemberId, {
				target_member_id: actorMemberId,
				action: 'insurance',
				xp_amount: refunded,
				outcome: 'refunded'
			});
		}
	}

	const bountyCollected = await payoutBountyOnHit(targetMemberId, actorMemberId, guildId);

	await db.logMemberItemAction(actorMemberId, {
		member_item_id: actorMemberItemId,
		target_member_id: targetMemberId,
		action: 'bomb',
		xp_amount: amount,
		outcome: 'success'
	});
	await invalidateEffectCache(targetMemberId);
	const grantedImmunityUntil = newImmunityUntil(cfg.immunity_minutes);
	return { outcome: 'success', xp: amount, percent: pct, refunded, bountyCollected, immuneUntil: grantedImmunityUntil };
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

export async function resolveBoost({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { effect_value: Number(cfg.multiplier ?? 2), expires_at: expiresAt });
	await db.logMemberItemAction(ownerMemberId, { member_item_id: memberItemId, action: 'boost', xp_amount: 0, outcome: 'success' });
	return { outcome: 'success', expiresAt };
}

export async function resolveShield({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { effect_value: 1, expires_at: expiresAt });
	await db.logMemberItemAction(ownerMemberId, { member_item_id: memberItemId, action: 'shield', xp_amount: 0, outcome: 'success' });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt };
}

async function activeLeechOnTarget(targetMemberId: any) {
	const effects = await getCachedActiveEffects(targetMemberId);
	return effects.find((e: any) => e.effect_type === 'leech' && Number(e.target_member_id) === Number(targetMemberId)) ?? null;
}

export async function resolveLeech({ memberItemId, actorMemberId, targetMemberId, config }: any) {
	const cfg = parseConfig(config);
	if (await hasActiveShield(targetMemberId)) {
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: memberItemId,
			target_member_id: targetMemberId,
			action: 'leech',
			xp_amount: 0,
			outcome: 'blocked'
		});
		return { outcome: 'blocked' };
	}
	if (await targetImmuneUntil(targetMemberId, cfg.immunity_minutes)) {
		return { outcome: 'immune' };
	}
	const mine = await db.getActiveLeechByBeneficiary(actorMemberId).catch(() => null);
	if (mine) {
		const who = mine.target_server_display_name || mine.target_display_name || mine.target_username || 'someone';
		return { outcome: 'leeched', error: `Your leech on ${who} is still active — you can only run one at a time.` };
	}
	const existing = await activeLeechOnTarget(targetMemberId);
	if (existing) {
		const beneficiary = await db.getServerMemberById(existing.beneficiary_member_id).catch(() => null);
		const who = beneficiary?.server_display_name || beneficiary?.display_name || beneficiary?.username || 'another member';
		return { outcome: 'leeched', error: `This member is already being leeched by ${who}.` };
	}
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, {
		effect_value: Number(cfg.skim_percent ?? 10),
		beneficiary_member_id: actorMemberId,
		target_member_id: targetMemberId,
		expires_at: expiresAt
	});
	await db.logMemberItemAction(actorMemberId, {
		member_item_id: memberItemId,
		target_member_id: targetMemberId,
		action: 'leech',
		xp_amount: 0,
		outcome: 'success'
	});
	await invalidateEffectCache(targetMemberId);
	return { outcome: 'success', expiresAt };
}

export async function resolveReflect({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { effect_value: 1, expires_at: expiresAt });
	await db.logMemberItemAction(ownerMemberId, { member_item_id: memberItemId, action: 'reflect', xp_amount: 0, outcome: 'success' });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt };
}

function insuranceRefundAmount(lostAmount: any, refundPercent: any) {
	const lost = Math.max(0, Math.floor(Number(lostAmount) || 0));
	const pct = Math.max(0, Math.min(100, Number(refundPercent) || 0));
	return Math.floor((lost * pct) / 100);
}

export async function resolveInsurance({ memberItemId, ownerMemberId, config }: any) {
	const cfg = parseConfig(config);
	const cooldownUntil = await activationCooldownUntil(ownerMemberId, cfg.cooldown_minutes, 'insurance');
	if (cooldownUntil) return { outcome: 'cooldown', error: `Insurance is on cooldown — try again in ${humanizeUntil(cooldownUntil)}.` };
	const refundPercent = Math.max(0, Math.min(100, Number(cfg.refund_percent ?? 100)));
	const expiresAt = computeExpiry(cfg.effect_duration_minutes);
	await db.addMemberItemActive(memberItemId, { effect_value: refundPercent, expires_at: expiresAt });
	await db.logMemberItemAction(ownerMemberId, { member_item_id: memberItemId, action: 'insurance', xp_amount: 0, outcome: 'success' });
	await invalidateEffectCache(ownerMemberId);
	return { outcome: 'success', expiresAt, refundPercent };
}

export async function resolveGift({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const amount = Math.max(0, Math.floor(Number(cfg.gift_amount) || 0));
	if (amount <= 0) {
		await db.logMemberItemAction(actorMemberId, {
			member_item_id: actorMemberItemId,
			target_member_id: targetMemberId,
			action: 'gift',
			xp_amount: 0,
			outcome: 'success'
		});
		return { outcome: 'success', xp: 0 };
	}
	const taxPercent = Math.max(0, Math.min(100, Number(cfg.tax_percent) || 0));
	const received = Math.max(0, amount - Math.floor((amount * taxPercent) / 100));

	await db.ensureMemberLevel(targetMemberId);
	const targetStats = await db.updateMemberLevelStats(targetMemberId, { experienceIncrement: received });
	await reevaluateLevel(targetMemberId, targetStats, guildId);

	await db.logMemberItemAction(actorMemberId, {
		member_item_id: actorMemberItemId,
		target_member_id: targetMemberId,
		action: 'gift',
		xp_amount: received,
		outcome: 'success'
	});
	return { outcome: 'success', xp: received };
}

export async function handleGamble(client: any, payload: any) {
	const { guild_id, actor_discord_id, item_id, percent, amount, tz_offset } = payload || {};
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

	const item = await db.getItem(item_id).catch(() => null);
	if (!item || item.enabled !== true || item.effect_type !== 'gamble') return { ok: false, error: 'item_unavailable' };
	if (!isItemAvailableNow(item, tz_offset)) return { ok: false, error: 'item_not_in_window' };

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const stats = await db.getMemberLevel(actorMemberId);
	const rawXp = stats?.experience ?? 0;
	const total = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
	const customAmount = Math.max(0, Math.floor(Number(amount) || 0));
	let wager: number;
	if (customAmount > 0) {
		wager = Math.min(customAmount, total);
	} else {
		const pct = Math.max(1, Math.min(100, Math.floor(Number(percent) || 0)));
		wager = Math.floor((total * pct) / 100);
	}
	if (wager <= 0) return { ok: false, error: 'insufficient_xp' };

	const cfg = parseConfig(item.config);
	const winChance = Math.max(0, Math.min(100, Number(cfg.win_chance) || 0));
	const payoutMultiplier = Math.max(0, Number(cfg.payout_multiplier) || 0);

	const gambleSnapshots = await snapshotMembers([actorMemberId]);
	const spend = await spendXp(actorMemberId, wager, guild_id);
	if (!spend.ok) return { ok: false, error: 'insufficient_xp' };

	const roll = Math.floor(Math.random() * 100) + 1;
	const won = roll <= winChance;

	let netChange = -wager;
	let payout = 0;
	if (won) {
		payout = Math.floor(wager * payoutMultiplier);
		await db.ensureMemberLevel(actorMemberId);
		const after = await db.updateMemberLevelStats(actorMemberId, { experienceIncrement: payout });
		await reevaluateLevel(actorMemberId, after, guild_id);
		netChange = payout - wager;
	}
	await invalidateEffectCache(actorMemberId);

	await db.logMemberItemAction(actorMemberId, {
		item_id,
		action: 'gamble',
		xp_amount: netChange,
		outcome: won ? 'win' : 'lose'
	});

	await finalizeXpChanges(guild_id, gambleSnapshots, 'item-gamble');

	const result = { outcome: won ? 'win' : 'lose', won, wager, payout, net: netChange };
	setTimeout(() => {
		announceItemUse(client, {
			guildId: guild_id,
			actorDiscordId: actor_discord_id,
			targetDiscordId: null,
			effectType: 'gamble',
			item,
			result
		}).catch(() => null);
	}, GAMBLE_ANNOUNCE_DELAY_MS);

	return { ok: true, outcome: result.outcome, effect_type: 'gamble', result };
}

export async function resolveBounty({ actorMemberId, actorMemberItemId, targetMemberId, config, guildId }: any) {
	const cfg = parseConfig(config);
	const amount = Math.max(0, Math.floor(Number(cfg.bounty_amount) || 0));
	if (amount <= 0) return { outcome: 'success', xp: 0 };

	await db.placeBounty(targetMemberId, actorMemberId, amount);
	await db.logMemberItemAction(actorMemberId, {
		member_item_id: actorMemberItemId,
		target_member_id: targetMemberId,
		action: 'bounty',
		xp_amount: amount,
		outcome: 'success'
	});
	return { outcome: 'success', xp: amount };
}

async function payoutBountyOnHit(targetMemberId: any, attackerMemberId: any, guildId: any) {
	const total = await db.collectBounties(targetMemberId).catch(() => 0);
	if (!total || total <= 0) return 0;
	await db.ensureMemberLevel(attackerMemberId);
	const stats = await db.updateMemberLevelStats(attackerMemberId, { experienceIncrement: total });
	await reevaluateLevel(attackerMemberId, stats, guildId);
	await db
		.logMemberItemAction(attackerMemberId, {
			target_member_id: targetMemberId,
			action: 'bounty_collected',
			xp_amount: total,
			outcome: 'success'
		})
		.catch(() => null);
	return total;
}

async function consumeReactiveDefense(memberId: any, kind: string) {
	const effects = await getCachedActiveEffects(memberId);
	const match = effects.find((e: any) => e.effect_type === kind);
	if (!match) return null;
	await db.expireMemberItemActive(match.id).catch(() => null);
	await invalidateEffectCache(memberId);
	return match;
}

async function resolveServerMemberId(serverId: any, discordMemberId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordMemberId)).catch(() => null);
	return member?.id ?? null;
}

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

	const item = await db.getItem(memberItem.item_id).catch(() => null);
	if (!item) return { ok: false, error: 'catalog_item_missing' };
	if (item.usable === false) return { ok: false, error: 'This item has been disabled and can no longer be used.', outcome: 'disabled' };

	const config = parseConfig(item.config);
	const effectType = item.effect_type;

	let targetMemberId: any = null;
	if (TARGETED_EFFECTS.has(effectType)) {
		if (!target_discord_id) return { ok: false, error: 'target_required' };
		targetMemberId = await resolveServerMemberId(server.id, target_discord_id);
		if (!targetMemberId) return { ok: false, error: 'target_not_found' };
		if (Number(targetMemberId) === Number(actorMemberId)) return { ok: false, error: 'cannot_target_self' };
	}

	if (SELF_BUFFS.has(effectType)) {
		const active = await getCachedActiveEffects(actorMemberId);
		if (active.some((e: any) => e.effect_type === effectType)) {
			return { ok: false, error: 'already_active', outcome: 'already_active' };
		}
	}

	const consumed = await db.consumeMemberItem(member_item_id, 1);
	if (!consumed) return { ok: false, error: 'out_of_stock' };

	const useSnapshots = await snapshotMembers([actorMemberId, targetMemberId]);

	let result: any;
	try {
		if (effectType === 'steal') {
			result = await resolveSteal({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'bomb') {
			result = await resolveBomb({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else if (effectType === 'boost') {
			result = await resolveBoost({ memberItemId: member_item_id, ownerMemberId: actorMemberId, config });
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
		} else if (effectType === 'bounty') {
			result = await resolveBounty({ actorMemberId, actorMemberItemId: member_item_id, targetMemberId, config, guildId: guild_id });
		} else {
			result = { outcome: 'unsupported' };
		}
	} catch (err: any) {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		await logger.log(`❌ Item use failed (${effectType}): ${err.message}`);
		return { ok: false, error: 'resolution_failed' };
	}

	if (result?.outcome === 'cooldown' || result?.outcome === 'immune' || result?.outcome === 'insufficient' || result?.outcome === 'leeched') {
		await db.grantMemberItem(memberItem.member_id, memberItem.item_id, 1);
		return { ok: false, error: result.error || result.outcome, outcome: result.outcome };
	}

	await finalizeXpChanges(guild_id, useSnapshots, `item-${effectType}`);

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

export async function handleItemDiscard(client: any, payload: any) {
	const { guild_id, actor_discord_id, member_item_id, quantity } = payload || {};
	if (!guild_id || !actor_discord_id || !member_item_id) return { ok: false, error: 'missing_fields' };

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

	const owned = Math.max(0, Number(memberItem.quantity) || 0);
	if (owned <= 0) return { ok: false, error: 'out_of_stock' };

	const requested = Number(quantity);
	const qty = Number.isFinite(requested) && requested > 0 ? Math.min(owned, Math.floor(requested)) : owned;

	const removed = await db.consumeMemberItem(member_item_id, qty);
	if (!removed) return { ok: false, error: 'out_of_stock' };

	await db.logMemberItemAction(actorMemberId, {
		member_item_id,
		item_id: memberItem.item_id,
		action: 'discard',
		xp_amount: 0,
		outcome: 'success'
	});

	return { ok: true, outcome: 'success', removed: qty };
}

function isItemAvailableNow(item: any, tzOffsetMin = 0) {
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
		const offset = Number.isFinite(Number(tzOffsetMin)) ? Number(tzOffsetMin) : 0;
		const local = new Date(nowMs + offset * 60000);
		const day = local.getUTCDay();
		if (!schedule.days.map(Number).includes(day)) return false;
		const toMin = (hhmm: any, fallback: number) => {
			if (hhmm == null || hhmm === '') return fallback;
			const [h, m] = String(hhmm)
				.split(':')
				.map((n) => Number(n) || 0);
			return h * 60 + m;
		};
		const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
		const start = toMin(schedule.from, 0);
		const end = toMin(schedule.to, 1439);
		if (minutes < start || minutes > end) return false;
	}
	return true;
}

export async function handleItemBuy(client: any, payload: any) {
	const { guild_id, actor_discord_id, item_id, quantity, tz_offset } = payload || {};
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

	const item = await db.getItem(item_id).catch(() => null);
	if (!item || item.enabled !== true) return { ok: false, error: 'item_unavailable' };
	if (!isItemAvailableNow(item, tz_offset)) return { ok: false, error: 'item_not_in_window' };

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
	const totalCost = (Number(item.cost) || 0) * qty;

	const inventory = await db.getMemberInventory(actorMemberId).catch(() => []);
	const bagStock = (inventory as any[]).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
	if (bagStock + qty > BAG_CAPACITY) {
		return { ok: false, error: 'bag_full', capacity: BAG_CAPACITY, bagStock };
	}

	const snapshots = await snapshotMembers([actorMemberId]);
	const spend = await spendXp(actorMemberId, totalCost, guild_id);
	if (!spend.ok) return { ok: false, error: spend.reason || 'insufficient_xp' };

	await db.ensureMemberLevel(actorMemberId);
	const owned = await db.grantMemberItem(actorMemberId, item_id, qty);
	await db.logMemberItemAction(actorMemberId, {
		member_item_id: owned?.id ?? null,
		item_id,
		action: 'buy',
		xp_amount: totalCost,
		outcome: 'success'
	});
	await finalizeXpChanges(guild_id, snapshots, 'item-buy');
	return { ok: true, member_item_id: owned?.id, quantity: owned?.quantity, cost: totalCost };
}

function discordRelative(date: any): string | null {
	if (!date) return null;
	const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
	if (!Number.isFinite(ms)) return null;
	return `<t:${Math.floor(ms / 1000)}:R>`;
}

function humanizeUntil(date: any): string {
	const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
	const secs = Math.max(0, Math.round((ms - Date.now()) / 1000));
	const d = Math.floor(secs / 86400);
	const h = Math.floor((secs % 86400) / 3600);
	const m = Math.floor((secs % 3600) / 60);
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m`;
	return `${secs}s`;
}

function fmtXp(n: any): string {
	return `${(Number(n) || 0).toLocaleString()} XP`;
}

function buildItemUseEmbed(EmbedBuilder: any, embedConfig: any, ctx: any) {
	const { effectType, result, actor, target, item } = ctx;
	const outcome = result?.outcome;
	const actorMention = actor ? `${actor}` : 'A member';
	const targetMention = target ? `${target}` : 'a member';
	const immuneRel = discordRelative(result?.immuneUntil);

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt(effectType))
		.setFooter({ text: embedConfig.FOOTER || 'Items' })
		.setTimestamp();

	const fields: any[] = [];

	if (effectType === 'steal' || effectType === 'bomb') {
		const verbPast = effectType === 'steal' ? 'robbed' : 'bombed';
		const emoji = effectType === 'steal' ? '💰' : '💥';

		if (outcome === 'blocked') {
			embed
				.setColor(effectAccentInt('shield'))
				.setTitle('🛡️ Attack Blocked')
				.setDescription(`${targetMention}'s **Shield** blocked ${actorMention}'s ${effectType === 'steal' ? 'steal' : 'bomb'}!`);
			return embed;
		}
		if (outcome === 'reflected') {
			embed
				.setColor(effectAccentInt('reflect'))
				.setTitle('🪞 Attack Reflected')
				.setDescription(`${targetMention} reflected the attack back at ${actorMention}!`)
				.addFields({ name: 'XP lost by attacker', value: fmtXp(result?.xp), inline: true });
			return embed;
		}

		embed.setTitle(`${emoji} Member ${verbPast.charAt(0).toUpperCase() + verbPast.slice(1)}!`);
		embed.setDescription(
			effectType === 'steal'
				? `${actorMention} robbed ${targetMention}${item?.name ? ` with **${item.name}**` : ''}!`
				: `${actorMention} bombed ${targetMention}${item?.name ? ` with **${item.name}**` : ''}!`
		);
		fields.push({ name: 'Attacker', value: actorMention, inline: true });
		fields.push({ name: 'Victim', value: targetMention, inline: true });
		fields.push({
			name: effectType === 'steal' ? 'XP stolen' : 'XP destroyed',
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
		if (outcome === 'blocked') {
			embed.setColor(effectAccentInt('shield')).setTitle('🛡️ Leech Blocked').setDescription(`${targetMention}'s **Shield** blocked ${actorMention}'s leech!`);
			return embed;
		}
		embed.setTitle('🩸 Leech Attached').setDescription(`${actorMention} attached a leech to ${targetMention} — siphoning a cut of their XP while active.`);
		return embed;
	}

	if (effectType === 'gift') {
		embed
			.setTitle('🎁 Gift Sent')
			.setDescription(`${actorMention} sent a gift to ${targetMention}!`)
			.addFields({ name: 'Received', value: fmtXp(result?.xp), inline: true });
		return embed;
	}

	if (effectType === 'bounty') {
		embed
			.setTitle('🎯 Bounty Placed')
			.setDescription(`${actorMention} placed a bounty on ${targetMention} — whoever steals or bombs them next collects it.`)
			.addFields({ name: 'Bounty', value: fmtXp(result?.xp), inline: true });
		return embed;
	}

	if (effectType === 'gamble') {
		const pctNote = result?.percent ? ` (${result.percent}% of XP)` : '';
		if (result?.won) {
			embed
				.setTitle('🎲 Gamble — Win!')
				.setDescription(`${actorMention} wagered ${fmtXp(result?.wager)}${pctNote} and **won**!`)
				.addFields({ name: 'Payout', value: fmtXp(result?.payout), inline: true }, { name: 'Net gain', value: `+${fmtXp(result?.net)}`, inline: true });
		} else {
			embed
				.setTitle('🎲 Gamble — Lost')
				.setDescription(`${actorMention} wagered ${fmtXp(result?.wager)}${pctNote} and **lost it all**.`)
				.addFields({ name: 'XP lost', value: fmtXp(result?.wager), inline: true });
		}
		return embed;
	}

	if (effectType === 'shield' || effectType === 'reflect' || effectType === 'insurance') {
		const meta: Record<string, { emoji: string; title: string; desc: string }> = {
			shield: { emoji: '🛡️', title: 'Shield Activated', desc: 'is now protected — incoming steals, bombs and leeches will be blocked' },
			reflect: { emoji: '🪞', title: 'Reflect Activated', desc: 'will bounce the next attack back at the attacker' },
			insurance: {
				emoji: '💵',
				title: 'Insurance Activated',
				desc: `will be refunded ${result?.refundPercent ?? 100}% of their loss the next time they are robbed`
			}
		};
		const m = meta[effectType];
		const untilRel = discordRelative(result?.expiresAt);
		embed.setTitle(`${m.emoji} ${m.title}`).setDescription(`${actorMention} ${m.desc}${untilRel ? ` (until ${untilRel})` : ''}.`);
		return embed;
	}

	if (effectType === 'boost') {
		const untilRel = discordRelative(result?.expiresAt);
		embed
			.setTitle('⚡ Boost Activated')
			.setDescription(`${actorMention} activated a boost${untilRel ? ` — active until ${untilRel}` : ''}. Earnings are multiplied while it lasts.`);
		return embed;
	}

	return null;
}

async function announceItemUse(client: any, ctx: any) {
	const { guildId, actorDiscordId, targetDiscordId, effectType, item, result } = ctx;
	if (!ANNOUNCED_EFFECTS.has(effectType)) return;
	if (!result || result.outcome === 'unsupported') return;

	const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guildId);
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

	await channel.send({ content, embeds: [embed] }).catch(() => null);
}

export async function handleAdminGiftAnnounce(client: any, payload: any) {
	const { guild_id, member_discord_id, item_name, effect_type, quantity } = payload || {};
	if (!guild_id || !member_discord_id) return { ok: false, error: 'missing_fields' };

	const { getItemsChannelId, getEmbedConfig } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guild_id);
	if (!channelId) return { ok: true, announced: false };

	const guild = client?.guilds?.cache?.get(guild_id);
	if (!guild) return { ok: true, announced: false };
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) return { ok: true, announced: false };

	const member = await guild.members.fetch(String(member_discord_id)).catch(() => null);
	if (!member) return { ok: true, announced: false };

	const { EmbedBuilder } = await import('discord.js');
	const embedConfig = await getEmbedConfig(guild_id).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Items' }));
	const qty = Math.max(1, Number(quantity) || 1);

	const embed = new EmbedBuilder()
		.setColor(effectAccentInt(effect_type))
		.setTitle('🎁 A Gift Has Arrived')
		.setDescription(`${member} received **${qty}× ${item_name || 'an item'}** from the admin — check your bag!`)
		.setFooter({ text: embedConfig.FOOTER || 'Items' })
		.setTimestamp();

	await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
	return { ok: true, announced: true };
}

const EXPIRY_SWEEP_MS = 60_000;
let expirySweepTimer: any = null;

async function embedConfigFor(guildId: any) {
	const { getEmbedConfig } = await import('../../../config.js');
	return getEmbedConfig(guildId).catch(() => ({ COLOR: 0x14b8a6, FOOTER: 'Items' }));
}

async function getProgressChannel(guild: any) {
	const { getItemsChannelId } = await import('../../../config.js');
	const channelId = await getItemsChannelId(guild.id);
	if (!channelId) return null;
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	return channel && channel.isTextBased() ? channel : null;
}

async function deliverToMemberAndChannel(guild: any, embed: any, channelContent?: string) {
	const channel = await getProgressChannel(guild);
	if (channel) await channel.send({ content: channelContent, embeds: [embed] }).catch(() => null);
}

async function sweepExpiredBuffs(client: any, botId: any, EmbedBuilder: any) {
	const rows = await db.getNewlyExpiredEffects(botId).catch(() => []);
	if (!rows || rows.length === 0) return;

	const handledIds: number[] = [];
	for (const row of rows) {
		const meta = getItemEffect(row.effect_type);
		if (meta?.expiringBuff && meta.buffExpiredText) {
			const guild = client?.guilds?.cache?.get(String(row.discord_server_id));
			const member = guild ? await guild.members.fetch(String(row.discord_member_id)).catch(() => null) : null;
			if (guild) {
				const embedConfig = await embedConfigFor(guild.id);
				const mag = Number(row.effect_value) || 0;
				let text = meta.buffExpiredText(mag);
				if (row.effect_type === 'leech' && row.target_discord_member_id) {
					const targetMember = await guild.members.fetch(String(row.target_discord_member_id)).catch(() => null);
					const targetName = targetMember ? `${targetMember}` : row.target_server_display_name || row.target_display_name || row.target_username || 'them';
					text = `Your **${mag || 0}% Leech** on ${targetName} has ended.`;
				}
				const embed = new EmbedBuilder()
					.setColor(effectAccentInt(row.effect_type))
					.setTitle(`${meta.emoji} ${meta.label} Ended`)
					.setDescription(member ? `${member} — ${text}` : text)
					.setFooter({ text: embedConfig.FOOTER || 'Items' })
					.setTimestamp();
				await deliverToMemberAndChannel(guild, embed, member ? `${member}` : undefined);
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
		const fresh = await db.recordItemNotification(hit.member_id, 'immunity_ended', new Date(endsAt)).catch(() => false);
		if (!fresh) continue;

		const guild = client?.guilds?.cache?.get(String(hit.discord_server_id));
		if (!guild) continue;
		const member = await guild.members.fetch(String(hit.discord_member_id)).catch(() => null);
		const embedConfig = await embedConfigFor(guild.id);
		const embed = new EmbedBuilder()
			.setColor(effectAccentInt('shield'))
			.setTitle('🛡️ Immunity Ended')
			.setDescription(member ? `${member} is no longer immune — fair game again!` : `A member is no longer immune.`)
			.setFooter({ text: embedConfig.FOOTER || 'Items' })
			.setTimestamp();
		await deliverToMemberAndChannel(guild, embed, member ? `${member}` : undefined);
	}

	const attacks = await db.getRecentAttackerActions(botId).catch(() => []);
	for (const atk of attacks || []) {
		const action = atk.action === 'bomb' ? 'bomb' : 'steal';
		const lastAtk = atk.last_attack instanceof Date ? atk.last_attack.getTime() : new Date(atk.last_attack).getTime();
		if (!Number.isFinite(lastAtk)) continue;
		const cooldownMs = await cooldownMsForAction(atk.discord_server_id, action).catch(() => 0);
		if (cooldownMs <= 0) continue;
		const endsAt = lastAtk + cooldownMs;
		if (endsAt > now || now - endsAt > EXPIRY_SWEEP_MS) continue;
		const fresh = await db.recordItemNotification(atk.member_id, `cooldown_ready_${action}`, new Date(endsAt)).catch(() => false);
		if (!fresh) continue;

		const guild = client?.guilds?.cache?.get(String(atk.discord_server_id));
		if (!guild) continue;
		const member = await guild.members.fetch(String(atk.discord_member_id)).catch(() => null);
		const embedConfig = await embedConfigFor(guild.id);
		const label = action === 'bomb' ? 'Bomb' : 'Steal';
		const verb = action === 'bomb' ? 'bomb' : 'steal';
		const embed = new EmbedBuilder()
			.setColor(effectAccentInt(action))
			.setTitle(`${getItemEffect(action)?.emoji ?? '✅'} ${label} Cooldown Ready`)
			.setDescription(member ? `${member} — your ${verb} cooldown is up. You can ${verb} again!` : `${label} cooldown is up.`)
			.setFooter({ text: embedConfig.FOOTER || 'Items' })
			.setTimestamp();
		await deliverToMemberAndChannel(guild, embed, member ? `${member}` : undefined);
	}

	const insuranceActs = await db.getRecentInsuranceActivations(botId).catch(() => []);
	for (const act of insuranceActs || []) {
		const lastAct = act.last_activation instanceof Date ? act.last_activation.getTime() : new Date(act.last_activation).getTime();
		if (!Number.isFinite(lastAct)) continue;
		const cooldownMs = await maxAttackConfigMs(act.discord_server_id, 'cooldown_minutes', 'insurance').catch(() => 0);
		if (cooldownMs <= 0) continue;
		const endsAt = lastAct + cooldownMs;
		if (endsAt > now || now - endsAt > EXPIRY_SWEEP_MS) continue;
		const fresh = await db.recordItemNotification(act.member_id, 'cooldown_ready_insurance', new Date(endsAt)).catch(() => false);
		if (!fresh) continue;

		const guild = client?.guilds?.cache?.get(String(act.discord_server_id));
		if (!guild) continue;
		const member = await guild.members.fetch(String(act.discord_member_id)).catch(() => null);
		const embedConfig = await embedConfigFor(guild.id);
		const embed = new EmbedBuilder()
			.setColor(effectAccentInt('insurance'))
			.setTitle(`${getItemEffect('insurance')?.emoji ?? '✅'} Insurance Cooldown Ready`)
			.setDescription(member ? `${member} — your insurance cooldown is up. You can activate insurance again!` : `Insurance cooldown is up.`)
			.setFooter({ text: embedConfig.FOOTER || 'Items' })
			.setTimestamp();
		await deliverToMemberAndChannel(guild, embed, member ? `${member}` : undefined);
	}
}

async function cooldownMsForAction(discordServerId: any, action: 'steal' | 'bomb'): Promise<number> {
	return maxAttackConfigMs(discordServerId, 'cooldown_minutes', action);
}
async function defaultImmunityMsForServer(discordServerId: any): Promise<number> {
	return Math.max(await maxAttackConfigMs(discordServerId, 'immunity_minutes', 'steal'), await maxAttackConfigMs(discordServerId, 'immunity_minutes', 'bomb'));
}

const attackCfgCache = new Map<string, { value: number; at: number }>();
async function maxAttackConfigMs(discordServerId: any, key: string, effectType: string): Promise<number> {
	const cacheKey = `${discordServerId}:${effectType}:${key}`;
	const cached = attackCfgCache.get(cacheKey);
	if (cached && Date.now() - cached.at < 60_000) return cached.value;

	const { getServerForCurrentBot } = await import('../../../config.js');
	let server: any;
	try {
		server = await getServerForCurrentBot(String(discordServerId));
	} catch (_) {
		return 0;
	}
	const panelId = await db.getBotPanelId(server.bot_id).catch(() => null);
	if (panelId == null) return 0;
	const items = await db.listItems(panelId, {}).catch(() => []);
	let maxMin = 0;
	for (const it of (items as any[]) || []) {
		if (it.effect_type !== effectType) continue;
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
		await db.purgeDepletedMemberItems().catch(() => 0);
	} catch (err: any) {
		await logger.log(`⚠️ Item expiry sweep failed: ${err.message}`);
	}
}

export function initExpirySweeper(client: any) {
	if (expirySweepTimer) clearInterval(expirySweepTimer);
	db.backfillItemLogItemIds()
		.then((n: number) => (n > 0 ? logger.log(`🧾 Backfilled item_id on ${n} item-history rows`) : null))
		.catch(() => null);
	expirySweepTimer = setInterval(() => {
		runExpirySweep(client).catch(() => null);
	}, EXPIRY_SWEEP_MS);
}

export function stopExpirySweeper() {
	if (expirySweepTimer) clearInterval(expirySweepTimer);
	expirySweepTimer = null;
}

export { invalidateEffectCache };
