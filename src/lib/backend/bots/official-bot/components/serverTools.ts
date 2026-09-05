import { Type } from '@google/genai';
import db from '../../../../database.js';
import { itemAvailability, effectSummary, formatDuration, getItemEffect } from '../../../../items.js';
import { loadItemsCatalog } from '../../../../frontend/public/items/index.js';
import { resolveLeaderboardSnapshot } from '../../../../frontend/public/leaderboard/stream.js';
import { resolvePublicStatisticsSnapshot } from '../../../../frontend/public/statistics/stream.js';
import { getLevelingSettings } from '../../../config.js';
import { parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { VOICE_NOTE, fail, formatMs, memberByDiscordId, memberTzOffset, nameOfMember, num, publicServer, resolveToolFeatures } from './aiToolShared.js';

const MAX_LEADERBOARD_ROWS = 25;
const MAX_MEMBER_MATCHES = 8;
const MAX_SHOP_ITEMS = 40;
const VOICE_LEADERBOARD_ROWS = 5;

const LEADERBOARD_METRICS = [
	'xp',
	'chat',
	'voice_total',
	'voice_active',
	'voice_afk',
	'video',
	'streaming',
	'minigames_gamble_net',
	'minigames_gamble_ratio',
	'minigames_gamble_big',
	'items_bounty_total',
	'items_bounty_claimer',
	'items_bounty_give',
	'items_steal_total',
	'items_steal_rate',
	'items_steal_big',
	'items_bomb_total',
	'items_bomb_rate',
	'items_bomb_big',
	'items_gift_give',
	'items_gift_receive'
];

const LEADERBOARD_PERIODS = ['all', 'month', 'week'];

function shapeItem(item, tzOffsetMin, nowMs) {
	const window = itemAvailability(item, nowMs, tzOffsetMin);
	const effect = getItemEffect(item.effect_type);
	const config = item.config ?? {};
	const durationMinutes = num(config.duration_minutes);

	return {
		name: item.name,
		type: item.effect_type,
		label: effect?.label ?? item.effect_type,
		category: item.category ?? null,
		cost_xp: num(item.cost),
		...(item.original_cost != null ? { original_cost_xp: num(item.original_cost) } : {}),
		what_it_does: effectSummary({ effect_type: item.effect_type, description: item.description, config }),
		usable: item.usable !== false,
		targeted: effect?.targeted === true,
		...(durationMinutes > 0 ? { lasts_minutes: durationMinutes, lasts: formatDuration(durationMinutes) } : {}),
		...(num(config.cooldown_minutes) > 0 ? { cooldown_minutes: num(config.cooldown_minutes) } : {}),
		...(num(config.immunity_minutes) > 0 ? { immunity_minutes: num(config.immunity_minutes) } : {}),
		availability: window.state,
		...(window.state === 'upcoming' && window.startsAt ? { starts_at: new Date(window.startsAt).toISOString() } : {}),
		...(window.availableUntil ? { available_until: new Date(window.availableUntil).toISOString() } : {})
	};
}

export async function runServerStatsTool(botId, guildId) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const snapshot = await resolvePublicStatisticsSnapshot(ctx.server.id).catch(() => null);
	if (!snapshot?.stats) return fail('no_statistics_yet');

	const s = snapshot.stats;
	const rawCreated = ctx.server.discord_created_at;
	const createdAt = rawCreated instanceof Date ? rawCreated : rawCreated ? parseMySQLDateTimeUtc(rawCreated) : null;
	const createdValid = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null;

	return {
		ok: true,
		server_name: ctx.server.name ?? null,
		server: {
			name: ctx.server.name ?? null,
			discord_server_id: ctx.server.discord_server_id ?? null,
			discord_created_at: createdValid ? createdValid.toISOString() : null,
			discord_created_note: createdValid
				? 'This is when the Discord server itself was created, straight from Discord. It is the only correct answer for "when was this server made / founded / how old is it". Never substitute a member join date, an account creation date, or when the bot was added.'
				: 'Discord has not reported a creation date for this server yet. Say that plainly instead of guessing from member join dates or when the bot was added.',
			total_members: num(ctx.server.total_members),
			total_channels: num(ctx.server.total_channels),
			boosters: num(ctx.server.total_boosters),
			boost_level: num(ctx.server.boost_level),
			...(ctx.server.vanity_url_code ? { vanity_url: `discord.gg/${ctx.server.vanity_url_code}` } : {})
		},
		members: {
			total: s.members_total,
			with_levels: s.members_with_levels,
			boosters: s.members_boosters,
			afk: s.member_afk
		},
		channels: { total: s.channels_total, text: s.channels_text, voice: s.channels_voice },
		leveling: {
			total_xp: s.leveling_total_xp,
			average_level: s.leveling_avg_level,
			highest_level: s.leveling_max_level,
			total_messages: s.leveling_total_chat,
			total_voice_minutes: s.leveling_total_voice_minutes
		},
		items: {
			bought: s.items_buys,
			xp_spent: s.items_buy_spend,
			stolen: s.items_stolen,
			bombed: s.items_bombed,
			gifted: s.items_gifted,
			biggest_steal: s.items_biggest_steal
		},
		minigames: { plays: s.minigames_plays, wins: s.minigames_wins, wagered: s.minigames_wagered, biggest_win: s.minigames_biggest_win },
		assets: { traders: s.assets_traders, open_positions: s.assets_open_positions, invested: s.assets_invested, market_value: s.assets_market_value },
		giveaways: { total: s.giveaways_total, active: s.giveaways_active, entrants: s.giveaways_entrants },
		quests: { claimed: s.quests_claimed, participants: s.quests_participants },
		staff: { reviews: s.staff_reviews, average_rating: s.staff_avg_rating }
	};
}

