import { Type } from '@google/genai';
import db from '../../../../database.js';
import { itemAvailability, effectSummary, formatDuration, getItemEffect } from '../../../../items.js';
import { loadItemsCatalog } from '../../../../frontend/public/items/index.js';
import { resolveLeaderboardSnapshot } from '../../../../frontend/public/leaderboard/stream.js';
import { resolvePublicStatisticsSnapshot } from '../../../../frontend/public/statistics/stream.js';
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
	return {
		ok: true,
		server_name: ctx.server.name ?? null,
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
		quests: { enrolled: s.quests_enrolled, claimed: s.quests_claimed, participants: s.quests_participants },
		staff: { reviews: s.staff_reviews, average_rating: s.staff_avg_rating }
	};
}

export async function runLeaderboardTool(botId, guildId, args, { maxRows = MAX_LEADERBOARD_ROWS } = {}) {
	const ctx = await publicServer(botId, guildId);
	if (ctx.error) return ctx.error;

	const metric = LEADERBOARD_METRICS.includes(args?.metric) ? args.metric : 'xp';
	const period = LEADERBOARD_PERIODS.includes(args?.period) ? args.period : 'all';
	const limit = Math.max(1, Math.min(num(args?.limit) || 10, maxRows));

	const snapshot = await resolveLeaderboardSnapshot(ctx.server.id, metric, period, Math.max(limit, 10)).catch(() => null);
	const rows = snapshot?.rows ?? [];
	if (!rows.length) return fail('leaderboard_empty', { metric, period });

	const disguised = new Set((await db.getDisguisedMemberIds(ctx.server.id).catch(() => [])).map((n) => String(n)));
	const members = await db.getServerMembersList(ctx.server.id).catch(() => []);
	const disguisedDiscordIds = new Set(members.filter((m) => disguised.has(String(m.id))).map((m) => String(m.discord_member_id)));

	return {
		ok: true,
		metric,
		period,
		rows: rows
			.filter((r) => !disguisedDiscordIds.has(String(r.discord_member_id)))
			.slice(0, limit)
			.map((r) => ({
				rank: r.rank,
				name: r.server_display_name || r.display_name || r.username || 'a member',
				level: r.level,
				xp: r.xp,
				messages: r.chat_total,
				voice_minutes: r.voice_minutes_total
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

	return {
		ok: true,
		name: nameOfMember(m),
		level: num(m.level),
		xp: num(m.xp),
		rank: m.rank != null ? num(m.rank) : null,
		messages: num(m.chat_total),
		voice_minutes_active: num(m.voice_minutes_active),
		is_booster: !!m.is_booster,
		member_since: m.member_since ? new Date(m.member_since).toISOString() : null,
		roles: (m.roles ?? []).map((r) => r.name),
		...(reviews > 0 ? { staff_rating: Number(rating.average_rating) || 0, staff_reviews: reviews } : {}),
		note: "These are public profile fields. This member's bag, assets, minigames, history and tasks are private and must not be requested."
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
	'Public statistics for this Discord server: how many members, total XP, messages, voice minutes, and totals for items, minigames, assets, giveaways, quests and staff reviews. Use this for any "how many", "how big", "server total" or "how active is this server" question. This is server-wide data, not about one person.';

const LEADERBOARD_DESCRIPTION =
	'The public leaderboard for this server. Use it for "who is number one", "top players", "who has the most XP / messages / voice time", "who steals the most", "biggest gambler", or where a ranking stands. Pick the metric that matches what they asked and leave it out for XP. Members who are disguised never appear.';

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

const ALWAYS_ON = new Set(['get_server_stats', 'get_leaderboard', 'get_member_info']);

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
					period: { type: Type.STRING, enum: LEADERBOARD_PERIODS, description: 'Time range. Leave out for all time.' }
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
