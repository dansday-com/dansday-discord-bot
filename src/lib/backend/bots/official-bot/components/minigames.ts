import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { evaluateMemberLevelAndRank, determineLevel } from './leveling.js';
import { getSpendableXp, spendXp, reevaluateLevel } from './xp-economy.js';
import { getActiveLuckPercent } from './items.js';
import { luckBoostLabel } from '../../../../items.js';
import { TOWER_DOORS, TOWER_FLOORS, TOWER_GAME, TOWER_RESET_HOURS, towerBaseChance, towerPrize, towerSafeChance, towerTrapCount } from '../../../../tower.js';
import {
	COLOR_GAME,
	COLOR_MAX_TOTAL,
	COLOR_ROUNDS,
	colorGuess,
	colorRounds,
	colorSeed,
	colorTargets,
	colorTotal,
	colorXp,
	decodeColorGuesses,
	encodeColorGuesses,
	hsbToHex
} from '../../../../color.js';
import { serverTranslator } from '../i18n.js';

const MIN_MULTIPLIER = 1.01;
const MAX_MULTIPLIER = 10;
const MIN_WAGER = 1;
const ANNOUNCE_DELAY_MS = 7000;
const TOWER_ANNOUNCE_DELAY_MS = 1500;
const TOWER_RESET_MS = TOWER_RESET_HOURS * 3600000;
const COLOR_ANNOUNCE_DELAY_MS = 4000;

function clampMultiplier(raw: any): number {
	const m = Number(raw);
	if (!Number.isFinite(m)) return MIN_MULTIPLIER;
	return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, Math.round(m * 100) / 100));
}

function winChanceFor(multiplier: number): number {
	return 100 / multiplier;
}

async function resolveServerMemberId(serverId: any, discordId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordId)).catch(() => null);
	return member?.id ?? null;
}

export async function handleMinigamePlay(client: any, payload: any) {
	const { guild_id, actor_discord_id, multiplier, xp: amount } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isPublicSubFeatureEnabled(guild_id, 'minigames'))) {
		return { ok: false, error: 'minigames_disabled' };
	}

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const mult = clampMultiplier(multiplier);
	const luckPercent = await getActiveLuckPercent(actorMemberId);
	const baseChance = winChanceFor(mult);
	const chance = luckPercent > 0 ? Math.min(100, baseChance + luckPercent) : baseChance;

	const balance = await getSpendableXp(actorMemberId, guild_id);
	const wager = Math.max(0, Math.floor(Number(amount) || 0));
	if (wager < MIN_WAGER) return { ok: false, error: 'below_minimum', min: MIN_WAGER };
	if (wager > balance.total) return { ok: false, error: 'insufficient_xp' };

	const spend = await spendXp(actorMemberId, wager, guild_id);
	if (!spend.ok) return { ok: false, error: 'insufficient_xp' };

	const roll = Math.random() * 100;
	const won = roll < chance;

	let netChange = -wager;
	let payout = 0;
	if (won) {
		payout = Math.floor(wager * mult);
		await db.ensureMemberLevel(actorMemberId);
		const after = await db.updateMemberLevelStats(actorMemberId, { xpIncrement: payout });
		const rawXp = after?.xp ?? 0;
		const xp = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
		const expectedLevel = await determineLevel(xp, guild_id);
		let storedLevel = after?.level;
		if (typeof storedLevel === 'bigint') storedLevel = Number(storedLevel);
		if (storedLevel !== expectedLevel) await db.updateMemberLevelStats(actorMemberId, { level: expectedLevel });
		netChange = payout - wager;
	}

	await db
		.logMinigameAction(actorMemberId, {
			game: 'gamble',
			multiplier: mult,
			wager,
			payout,
			xp: netChange,
			outcome: won ? 'win' : 'lose',
			chance,
			luck_percent: luckPercent || null
		})
		.catch(() => null);

	await evaluateMemberLevelAndRank(guild_id, actorMemberId, { reason: 'minigame' }).catch(() => null);

	const result = { outcome: won ? 'win' : 'lose', won, wager, payout, net: netChange, multiplier: mult, chance, luckPercent };
	setTimeout(() => {
		announceMinigame(client, { guildId: guild_id, actorDiscordId: actor_discord_id, result }).catch(() => null);
	}, ANNOUNCE_DELAY_MS);

	return { ok: true, outcome: result.outcome, result };
}