function levelRequirementXp(level, baseXp, multiplier) {
	if (level <= 1) return 0;
	if (multiplier === 1) return baseXp * (level - 1);
	return (baseXp * (Math.pow(multiplier, level - 1) - 1)) / (multiplier - 1);
}

export async function runLevelingRulesTool(botId, guildId, args) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	let settings;
	try {
		settings = await getLevelingSettings(guildId);
	} catch {
		return fail('leveling_not_configured');
	}

	const msgXp = num(settings.MESSAGE.XP);
	const msgCooldown = num(settings.MESSAGE.COOLDOWN_SECONDS);
	const voiceXp = num(settings.VOICE.XP_PER_MINUTE);
	const afkXp = num(settings.VOICE.AFK_XP_PER_MINUTE);
	const videoXp = num(settings.VIDEO.XP_PER_MINUTE);
	const streamXp = num(settings.STREAMING.XP_PER_MINUTE);
	const baseXp = num(settings.REQUIREMENTS.BASE_XP);
	const multiplier = Number(settings.REQUIREMENTS.MULTIPLIER) || 1;

	const minutes = Math.max(0, Math.floor(num(args?.minutes))) || 60;
	const messages = Math.max(0, Math.floor(num(args?.messages))) || 10;

	const levelTable = [];
	for (let lv = 2; lv <= 11; lv++) {
		const total = Math.round(levelRequirementXp(lv, baseXp, multiplier));
		levelTable.push({ level: lv, total_xp_needed: total, from_previous_level: total - Math.round(levelRequirementXp(lv - 1, baseXp, multiplier)) });
	}

	return {
		ok: true,
		server_name: ctx.server.name ?? null,
		chat: {
			xp_per_message: msgXp,
			cooldown_seconds: msgCooldown,
			note: msgCooldown > 0 ? `Only one message every ${msgCooldown}s earns XP. Faster messages earn nothing.` : 'Every message earns XP.'
		},
		voice: {
			xp_per_minute_active: voiceXp,
			xp_per_minute_afk: afkXp,
			xp_per_minute_video: videoXp,
			xp_per_minute_streaming: streamXp,
			note: 'Video and streaming XP stack on top of the voice rate for the same minute. Muted or deafened counts as AFK.'
		},
		bonuses: {
			voice_friend_bonus_percent_each: 10,
			note: 'Each other member in the same voice channel adds 10% to that voice XP, and an active luck buff adds its own percent on top. Both apply to voice only, not chat.'
		},
		levels: {
			base_xp: baseXp,
			multiplier,
			formula: multiplier === 1 ? 'total XP for level N = base_xp * (N - 1)' : 'total XP for level N = base_xp * (multiplier^(N-1) - 1) / (multiplier - 1)',
			first_levels: levelTable
		},
		examples: {
			voice_minutes: minutes,
			voice_xp_active: voiceXp * minutes,
			voice_xp_afk: afkXp * minutes,
			voice_xp_with_video: (voiceXp + videoXp) * minutes,
			voice_xp_with_streaming: (voiceXp + streamXp) * minutes,
			messages_counted: messages,
			chat_xp: msgXp * messages,
			note: `${minutes} minutes of active voice is ${voiceXp * minutes} XP. ${messages} messages past the cooldown is ${msgXp * messages} XP.`
		}
	};
}

