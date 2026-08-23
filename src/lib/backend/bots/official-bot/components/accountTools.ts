import { Type } from '@google/genai';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { BAG_CAPACITY, effectSummary, formatDuration, getItemEffect } from '../../../../items.js';
import { computeCardToken, loadItemsShared } from '../../../../frontend/public/items/index.js';
import { loadTasksShared } from '../../../../frontend/public/tasks/index.js';
import { SERVER_SETTINGS } from '../../../../frontend/panelServer.js';
import { VOICE_NOTE, fail, formatMs, memberByDiscordId, memberTzOffset, nameOfMember, num, publicServer, safeConfig } from './aiToolShared.js';

const MAX_HISTORY_ROWS = 20;

async function callerAccount(botId, guildId, callerDiscordId) {
	if (!callerDiscordId) return { error: fail('unknown_caller') };

	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return { error: ctx.error };

	const member = await memberByDiscordId(ctx.server.id, callerDiscordId);
	if (!member) return { error: fail('you_are_not_registered_in_this_server') };

	return { ctx, member, hash: computeCardToken(String(member.discord_member_id), member.member_since) };
}

async function sharedFor(ctx, hash) {
	const shared: any = await loadItemsShared(ctx.server, hash, null).catch(() => null);
	if (!shared || 'notFound' in shared || 'guest' in shared || !shared.member) return null;
	return shared;
}

async function accountOverview(ctx, shared, member) {
	const [dashboard, insights, buddies, levelingRow] = await Promise.all([
		db.getMemberDashboard(member.id, {}).catch(() => null),
		db.getMemberInsights(member.id, ctx.server.id).catch(() => null),
		db.getMemberLevelFriends(member.id, 5).catch(() => []),
		db.getServerSettings(ctx.server.id, SERVER_SETTINGS.component.leveling).catch(() => null)
	]);

	const rates = (levelingRow as any)?.settings ?? {};
	const xpSources = [
		{ source: 'Messages', xp: num(member.chat_total) * num(rates.MESSAGE?.XP) },
		{ source: 'Voice', xp: num(member.voice_minutes_active) * num(rates.VOICE?.XP_PER_MINUTE) },
		{ source: 'Video', xp: num(member.voice_minutes_video) * num(rates.VIDEO?.XP_PER_MINUTE) },
		{ source: 'Streaming', xp: num(member.voice_minutes_streaming) * num(rates.STREAMING?.XP_PER_MINUTE) },
		{ source: 'AFK voice', xp: num(member.voice_minutes_afk) * num(rates.VOICE?.AFK_XP_PER_MINUTE) }
	]
		.map((s) => ({ ...s, xp: Math.round(s.xp) }))
		.filter((s) => s.xp > 0)
		.sort((a, b) => b.xp - a.xp);

	return {
		name: nameOfMember(member),
		level: num(member.level),
		xp: num(member.xp),
		rank: member.rank != null ? num(member.rank) : null,
		messages: num(member.chat_total),
		voice_minutes: {
			active: num(member.voice_minutes_active),
			afk: num(member.voice_minutes_afk),
			video: num(member.voice_minutes_video),
			streaming: num(member.voice_minutes_streaming)
		},
		xp_by_source: xpSources,
		voice_buddies: (buddies ?? []).map((b) => ({
			name: b.name,
			minutes_together: num(b.minutes),
			xp_earned_together: num(b.xp)
		})),
		voice_buddies_note: 'The members they share voice channels with most. Every other member in the channel adds +10% voice XP.',
		roles: (member.roles ?? []).map((r) => r.name),
		is_booster: !!member.is_booster,
		booster_since: member.booster_since ? new Date(member.booster_since).toISOString() : null,
		is_afk: !!member.is_afk,
		afk_message: member.afk_message ?? null,
		member_since: member.member_since ? new Date(member.member_since).toISOString() : null,
		discord_account_since: member.profile_created_at ? new Date(member.profile_created_at).toISOString() : null,
		luck_percent: shared.luckPercent ?? 0,
		bounty_on_you: shared.bountyTotal ?? 0,
		active_effects: (shared.activeEffects ?? []).map((e) => ({
			effect: e.effect_type,
			value: e.effect_value,
			expires_in: e.expiresAt ? formatMs(e.expiresAt - Date.now()) : null
		})),
		...(dashboard
			? {
					totals: {
						items_bought: dashboard.items_buys,
						xp_spent_on_items: dashboard.items_buy_spend,
						xp_stolen_by_you: dashboard.items_stolen,
						times_robbed: dashboard.items_stolen_from,
						times_bombed: dashboard.items_bombed_by,
						gifts_received: dashboard.items_gifts_received,
						minigames_played: dashboard.minigames_plays,
						minigames_net_xp: dashboard.minigames_net,
						giveaways_won: dashboard.giveaways_won,
						quests_claimed: dashboard.quests_claimed
					}
				}
			: {}),
		...(insights?.favorite_items?.length ? { favourite_items: insights.favorite_items.slice(0, 5) } : {}),
		...(insights?.relationships ? { relationships: insights.relationships } : {})
	};
}