function fmtXp(v: any): string {
	return `${Math.abs(Number(v) || 0).toLocaleString()} XP`;
}

async function announceMinigame(client: any, ctx: any) {
	const { guildId, actorDiscordId, result } = ctx;
	if (!result) return;

	try {
		const { getMinigamesChannelId, getEmbedConfig } = await import('../../../config.js');
		const channelId = await getMinigamesChannelId(guildId);
		if (!channelId) return;

		const guild = client?.guilds?.cache?.get(guildId);
		if (!guild) return;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) return;

		const { EmbedBuilder } = await import('discord.js');
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: '' }));

		const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
		const actorMention = actor ? `${actor}` : tr('minigames.someone');
		const winChanceLabel = luckBoostLabel(result.chance - (result.luckPercent || 0), result.luckPercent);
		const story = { member: actorMention, wager: fmtXp(result.wager), multiplier: result.multiplier };

		const embed = new EmbedBuilder()
			.setColor(0xc8911a)
			.setFooter({ text: embedConfig.FOOTER || tr('minigames.footer') })
			.setTimestamp();

		if (result.won) {
			embed
				.setTitle(tr('minigames.win.title'))
				.setDescription(tr('minigames.win.description', story))
				.addFields(
					{ name: tr('minigames.fields.payout'), value: fmtXp(result.payout), inline: true },
					{ name: tr('minigames.fields.netGain'), value: `+${fmtXp(result.net)}`, inline: true },
					{ name: tr('minigames.fields.winChance'), value: winChanceLabel, inline: true }
				);
		} else {
			embed
				.setTitle(tr('minigames.lose.title'))
				.setDescription(tr('minigames.lose.description', story))
				.addFields(
					{ name: tr('minigames.fields.xpLost'), value: fmtXp(result.wager), inline: true },
					{ name: tr('minigames.fields.winChance'), value: winChanceLabel, inline: true }
				);
		}

		const content = actor ? `${actor}` : undefined;
		await channel.send({ content, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Minigame announce failed: ${err?.message || String(err)}`);
	}
}

const towerQueues = new Map<number, Promise<any>>();
const colorQueues = new Map<number, Promise<any>>();

function queueMember<T>(queues: Map<number, Promise<any>>, memberId: number, task: () => Promise<T>): Promise<T> {
	const run = (queues.get(memberId) ?? Promise.resolve()).then(task, task);
	const tail = run.catch(() => null);
	queues.set(memberId, tail);
	tail.then(() => {
		if (queues.get(memberId) === tail) queues.delete(memberId);
	});
	return run;
}

async function loadTower(memberId: number) {
	const [run, window, luckPercent] = await Promise.all([db.getActiveTowerRun(memberId), db.getTowerWindow(memberId), getActiveLuckPercent(memberId)]);
	const resetsInMs = window ? Math.max(0, window.startedAt.getTime() + TOWER_RESET_MS - Date.now()) : 0;
	const used = window && resetsInMs > 0 ? window.climbs : 0;
	const floor = run ? Number(run.floor) || 0 : 0;
	const state = {
		active: !!run,
		floor,
		prize: towerPrize(floor),
		climb: run ? Math.max(1, Number(run.slot) || 1) : used + 1,
		climbsUsed: used,
		resetsInMs,
		luckPercent
	};
	return { run, used, state };
}

function placeTraps(picked: number, safe: boolean, count: number): number[] {
	const others = Array.from({ length: TOWER_DOORS }, (_, d) => d).filter((d) => d !== picked);
	for (let i = others.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[others[i], others[j]] = [others[j], others[i]];
	}
	return safe ? others.slice(0, count) : [picked, ...others.slice(0, count - 1)];
}

export async function handleTowerAction(client: any, payload: any) {
	const { guild_id, actor_discord_id, action, door } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isPublicSubFeatureEnabled(guild_id, 'minigames'))) {
		return { ok: false, error: 'minigames_disabled' };
	}

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const ctx = { guildId: guild_id, actorDiscordId: actor_discord_id, memberId: Number(actorMemberId) };

	return queueMember(towerQueues, ctx.memberId, async () => {
		const { run, used, state } = await loadTower(ctx.memberId);

		if (action === 'state') return { ok: true, state };

		if (action === 'start') {
			if (run) return { ok: true, state };
			await db.createTowerRun(ctx.memberId, used + 1);
			return {
				ok: true,
				state: { ...state, active: true, climb: used + 1, climbsUsed: used + 1, resetsInMs: used > 0 ? state.resetsInMs : TOWER_RESET_MS }
			};
		}

		if (!run) return { ok: false, error: 'no_active_run', state };
		const cleared = state.floor;

		if (action === 'cashout') {
			if (cleared < 1) return { ok: false, error: 'nothing_to_cash', state };
			const payout = towerPrize(cleared);
			if (!(await db.stepTowerRun(run.id, cleared, { floor: cleared, status: 'cashed', payout }))) return { ok: false, error: 'run_changed', state };
			return finishTower(client, ctx, state, { outcome: 'cashed', floor: cleared, payout, lost: 0 });
		}

		if (action !== 'pick') return { ok: false, error: 'invalid_action', state };

		const picked = Math.floor(Number(door));
		if (!(picked >= 0 && picked < TOWER_DOORS)) return { ok: false, error: 'invalid_door', state };

		const floor = cleared + 1;
		const chance = towerSafeChance(floor, state.climb, state.luckPercent);
		const safe = Math.random() * 100 < chance;
		const reveal = { door: picked, trapDoors: placeTraps(picked, safe, towerTrapCount(chance)), floor };

		if (!safe) {
			if (!(await db.stepTowerRun(run.id, cleared, { floor: cleared, status: 'bust' }))) return { ok: false, error: 'run_changed', state };
			return finishTower(client, ctx, state, { ...reveal, outcome: 'bust', payout: 0, lost: towerPrize(cleared) });
		}

		if (floor >= TOWER_FLOORS) {
			const payout = towerPrize(floor);
			if (!(await db.stepTowerRun(run.id, cleared, { floor, status: 'cleared', payout }))) return { ok: false, error: 'run_changed', state };
			return finishTower(client, ctx, state, { ...reveal, outcome: 'cleared', payout, lost: 0 });
		}

		if (!(await db.stepTowerRun(run.id, cleared, { floor, status: 'active' }))) return { ok: false, error: 'run_changed', state };
		return { ok: true, step: { ...reveal, outcome: 'safe', payout: 0, lost: 0 }, state: { ...state, floor, prize: towerPrize(floor) } };
	});
}

async function finishTower(client: any, ctx: any, state: any, step: any) {
	const { guildId, actorDiscordId, memberId } = ctx;
	const base = towerBaseChance(step.floor, state.climb);
	const chance = towerSafeChance(step.floor, state.climb, state.luckPercent);

	if (step.payout > 0) {
		await db.ensureMemberLevel(memberId);
		const after = await db.updateMemberLevelStats(memberId, { xpIncrement: step.payout });
		await reevaluateLevel(memberId, after, guildId);
	}

	await db
		.logMinigameAction(memberId, {
			game: TOWER_GAME,
			multiplier: step.floor,
			wager: 0,
			payout: step.payout,
			xp: step.payout,
			outcome: step.payout > 0 ? 'win' : 'lose',
			chance,
			luck_percent: state.luckPercent || null
		})
		.catch(() => null);

	if (step.payout > 0) await evaluateMemberLevelAndRank(guildId, memberId, { reason: 'minigame' }).catch(() => null);

	const result = { ...step, base, luckPercent: state.luckPercent };
	setTimeout(() => {
		announceTower(client, { guildId, actorDiscordId, result }).catch(() => null);
	}, TOWER_ANNOUNCE_DELAY_MS);

	return { ok: true, step, state: { ...state, active: false, floor: 0, prize: 0 } };
}

const TOWER_OUTCOME_KEY: Record<string, string> = { cashed: 'cashout', cleared: 'cleared', bust: 'bust' };

async function announceTower(client: any, ctx: any) {
	const { guildId, actorDiscordId, result } = ctx;
	if (!result) return;

	try {
		const { getMinigamesChannelId, getEmbedConfig } = await import('../../../config.js');
		const channelId = await getMinigamesChannelId(guildId);
		if (!channelId) return;

		const guild = client?.guilds?.cache?.get(guildId);
		if (!guild) return;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) return;

		const { EmbedBuilder } = await import('discord.js');
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: '' }));

		const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
		const story = {
			member: actor ? `${actor}` : tr('minigames.someone'),
			floor: result.floor,
			payout: fmtXp(result.payout),
			lost: fmtXp(result.lost)
		};
		const key = TOWER_OUTCOME_KEY[result.outcome] ?? 'bust';
		const storyKey = key === 'bust' && !(result.lost > 0) ? 'bustEmpty' : key;
		const prize = result.payout > 0 ? `+${fmtXp(result.payout)}` : result.lost > 0 ? `~~${fmtXp(result.lost)}~~` : fmtXp(0);

		const embed = new EmbedBuilder()
			.setColor(0xc8911a)
			.setTitle(tr(`minigames.tower.${key}.title`))
			.setDescription(tr(`minigames.tower.${storyKey}.description`, story))
			.addFields(
				{ name: tr('minigames.tower.fields.floor'), value: `${result.floor}`, inline: true },
				{ name: tr('minigames.tower.fields.safeChance'), value: luckBoostLabel(result.base, result.luckPercent, { max: 100 }), inline: true },
				{ name: tr('minigames.tower.fields.prize'), value: prize, inline: true }
			)
			.setFooter({ text: embedConfig.FOOTER || tr('minigames.footer') })
			.setTimestamp();

		const content = actor ? `${actor}` : undefined;
		await channel.send({ content, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Tower announce failed: ${err?.message || String(err)}`);
	}
}