function metricValue(metric, r) {
	switch (metric) {
		case 'chat':
			return num(r.chat_total);
		case 'voice_total':
			return num(r.voice_minutes_total);
		case 'voice_active':
			return num(r.voice_minutes_active);
		case 'voice_afk':
			return num(r.voice_minutes_afk);
		case 'video':
			return num(r.voice_minutes_video);
		case 'streaming':
			return num(r.voice_minutes_streaming);
		case 'minigames_gamble_net':
			return num(r.minigame_net);
		case 'minigames_gamble_ratio':
			return num(r.minigame_ratio);
		case 'minigames_gamble_big':
			return num(r.minigame_big_win);
		case 'items_bounty_total':
			return num(r.bounty_on_them);
		case 'items_bounty_claimer':
			return num(r.bounty_collected);
		case 'items_bounty_give':
			return num(r.bounty_given);
		case 'items_steal_total':
		case 'items_bomb_total':
			return num(r.attack_total);
		case 'items_steal_rate':
		case 'items_bomb_rate':
			return num(r.attack_rate);
		case 'items_steal_big':
		case 'items_bomb_big':
			return num(r.attack_big);
		case 'items_gift_give':
			return num(r.gift_given);
		case 'items_gift_receive':
			return num(r.gift_received);
		default:
			return num(r.xp);
	}
}

function metricDetail(metric, r) {
	if (metric.startsWith('minigames_')) {
		const total = num(r.minigame_total);
		const wins = num(r.minigame_wins);
		return {
			net_xp: num(r.minigame_net),
			plays: total,
			wins,
			losses: Math.max(0, total - wins),
			win_rate_percent: num(r.minigame_ratio),
			biggest_win: num(r.minigame_big_win)
		};
	}
	if (metric.startsWith('items_steal') || metric.startsWith('items_bomb')) {
		return {
			xp_total: num(r.attack_total),
			attempts: num(r.attack_attempts),
			successes: num(r.attack_success),
			success_rate_percent: num(r.attack_rate),
			biggest_hit: num(r.attack_big)
		};
	}
	if (metric.startsWith('items_bounty')) {
		return { bounty_on_them: num(r.bounty_on_them), bounty_collected: num(r.bounty_collected), bounty_given: num(r.bounty_given) };
	}
	if (metric.startsWith('items_gift')) return { gift_given: num(r.gift_given), gift_received: num(r.gift_received) };
	return { xp: num(r.xp), messages: num(r.chat_total), voice_minutes: num(r.voice_minutes_total) };
}

export async function runLeaderboardTool(botId, guildId, args, { maxRows = MAX_LEADERBOARD_ROWS } = {}) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const metric = LEADERBOARD_METRICS.includes(args?.metric) ? args.metric : 'xp';
	const period = LEADERBOARD_PERIODS.includes(args?.period) ? args.period : 'all';
	const limit = Math.max(1, Math.min(num(args?.limit) || 10, maxRows));
	const worst = args?.order === 'worst';

	const snapshot = await resolveLeaderboardSnapshot(ctx.server.id, metric, period, 100).catch(() => null);
	const rows = snapshot?.rows ?? [];
	if (!rows.length) return fail('leaderboard_empty', { metric, period });

	const disguised = new Set((await db.getDisguisedMemberIds(ctx.server.id).catch(() => [])).map((n) => String(n)));
	const members = await db.getServerMembersList(ctx.server.id).catch(() => []);
	const disguisedDiscordIds = new Set(members.filter((m) => disguised.has(String(m.id))).map((m) => String(m.discord_member_id)));

	const visible = rows.filter((r) => !disguisedDiscordIds.has(String(r.discord_member_id)));
	const picked = worst ? visible.slice(-limit).reverse() : visible.slice(0, limit);

	return {
		ok: true,
		metric,
		period,
		order: worst ? 'worst' : 'best',
		ranked_members: visible.length,
		note: worst
			? 'These are the bottom places on this metric, worst first. A negative value means they are down overall.'
			: 'These are the top places on this metric. Ask with order "worst" for the biggest losers.',
		rows: picked.map((r) => ({
			rank: r.rank,
			name: r.server_display_name || r.display_name || r.username || 'a member',
			level: r.level,
			value: metricValue(metric, r),
			...metricDetail(metric, r)
		}))
	};
}