async function accountItems(shared, member) {
	const inventory = await db.getMemberInventory(member.id).catch(() => []);
	const owned = (inventory ?? [])
		.filter((row) => num(row.quantity) > 0)
		.map((row) => {
			const config = safeConfig(row.config);
			const durationMinutes = num(config.duration_minutes);
			return {
				item: row.name,
				type: row.effect_type,
				quantity: num(row.quantity),
				usable: row.usable !== false && row.usable !== 0,
				targeted: getItemEffect(row.effect_type)?.targeted === true,
				shop_cost_xp: num(row.cost),
				...(durationMinutes > 0 ? { lasts: formatDuration(durationMinutes) } : {}),
				what_it_does: effectSummary({ effect_type: row.effect_type, description: row.description, config })
			};
		});

	return {
		wallet_xp: shared.balance?.xp ?? 0,
		bag: owned,
		distinct_items: owned.length,
		total_copies: owned.reduce((sum, i) => sum + i.quantity, 0),
		bag_used: num(shared.bagStock),
		bag_capacity: BAG_CAPACITY,
		bag_is_empty: owned.length === 0,
		active_effects: (shared.activeEffects ?? []).map((e) => ({
			effect: e.effect_type,
			value: e.effect_value,
			expires_in: e.expiresAt ? formatMs(e.expiresAt - Date.now()) : null
		})),
		attack_cooldowns: (shared.attackCooldowns ?? []).map((c) => ({ action: c.action, ready_in: formatMs(c.until - Date.now()) })),
		immune_for: shared.immuneUntil ? formatMs(shared.immuneUntil - Date.now()) : null,
		insurance_ready_in: shared.insuranceCooldownUntil ? formatMs(shared.insuranceCooldownUntil - Date.now()) : null
	};
}

async function accountAssets(ctx, member) {
	if (!ctx.assetsEnabled) return fail('assets_not_enabled_for_this_server');

	const { loadAssetPriceMap } = await import('../../../../frontend/public/assets/index.js');
	const priceMap = await loadAssetPriceMap().catch(() => ({}));
	const rows = await db.getOpenAssetPositions(member.id).catch(() => []);

	let invested = 0;
	let value = 0;
	const holdings = [];

	for (const p of rows) {
		const xpInvested = num(p.xp_invested);
		const buyPrice = num(p.buy_price);
		const market = priceMap[`${p.asset_type}:${p.asset_id}`];
		const price = num(market?.price) > 0 ? num(market.price) : buyPrice;
		const worth = buyPrice > 0 ? Math.round(xpInvested * (price / buyPrice)) : xpInvested;
		invested += xpInvested;
		value += worth;
		holdings.push({
			asset: p.symbol || p.asset_name || 'Asset',
			invested_xp: xpInvested,
			value_xp: worth,
			profit_xp: worth - xpInvested,
			change_24h_percent: num(market?.change24h)
		});
	}

	return {
		holdings: holdings.sort((a, b) => b.value_xp - a.value_xp),
		total_invested_xp: invested,
		total_value_xp: value,
		total_profit_xp: value - invested,
		nothing_invested: holdings.length === 0
	};
}