async function loadColor(memberId: number) {
	const run = await db.getActiveColorRun(memberId);
	const guesses = run ? decodeColorGuesses(run.guesses) : [];
	const state = {
		active: !!run,
		round: guesses.length,
		rounds: run ? colorRounds(run.seed, guesses) : [],
		target: run ? (colorTargets(run.seed)[guesses.length] ?? null) : null
	};
	return { run, guesses, state };
}

export async function handleColorAction(client: any, payload: any) {
	const { guild_id, actor_discord_id, action } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isPublicSubFeatureEnabled(guild_id, 'minigames'))) {
		return { ok: false, error: 'minigames_disabled' };
	}

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const ctx = { guildId: guild_id, actorDiscordId: actor_discord_id, memberId: Number(actorMemberId) };

	return queueMember(colorQueues, ctx.memberId, async () => {
		const { run, guesses, state } = await loadColor(ctx.memberId);

		if (action === 'state') return { ok: true, state };

		if (action === 'start') {
			if (run) return { ok: true, state };
			const seed = colorSeed();
			await db.createColorRun(ctx.memberId, seed);
			return { ok: true, state: { ...state, active: true, target: colorTargets(seed)[0] } };
		}

		if (!run) return { ok: false, error: 'no_active_run', state };
		if (action !== 'guess') return { ok: false, error: 'invalid_action', state };

		const guess = colorGuess(payload);
		if (!guess) return { ok: false, error: 'invalid_guess', state };

		const played = state.round;
		const rounds = colorRounds(run.seed, [...guesses, guess]);
		const step = { ...rounds[played], round: played + 1 };
		const encoded = encodeColorGuesses(rounds.map((r) => r.guess));

		if (rounds.length >= COLOR_ROUNDS) {
			const total = colorTotal(rounds.map((r) => r.score));
			const payout = colorXp(total);
			if (!(await db.stepColorRun(run.id, played, { round: rounds.length, guesses: encoded, status: 'done', payout }))) {
				return { ok: false, error: 'run_changed', state };
			}
			return finishColor(client, ctx, state, { ...step, done: true, total, payout }, rounds);
		}

		if (!(await db.stepColorRun(run.id, played, { round: rounds.length, guesses: encoded, status: 'active' }))) {
			return { ok: false, error: 'run_changed', state };
		}
		return { ok: true, step: { ...step, done: false }, state: { ...state, round: rounds.length, rounds, target: colorTargets(run.seed)[rounds.length] } };
	});
}