export async function runMemberInfoTool(botId, guildId, args) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const query = String(args?.name ?? '')
		.trim()
		.toLowerCase();
	if (!query) return fail('missing_name');

	const disguised = new Set((await db.getDisguisedMemberIds(ctx.server.id).catch(() => [])).map((n) => Number(n)));
	const members = (await db.getServerMembersList(ctx.server.id).catch(() => [])).filter((m) => !disguised.has(Number(m.id)));

	const mentionId = String(args?.name ?? '').match(/(\d{17,20})/)?.[1] ?? null;
	const byId = mentionId ? members.filter((m) => String(m.discord_member_id) === mentionId) : [];

	const matches = byId.length
		? byId
		: members.filter((m) => [m.server_display_name, m.display_name, m.username].filter(Boolean).some((n) => String(n).toLowerCase().includes(query)));

	if (!matches.length) return fail('member_not_found', { searched: args.name });

	if (matches.length > 1) {
		return {
			ok: true,
			multiple_matches: true,
			matches: matches.slice(0, MAX_MEMBER_MATCHES).map((m) => ({ name: nameOfMember(m), level: num(m.level), rank: m.rank != null ? num(m.rank) : null })),
			next_step: 'Ask the user which of these members they meant, then call this again with the exact name.'
		};
	}

	const m = matches[0];
	const rating = await db.getStaffRatingAggregate(ctx.server.id, m.id).catch(() => null);
	const reviews = Number(rating?.total_reports) || 0;

	const toDate = (raw) => {
		if (!raw) return null;
		const d = raw instanceof Date ? raw : parseMySQLDateTimeUtc(raw);
		return d && !Number.isNaN(d.getTime()) ? d : null;
	};

	return {
		ok: true,
		...publicMemberShape(m, toDate),
		...(reviews > 0 ? { staff_rating: Number(rating.average_rating) || 0, staff_reviews: reviews } : {}),
		note: "These are public profile fields. joined_server is when they joined this server; account_created is how old their Discord account is. This member's bag, assets, minigames, history and tasks are private and must not be requested."
	};
}

function publicMemberShape(m, toDate) {
	const afkSince = toDate(m.afk_since);
	return {
		name: nameOfMember(m),
		username: m.username ?? null,
		level: num(m.level),
		xp: num(m.xp),
		rank: m.rank != null ? num(m.rank) : null,
		messages: num(m.chat_total),
		voice_minutes_total: num(m.voice_minutes_total),
		voice_minutes_active: num(m.voice_minutes_active),
		voice_minutes_afk: num(m.voice_minutes_afk),
		voice_minutes_video: num(m.voice_minutes_video),
		voice_minutes_streaming: num(m.voice_minutes_streaming),
		joined_server: toDate(m.member_since)?.toISOString() ?? null,
		account_created: toDate(m.profile_created_at)?.toISOString() ?? null,
		is_booster: !!m.is_booster,
		boosting_since: toDate(m.booster_since)?.toISOString() ?? null,
		roles: (m.roles ?? []).map((r) => r.name),
		...(m.afk_message ? { afk: true, afk_message: m.afk_message, afk_since: afkSince ? afkSince.toISOString() : null } : {})
	};
}

const ROSTER_SORTS = ['joined_oldest', 'joined_newest', 'account_oldest', 'account_newest'];