async function accountMinigames(ctx, member) {
	if (!ctx.minigamesEnabled) return fail('minigames_not_enabled_for_this_server');

	const history = await db.getMemberMinigameHistory(member.id, 0).catch(() => []);
	const rows = Array.isArray(history) ? history : [];

	const plays = rows.length;
	const wins = rows.filter((r) => r.outcome === 'win').length;
	const wagered = rows.reduce((sum, r) => sum + num(r.wager), 0);
	const net = rows.reduce((sum, r) => sum + num(r.xp), 0);
	const biggestWin = rows.reduce((best, r) => Math.max(best, num(r.xp)), 0);

	return {
		plays,
		wins,
		losses: Math.max(0, plays - wins),
		wagered_xp: wagered,
		net_xp: net,
		biggest_win_xp: biggestWin,
		recent: rows.slice(0, 5).map((r) => ({
			game: r.game,
			wager_xp: num(r.wager),
			result: r.outcome,
			xp_change: num(r.xp),
			when: r.created_at ? new Date(r.created_at).toISOString() : null
		})),
		never_played: plays === 0
	};
}

async function accountHistory(ctx, member, args) {
	const wanted = String(args?.history_type ?? 'all');

	const itemRows = ctx.itemsEnabled && wanted !== 'level' ? await db.getMemberItemHistory(member.id, 0).catch(() => []) : [];
	const levelRows = wanted !== 'items' ? await db.getMemberLevelHistory(member.id, 0).catch(() => []) : [];

	const events = [
		...itemRows.map((h) => ({
			kind: 'item',
			at: h.created_at ? new Date(h.created_at).getTime() : 0,
			action: h.action,
			item: h.item_name ?? null,
			outcome: h.outcome,
			xp: num(h.xp),
			direction: h.direction === 'incoming' ? 'incoming' : 'outgoing',
			other_member:
				h.direction === 'incoming' && Number(h.actor_disguised) === 1
					? 'someone disguised'
					: h.target_server_display_name || h.target_display_name || h.actor_server_display_name || h.actor_display_name || null
		})),
		...levelRows.map((x) => ({
			kind: 'level',
			at: x.created_at ? new Date(x.created_at).getTime() : 0,
			source: x.source,
			xp: num(x.xp),
			level: x.level != null ? num(x.level) : null
		}))
	]
		.sort((a, b) => b.at - a.at)
		.slice(0, MAX_HISTORY_ROWS)
		.map(({ at, ...rest }) => ({ ...rest, when: at ? new Date(at).toISOString() : null }));

	return { events, nothing_yet: events.length === 0 };
}

async function accountTasks(ctx, member) {
	const tzOffsetMin = await memberTzOffset(member.id);

	const tasks = await loadTasksShared({
		server: ctx.server,
		member,
		itemsEnabled: ctx.itemsEnabled,
		minigamesEnabled: ctx.minigamesEnabled,
		assetsEnabled: ctx.assetsEnabled,
		tzOffsetMin,
		generate: false
	}).catch((error) => {
		logger.log(`❌ AI task lookup failed: ${error.message}`);
		return null;
	});

	if (!tasks) return fail('tasks_unavailable');

	const shape = (t) => ({
		task: t.description ?? t.label,
		progress: `${num(t.progress)}/${num(t.goal)}`,
		done: t.complete === true,
		claimed: t.claimed === true,
		reward: t.reward?.kind === 'item' ? `item: ${t.reward.name}` : `${num(t.reward?.xp)} XP`,
		difficulty: t.difficulty ?? null
	});

	const daily = (tasks.daily ?? []).map(shape);
	const weekly = (tasks.weekly ?? []).map(shape);

	const streak = tasks.streak ?? {};
	const login = tasks.login ?? {};

	const rewardName = async (reward) => {
		if (!reward) return null;
		if (reward.kind === 'xp') return `${num(reward.xp)} XP`;
		const item = await db.getItem(reward.itemId).catch(() => null);
		return item?.name ? `item: ${item.name}` : 'a shop item';
	};

	const nextLoginReward = (login.rewards ?? []).find((r) => r.current) ?? null;

	return {
		daily_resets_in: formatMs(num(tasks.resetsInMs)),
		weekly_resets_in: formatMs(num(tasks.weeklyResetsInMs)),
		daily: {
			done: daily.filter((t) => t.done).length,
			total: daily.length,
			unclaimed: daily.filter((t) => t.done && !t.claimed).map((t) => t.task),
			remaining: daily.filter((t) => !t.done)
		},
		weekly: {
			done: weekly.filter((t) => t.done).length,
			total: weekly.length,
			unclaimed: weekly.filter((t) => t.done && !t.claimed).map((t) => t.task),
			remaining: weekly.filter((t) => !t.done)
		},
		streak: {
			current_days: num(streak.current),
			longest_days: num(streak.longest),
			banked_today: streak.lastClaimDayKey != null && Number(streak.lastClaimDayKey) === num(tasks.dayKey),
			freezes_left: num(streak.freezes),
			freezes_max: num(streak.freezeMax),
			freeze_earned_every: num(streak.earnEvery),
			next_milestone: streak.nextMilestone ? `${streak.nextMilestone.emoji} ${streak.nextMilestone.label} at ${streak.nextMilestone.at} days` : null,
			days_to_next_milestone: num(streak.toNextMilestone),
			how_it_works:
				'Finish any one task, daily or weekly, to bank the day. Each streak day adds +2% task XP, up to +100%. A freeze covers one missed day by itself.'
		},
		daily_check_in: {
			cycle_day: num(login.cycleDay),
			next_day: num(login.nextDay),
			cycle_length: num(login.cycleDays),
			claimed_today: login.claimedToday === true,
			can_claim_now: login.canClaim === true,
			cycles_completed: num(login.cyclesCompleted),
			next_reward: nextLoginReward ? await rewardName(nextLoginReward) : null,
			how_it_works: 'One claim a day. Day 7 is the jackpot. Miss a day and the cycle restarts at day 1.'
		}
	};
}