async function finishColor(client: any, ctx: any, state: any, step: any, rounds: any[]) {
	const { guildId, actorDiscordId, memberId } = ctx;

	if (step.payout > 0) {
		await db.ensureMemberLevel(memberId);
		const after = await db.updateMemberLevelStats(memberId, { xpIncrement: step.payout });
		await reevaluateLevel(memberId, after, guildId);
	}

	await db
		.logMinigameAction(memberId, {
			game: COLOR_GAME,
			multiplier: step.total,
			wager: 0,
			payout: step.payout,
			xp: step.payout,
			outcome: step.payout > 0 ? 'win' : 'lose',
			chance: null,
			luck_percent: null
		})
		.catch(() => null);

	if (step.payout > 0) await evaluateMemberLevelAndRank(guildId, memberId, { reason: 'minigame' }).catch(() => null);

	const best = rounds.reduce((top, r) => (r.score > top.score ? r : top), rounds[0]);
	setTimeout(() => {
		announceColor(client, { guildId, actorDiscordId, result: { total: step.total, payout: step.payout, best } }).catch(() => null);
	}, COLOR_ANNOUNCE_DELAY_MS);

	return { ok: true, step, state: { ...state, active: false, round: 0, rounds: [], target: null } };
}

async function announceColor(client: any, ctx: any) {
	const { guildId, actorDiscordId, result } = ctx;
	if (!result) return;

	try {
		const { getMinigamesChannelId, getEmbedConfig } = await import('../../../config.js');
		const channelId = await getMinigamesChannelId(guildId);
		if (!channelId) return;

		const guild = client?.guilds?.cache?.get(guildId);
		if (!guild) return;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) return;

		const { EmbedBuilder } = await import('discord.js');
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: '' }));

		const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
		const story = { member: actor ? `${actor}` : tr('minigames.someone'), rounds: COLOR_ROUNDS, payout: fmtXp(result.payout) };

		const embed = new EmbedBuilder()
			.setColor(hsbToHex(result.best.target))
			.setTitle(tr('minigames.color.title'))
			.setDescription(tr('minigames.color.description', story))
			.addFields(
				{ name: tr('minigames.color.fields.score'), value: `${result.total.toFixed(2)} / ${COLOR_MAX_TOTAL}`, inline: true },
				{ name: tr('minigames.color.fields.bestRound'), value: `${result.best.score.toFixed(2)}`, inline: true },
				{ name: tr('minigames.color.fields.prize'), value: `+${fmtXp(result.payout)}`, inline: true }
			)
			.setFooter({ text: embedConfig.FOOTER || tr('minigames.footer') })
			.setTimestamp();

		const content = actor ? `${actor}` : undefined;
		await channel.send({ content, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Color announce failed: ${err?.message || String(err)}`);
	}
}