export async function runMemberRosterTool(botId, guildId, args) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const sort = ROSTER_SORTS.includes(args?.sort) ? args.sort : 'joined_oldest';
	const limit = Math.max(1, Math.min(num(args?.limit) || 5, MAX_MEMBER_MATCHES));

	const disguised = new Set((await db.getDisguisedMemberIds(ctx.server.id).catch(() => [])).map((n) => Number(n)));
	const members = (await db.getServerMembersList(ctx.server.id).catch(() => [])).filter((m) => !disguised.has(Number(m.id)));

	const byAccount = sort.startsWith('account');
	const toDate = (raw) => {
		if (!raw) return null;
		const d = raw instanceof Date ? raw : parseMySQLDateTimeUtc(raw);
		return d && !Number.isNaN(d.getTime()) ? d : null;
	};

	const dated = members.map((m) => ({ m, at: toDate(byAccount ? m.profile_created_at : m.member_since) })).filter((e) => e.at);
	if (!dated.length) return fail('no_dates_synced', { sort });

	const newest = sort.endsWith('newest');
	dated.sort((a, b) => (newest ? b.at.getTime() - a.at.getTime() : a.at.getTime() - b.at.getTime()));

	return {
		ok: true,
		sort,
		total_members: members.length,
		members_with_date: dated.length,
		note: byAccount
			? 'Sorted by when each Discord account itself was created. This is not when they joined this server.'
			: 'Sorted by when each member joined THIS server. The first entry is the longest-standing member — do not confuse it with the server creation date or with account age.',
		rows: dated.slice(0, limit).map((e, i) => ({ position: i + 1, ...publicMemberShape(e.m, toDate) }))
	};
}

export async function runStaffRatingTool(botId, guildId) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const ratings = await db.getAllStaffRatings(ctx.server.id).catch(() => []);
	if (!ratings.length) return fail('no_staff_ratings');

	const members = await db.getServerMembersList(ctx.server.id).catch(() => []);
	const byId = new Map(members.map((m) => [Number(m.id), m]));

	return {
		ok: true,
		staff: ratings.map((r) => ({
			name: nameOfMember(byId.get(Number(r.member_id))),
			rating: Number(r.current_rating) || 0,
			reviews: Number(r.total_reports) || 0
		}))
	};
}

export async function runGiveawaysTool(botId, guildId) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const giveaways = await db.listActiveGiveawaysForServer(ctx.server.id).catch(() => []);
	if (!giveaways.length) return fail('no_active_giveaways');

	const withEntrants = await Promise.all(
		giveaways.map(async (g) => ({
			title: g.title,
			prize: g.prize,
			winners: g.winner_count,
			multiple_entries_allowed: g.multiple_entries_allowed,
			role_locked: Array.isArray(g.allowed_roles) && g.allowed_roles.length > 0,
			entrants: await db.countGiveawayEntrants(g.id).catch(() => 0),
			ends_at: g.ends_at,
			ends_in: g.ends_at_ms ? formatMs(g.ends_at_ms - Date.now()) : null
		}))
	);

	return { ok: true, giveaways: withEntrants };
}

export async function runQuestsTool(botId, guildId) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const quests = await db.listActiveBotDiscordQuests(botId).catch(() => []);
	if (!quests.length) return fail('no_active_quests');

	const now = Date.now();
	return {
		ok: true,
		quests: quests.map((q) => {
			const expires = q.expiresAt ? Date.parse(q.expiresAt) : NaN;
			return {
				name: q.questName,
				game: q.gameTitle,
				reward: q.reward,
				task: q.questDescription || q.taskTypeLabel || null,
				url: q.questUrl,
				expires_at: q.expiresAt || null,
				...(Number.isFinite(expires) && expires > now ? { ends_in: formatMs(expires - now) } : {})
			};
		})
	};
}