async function withAccount(botId, guildId, callerDiscordId, run) {
	const resolved: any = await callerAccount(botId, guildId, callerDiscordId);
	if (resolved.error) return resolved.error;

	const { ctx, member, hash } = resolved;
	const result: any = await run({ ctx, member, hash });
	return result?.ok === false ? result : { ok: true, ...result };
}

export function runMyOverviewTool(botId, guildId, callerDiscordId) {
	return withAccount(botId, guildId, callerDiscordId, async ({ ctx, member, hash }) => {
		const shared = await sharedFor(ctx, hash);
		if (!shared) return fail('account_unavailable');
		return accountOverview(ctx, shared, member);
	});
}

export function runMyItemsTool(botId, guildId, callerDiscordId) {
	return withAccount(botId, guildId, callerDiscordId, async ({ ctx, member, hash }) => {
		if (!ctx.itemsEnabled) return fail('items_not_enabled_for_this_server');
		const shared = await sharedFor(ctx, hash);
		if (!shared) return fail('account_unavailable');
		return accountItems(shared, member);
	});
}

export function runMyAssetsTool(botId, guildId, callerDiscordId) {
	return withAccount(botId, guildId, callerDiscordId, ({ ctx, member }) => accountAssets(ctx, member));
}

export function runMyMinigamesTool(botId, guildId, callerDiscordId) {
	return withAccount(botId, guildId, callerDiscordId, ({ ctx, member }) => accountMinigames(ctx, member));
}

export function runMyHistoryTool(botId, guildId, callerDiscordId, args) {
	return withAccount(botId, guildId, callerDiscordId, ({ ctx, member }) => accountHistory(ctx, member, args));
}

export function runMyTasksTool(botId, guildId, callerDiscordId) {
	return withAccount(botId, guildId, callerDiscordId, ({ ctx, member }) => accountTasks(ctx, member));
}

const OWN_ONLY =
	'This always reads the account of the person talking to you right now, and it is the only account it can read. Never call it to answer a question about somebody else — if they ask about another member, say that part is private to them and offer get_member_info for the public fields instead.';

const OVERVIEW_DESCRIPTION = `The asker's own profile in this server, in full: level, XP, rank, message count and voice minutes broken down into active, AFK, video and streaming; where their XP actually came from, source by source; their voice buddies — the members they share voice channels with most, with minutes and XP earned together; their roles, booster status and since when, AFK status and message, when they joined and how old their Discord account is; their current Luck, any bounty on their head, and every active buff and debuff with the time left on each; plus lifetime totals and their favourite items. Use it for "my level", "how much XP do I have", "what is my rank", "where does my XP come from", "who do I play with most", "who are my voice buddies", "what effects are on me", "is there a bounty on me". ${OWN_ONLY}`;

const ITEMS_DESCRIPTION = `Everything the asker owns. Lists every item in their bag by name with how many copies they have, what that item actually does, whether it needs a target, how long it lasts and its shop price — not just a count. Also their wallet XP, how full the bag is out of its capacity, which attacks are on cooldown and for how long, whether they are immune right now, and when insurance is ready again. Use it for "what is in my bag", "what items do I have", "do I have a shield", "how many steals do I own", "am I on cooldown", "can I be robbed right now". ${OWN_ONLY}`;

