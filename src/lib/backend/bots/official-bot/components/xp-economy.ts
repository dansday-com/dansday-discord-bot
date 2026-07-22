import db from '../../../../database.js';
import { getLevelRequirement, determineLevel } from './leveling.js';

export async function reevaluateLevel(memberId: any, stats: any, guildId: any) {
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