export async function runShopTool(botId, guildId, args) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;
	if (!ctx.itemsEnabled) return fail('items_not_enabled_for_this_server');

	const catalog = await loadItemsCatalog(ctx.server.id).catch(() => []);
	const live = catalog.filter((i) => i.live);
	if (!live.length) return fail('shop_is_empty');

	const member = args?.viewerDiscordId ? await memberByDiscordId(ctx.server.id, args.viewerDiscordId) : null;
	const tzOffsetMin = member ? await memberTzOffset(member.id) : 0;
	const nowMs = Date.now();

	const shaped = live.map((i) => shapeItem(i, tzOffsetMin, nowMs));
	const wanted = String(args?.availability ?? 'all');
	const filtered =
		wanted === 'upcoming'
			? shaped.filter((i) => i.availability === 'upcoming')
			: wanted === 'active'
				? shaped.filter((i) => i.availability !== 'upcoming')
				: shaped;

	const typeFilter = String(args?.type ?? '')
		.trim()
		.toLowerCase();
	const byType = typeFilter ? filtered.filter((i) => i.type === typeFilter || i.label.toLowerCase() === typeFilter) : filtered;

	if (!byType.length) return fail('no_items_match', { availability: wanted, type: typeFilter || null });

	return {
		ok: true,
		currency: 'XP',
		item_count: byType.length,
		items: byType.slice(0, MAX_SHOP_ITEMS),
		note: "Prices already include any active Luck discount for this member. Times are shown for the member's own clock."
	};
}

const STATS_DESCRIPTION =
	'Everything about this Discord server itself plus its public statistics: when the server was created, its member and channel counts, boost level and booster count, vanity invite, and totals for XP, messages, voice minutes, items, minigames, assets, giveaways, quests and staff reviews. Use this for any "how many", "how big", "how active is this server" question and for "when was this server created / made / founded / how old is it" — answer that only from server.discord_created_at, which comes straight from Discord, and never infer it from a member join date, an account creation date or the oldest member. This is server-wide data, not about one person.';

const LEADERBOARD_DESCRIPTION =
	'The public leaderboard for this server. Use it for "who is number one", "top players", "who has the most XP / messages / voice time", "who steals the most", "biggest gambler", or where a ranking stands. Pick the metric that matches what they asked and leave it out for XP. Every ranked member is covered, including negative and zero scores, so losses are tracked too: for "who lost the most", "biggest loser", "who is down the most XP", "worst at gambling" pass order "worst" with the matching metric — do not say losses are untracked. Each row returns the metric value plus its detail, so for gambling you get net XP, plays, wins, losses, win rate and biggest win. Members who are disguised never appear.';

const MEMBER_DESCRIPTION =
	"Look up ONE named member's PUBLIC profile in this server: their level, XP, rank, messages, voice minutes, roles, join date and staff rating. Use it when someone asks about another member by name or mention. It only returns public profile fields — a member's bag, assets, minigames, history and tasks are private, so never use this to try to read those.";

const STAFF_DESCRIPTION =
	'The public staff rating board for this server — which staff members have a rating and how many reviews each has. Use it when someone asks about staff ratings, who the best rated staff is, or how a staff member is rated.';

const GIVEAWAYS_DESCRIPTION =
	'Giveaways running in this server right now, with the prize, how many winners, how many people entered and how long is left. Use it for "any giveaways", "what can I win", "how long left on the giveaway". It only lists active ones — say plainly when none are running.';

const QUESTS_DESCRIPTION =
	'Discord Quests currently available through this bot, with the game, the reward, what you have to do and when it expires. Use it for "any quests", "what quests can I do", "what do I get". It only lists active ones.';

const SHOP_DESCRIPTION =
	'The XP item shop for this server. Returns each item with its price in XP, what it actually does, whether it is usable, whether it needs a target, how many minutes it lasts, its cooldown and immunity minutes, and whether it is on sale now or coming later. Use it for "what is in the shop", "how much does X cost", "what does X do", "what is coming soon", "how long does X last". Prices already include the asker\'s Luck discount.';

const LEVELING_RULES_DESCRIPTION =
	'How XP and levels actually work on this server: XP per message and its cooldown, XP per minute for voice, AFK voice, video and streaming, the friend and luck bonuses, the level-up formula with the XP needed for the first levels, and worked examples. Use it for "how much XP do I get for an hour in voice", "how do I level up fastest", "how much XP per message", "how much XP to reach level 10", "does streaming give more XP". Pass minutes or messages to have the example done for that exact amount. These are this server\'s own settings, not general advice.';