const ASSETS_DESCRIPTION = `The asker's own investments in the assets market: each holding, what they put in, what it is worth now, profit or loss, and the 24 hour move. Use it for "what am I invested in", "am I up or down", "how are my assets doing". ${OWN_ONLY}`;

const MINIGAMES_DESCRIPTION = `The asker's own minigame record: how many times they played, wins and losses, XP wagered, net XP won or lost, their biggest win, and their last few games. Use it for "how am I doing at gambling", "how much have I lost", "my biggest win". ${OWN_ONLY}`;

const HISTORY_DESCRIPTION = `The asker's own recent activity — buys, uses, attacks they made or took, gifts, trades and XP changes, newest first. Use it for "what happened to me", "who robbed me", "what did I buy", "where did my XP go". Attackers who were disguised stay anonymous. ${OWN_ONLY}`;

const TASKS_DESCRIPTION = `The asker's own tasks, streak and daily check-in — all three live here. Tasks: how many daily and weekly are done, which are finished but not claimed yet, what is still left with the progress and reward on each, and when the day and week reset. Streak: how many days they are on, their longest ever, whether today is already banked, how many freezes they have left, and how far to the next milestone. Daily check-in: which day of the 7 day cycle they are on, whether they can claim right now, and what the next reward is. Use it for "what are my tasks", "what do I have left today", "anything to claim", "what is my streak", "did I lose my streak", "how many freezes do I have", "can I check in", "what do I get tomorrow". ${OWN_ONLY}`;

const HISTORY_ARG = { type: 'string', enum: ['all', 'items', 'level'], description: 'Narrow to item events or XP/level events. Leave out for everything.' };

function chatTool(name, description, properties = {}) {
	return { type: 'function', function: { name, description, parameters: { type: 'object', properties } } };
}

export function buildAccountTools() {
	return [
		chatTool('get_my_overview', OVERVIEW_DESCRIPTION),
		chatTool('get_my_items', ITEMS_DESCRIPTION),
		chatTool('get_my_assets', ASSETS_DESCRIPTION),
		chatTool('get_my_minigames', MINIGAMES_DESCRIPTION),
		chatTool('get_my_history', HISTORY_DESCRIPTION, { history_type: HISTORY_ARG }),
		chatTool('get_my_tasks', TASKS_DESCRIPTION)
	];
}

export function buildAccountDeclarations() {
	const voice = (name, description, properties = {}) => ({
		name,
		description: `${description}\n\n${VOICE_NOTE} In voice this always means the person who is speaking to you.`,
		parameters: { type: Type.OBJECT, properties }
	});

	return [
		voice('get_my_overview', OVERVIEW_DESCRIPTION),
		voice('get_my_items', ITEMS_DESCRIPTION),
		voice('get_my_assets', ASSETS_DESCRIPTION),
		voice('get_my_minigames', MINIGAMES_DESCRIPTION),
		voice('get_my_history', HISTORY_DESCRIPTION, {
			history_type: { type: Type.STRING, enum: ['all', 'items', 'level'], description: 'Narrow to item events or XP events. Leave out for everything.' }
		}),
		voice('get_my_tasks', TASKS_DESCRIPTION)
	];
}

export const ACCOUNT_TOOL_NAMES = new Set(['get_my_overview', 'get_my_items', 'get_my_assets', 'get_my_minigames', 'get_my_history', 'get_my_tasks']);

export function runAccountTool(name, args, { botId, guildId, callerDiscordId }) {
	if (name === 'get_my_overview') return runMyOverviewTool(botId, guildId, callerDiscordId);
	if (name === 'get_my_items') return runMyItemsTool(botId, guildId, callerDiscordId);
	if (name === 'get_my_assets') return runMyAssetsTool(botId, guildId, callerDiscordId);
	if (name === 'get_my_minigames') return runMyMinigamesTool(botId, guildId, callerDiscordId);
	if (name === 'get_my_history') return runMyHistoryTool(botId, guildId, callerDiscordId, args);
	if (name === 'get_my_tasks') return runMyTasksTool(botId, guildId, callerDiscordId);
	return Promise.resolve(fail('unknown_tool'));
}

export default {
	buildAccountTools,
	buildAccountDeclarations,
	runAccountTool,
	ACCOUNT_TOOL_NAMES
};