const ROSTER_DESCRIPTION =
	'Members of this server with their full public profile — level, XP, rank, messages, voice/video/streaming minutes, when they joined this server, how old their Discord account is, booster status and since when, their roles, and their AFK status. Order it with sort: "joined_oldest" for "who joined first", "oldest member", "member paling lama / paling sepuh", the founder or longest-standing member; "joined_newest" for the newest members; "account_oldest" or "account_newest" for how old the Discord accounts themselves are. Every answer about who joined when must come from this tool — never guess it from a leaderboard, an XP total or a rank, and never confuse joining this server with when the account was made or when the server was created.';

const ALWAYS_ON = new Set(['get_server_stats', 'get_leaderboard', 'get_member_info', 'get_leveling_rules', 'get_member_roster']);

function allowedServerTool(name, features) {
	if (!features) return true;
	if (!features.publicData) return false;
	if (ALWAYS_ON.has(name)) return true;
	if (name === 'get_shop') return features.items === true;
	if (name === 'get_giveaways') return features.giveaway === true;
	if (name === 'get_quests') return features.quests === true;
	if (name === 'get_staff_ratings') return features.staffRating === true;
	return true;
}

export function buildServerTools(features = null) {
	return [
		{
			type: 'function',
			function: {
				name: 'get_server_stats',
				description: STATS_DESCRIPTION,
				parameters: { type: 'object', properties: {} }
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_leaderboard',
				description: LEADERBOARD_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: {
						metric: { type: 'string', enum: LEADERBOARD_METRICS, description: 'Which ranking to read. Leave out for overall XP.' },
						period: { type: 'string', enum: LEADERBOARD_PERIODS, description: 'Time range. Leave out for all time.' },
						order: {
							type: 'string',
							enum: ['best', 'worst'],
							description: 'Use "worst" for the bottom of the table — biggest losers, most XP lost, worst win rate. Leave out for the top.'
						},
						limit: { type: 'integer', description: `How many places to read, 1 to ${MAX_LEADERBOARD_ROWS}. Leave out for 10.` }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_member_info',
				description: MEMBER_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: { name: { type: 'string', description: "The member's name or their <@id> mention, exactly as the user wrote it." } },
					required: ['name']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_member_roster',
				description: ROSTER_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: {
						sort: { type: 'string', enum: ROSTER_SORTS, description: 'Which order to read. Leave out for the members who joined this server earliest.' },
						limit: { type: 'integer', description: `How many members to read, 1 to ${MAX_MEMBER_MATCHES}. Leave out for 5.` }
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'get_leveling_rules',
				description: LEVELING_RULES_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: {
						minutes: { type: 'integer', description: 'Voice minutes to work the example for, e.g. 60 for one hour. Leave out for 60.' },
						messages: { type: 'integer', description: 'Number of messages to work the chat example for. Leave out for 10.' }
					}
				}
			}
		},
		{
			type: 'function',
			function: { name: 'get_staff_ratings', description: STAFF_DESCRIPTION, parameters: { type: 'object', properties: {} } }
		},
		{
			type: 'function',
			function: { name: 'get_giveaways', description: GIVEAWAYS_DESCRIPTION, parameters: { type: 'object', properties: {} } }
		},
		{
			type: 'function',
			function: { name: 'get_quests', description: QUESTS_DESCRIPTION, parameters: { type: 'object', properties: {} } }
		},
		{
			type: 'function',
			function: {
				name: 'get_shop',
				description: SHOP_DESCRIPTION,
				parameters: {
					type: 'object',
					properties: {
						availability: {
							type: 'string',
							enum: ['all', 'active', 'upcoming'],
							description: 'Use "upcoming" only when they ask what is coming soon. Leave out for everything.'
						},
						type: { type: 'string', description: 'Filter to one item type such as steal, shield or luck. Leave out to list all.' }
					}
				}
			}
		}
	].filter((t) => allowedServerTool(t.function.name, features));
}

export function buildServerDeclarations(features = null) {
	return [
		{ name: 'get_server_stats', description: `${STATS_DESCRIPTION}\n\n${VOICE_NOTE}`, parameters: { type: Type.OBJECT, properties: {} } },
		{
			name: 'get_leaderboard',
			description: `${LEADERBOARD_DESCRIPTION}\n\n${VOICE_NOTE} Read out the top few by name and place, never the whole table.`,
			parameters: {
				type: Type.OBJECT,
				properties: {
					metric: { type: Type.STRING, enum: LEADERBOARD_METRICS, description: 'Which ranking to read. Leave out for overall XP.' },
					period: { type: Type.STRING, enum: LEADERBOARD_PERIODS, description: 'Time range. Leave out for all time.' },
					order: { type: Type.STRING, enum: ['best', 'worst'], description: 'Use "worst" for the biggest losers at the bottom of the table.' }
				}
			}
		},
		{
			name: 'get_member_info',
			description: `${MEMBER_DESCRIPTION}\n\n${VOICE_NOTE}`,
			parameters: {
				type: Type.OBJECT,
				properties: { name: { type: Type.STRING, description: "The member's name as it was said out loud." } },
				required: ['name']
			}
		},
		{
			name: 'get_member_roster',
			description: `${ROSTER_DESCRIPTION}\n\n${VOICE_NOTE} Name just the first one or two, with the date.`,
			parameters: {
				type: Type.OBJECT,
				properties: {
					sort: { type: Type.STRING, enum: ROSTER_SORTS, description: 'Which order to read. Leave out for who joined this server earliest.' }
				}
			}
		},
		{
			name: 'get_leveling_rules',
			description: `${LEVELING_RULES_DESCRIPTION}\n\n${VOICE_NOTE} Give the rate and the worked example, not the whole level table.`,
			parameters: {
				type: Type.OBJECT,
				properties: {
					minutes: { type: Type.INTEGER, description: 'Voice minutes to work the example for, e.g. 60 for one hour.' },
					messages: { type: Type.INTEGER, description: 'Number of messages to work the chat example for.' }
				}
			}
		},
		{ name: 'get_staff_ratings', description: `${STAFF_DESCRIPTION}\n\n${VOICE_NOTE}`, parameters: { type: Type.OBJECT, properties: {} } },
		{ name: 'get_giveaways', description: `${GIVEAWAYS_DESCRIPTION}\n\n${VOICE_NOTE}`, parameters: { type: Type.OBJECT, properties: {} } },
		{ name: 'get_quests', description: `${QUESTS_DESCRIPTION}\n\n${VOICE_NOTE}`, parameters: { type: Type.OBJECT, properties: {} } },
		{
			name: 'get_shop',
			description: `${SHOP_DESCRIPTION}\n\n${VOICE_NOTE} Say the price and what it does for the items they asked about, not the whole shop.`,
			parameters: {
				type: Type.OBJECT,
				properties: {
					availability: { type: Type.STRING, enum: ['all', 'active', 'upcoming'], description: 'Use "upcoming" only for what is coming soon.' },
					type: { type: Type.STRING, description: 'Filter to one item type such as steal, shield or luck.' }
				}
			}
		}
	].filter((d) => allowedServerTool(d.name, features));
}

export const SERVER_TOOL_NAMES = new Set([
	'get_server_stats',
	'get_leaderboard',
	'get_member_info',
	'get_leveling_rules',
	'get_member_roster',
	'get_staff_ratings',
	'get_giveaways',
	'get_quests',
	'get_shop'
]);

export function runServerTool(name, args, { botId, guildId, callerDiscordId, voice = false }) {
	const opts = voice ? { maxRows: VOICE_LEADERBOARD_ROWS } : {};

	if (name === 'get_server_stats') return runServerStatsTool(botId, guildId);
	if (name === 'get_leaderboard') return runLeaderboardTool(botId, guildId, args, opts);
	if (name === 'get_member_info') return runMemberInfoTool(botId, guildId, args);
	if (name === 'get_leveling_rules') return runLevelingRulesTool(botId, guildId, args);
	if (name === 'get_member_roster') return runMemberRosterTool(botId, guildId, args);
	if (name === 'get_staff_ratings') return runStaffRatingTool(botId, guildId);
	if (name === 'get_giveaways') return runGiveawaysTool(botId, guildId);
	if (name === 'get_quests') return runQuestsTool(botId, guildId);
	if (name === 'get_shop') return runShopTool(botId, guildId, { ...args, viewerDiscordId: callerDiscordId });
	return Promise.resolve(fail('unknown_tool'));
}

export default {
	buildServerTools,
	buildServerDeclarations,
	runServerTool,
	SERVER_TOOL_NAMES
};
