import {
	getLevelingSettings,
	getBotConfig,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	serverSettingsComponent,
	computePublicServerSlugForServerId,
	publicServerUrl,
	PERMISSIONS
} from '../../../config.js';
import { INVITE_STAFF_MULTIPLIER } from '../../../../invites.js';
import db from '../../../../database.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { attempt, logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { applyAwardEffects, creditLeechers, getActiveLuckPercent } from './items.js';
import { serverTranslator, type Translator } from '../i18n.js';
import { checkRewardProgress, syncGuildRewards, syncMemberRewards } from './rewards.js';
import type {
	Client,
	Guild,
	Message,
	MessageReaction,
	PartialMessageReaction,
	PartialUser,
	User,
	VoiceState,
	GuildMember,
	GuildTextBasedChannel
} from 'discord.js';
import type { ServerMemberRow, ServerRow } from '../../../../schema.js';
import { sendWithNotifiedMentions } from './notifiedMentions.js';
import { MINUTE_MS, SECOND_MS } from '../../../../utils/time.js';
import { PERCENT } from '../../../../utils/numbers.js';

const BRONZE_RANK = 3;
const PROGRESS_BAR_SEGMENTS = 10;
const VOICE_FRIEND_BONUS_PERCENT = 10;
const MIN_VOICE_TICK_MS = SECOND_MS;
const MAX_VOICE_TICK_SECONDS = 5;
const MAX_VOICE_TICK_MS = MAX_VOICE_TICK_SECONDS * SECOND_MS;
const RECALCULATE_DELAY_SECONDS = 5;

type MemberLevel = NonNullable<Awaited<ReturnType<typeof db.getMemberLevel>>>;
type MemberLike = { id: string; user?: User | null; bot?: boolean };
type LevelContext = {
	previousLevel?: number | null;
	previousXp?: number | null;
	previousRank?: number | null;
	reason?: string;
	sourceChannelId?: string | null;
};
type VoiceBuckets = { isAFK: boolean; voiceMinutes: number; videoMinutes: number; streamMinutes: number };
type MediaFlags = { selfVideo: boolean; streaming: boolean };
type VoiceSession = {
	serverId: number;
	serverName: ServerRow['name'];
	memberId: number;
	discordMemberId: string;
	guildId: string;
	interval: ReturnType<typeof setInterval>;
	lastRewardedAt: number;
	joinedAt: number;
	channelId: string | null;
};
type ProgressNotification = {
	guildId?: string;
	discordMemberId?: string;
	serverName?: ServerRow['name'];
	newLevel?: number | null;
	previousRank?: number | null;
	eventType?: 'level' | 'rank';
	memberLevelSnapshot?: { rank?: unknown; level?: unknown } | null;
	contextLabel?: string;
	fallbackChannelId?: string | null;
	rewardRoleIds?: string[];
};

const recentMessages = new Map();

async function claimMessageCooldown(cooldownKey: string, cooldownMs: number) {
	if (cooldownMs <= 0) {
		return true;
	}

	const redis = await getRedisClient().catch(() => null);
	if (redis) {
		try {
			const res = await redis.set(`lvl:msgcd:${cooldownKey}`, '1', { NX: true, PX: cooldownMs });
			return res === 'OK';
		} catch (error) {
			await logger.log(`⚠️ Leveling cooldown Redis error, falling back to memory: ${(error as Error).message}`);
		}
	}

	const now = Date.now();
	const lastMessageAt = recentMessages.get(cooldownKey);
	if (lastMessageAt && now - lastMessageAt < cooldownMs) {
		return false;
	}
	recentMessages.set(cooldownKey, now);
	return true;
}
const voiceSessions = new Map<string, VoiceSession>();
const voiceAwardLocks = new Set<string>();
let clientInstance: Client | null = null;

export async function getLevelRequirement(level: number, guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for level requirement calculation');
	}
	if (level <= 1) {
		return 0;
	}

	const settings = await getLevelingSettings(guildId);
	const baseXP = settings.REQUIREMENTS.BASE_XP;
	const multiplier = settings.REQUIREMENTS.MULTIPLIER;

	if (multiplier === 1) {
		return baseXP * (level - 1);
	}
	return (baseXP * (multiplier ** (level - 1) - 1)) / (multiplier - 1);
}

async function getXpForMessage(guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for message XP');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.MESSAGE.XP;
}

function isVoiceStateAFK(voiceState: VoiceState | null) {
	return !!(voiceState?.selfMute || voiceState?.selfDeaf || voiceState?.serverMute || voiceState?.serverDeaf || voiceState?.mute || voiceState?.deaf);
}

async function hasAFKRecord(serverId: string | number, discordMemberId: string) {
	if (!serverId || !discordMemberId) {
		return false;
	}
	try {
		return !!(await db.getAFKStatus(serverId, discordMemberId));
	} catch {
		return false;
	}
}

async function resolveVoiceAFK(serverId: number, discordMemberId: string, voiceState: VoiceState | null) {
	if (isVoiceStateAFK(voiceState)) {
		return true;
	}
	return await hasAFKRecord(serverId, discordMemberId);
}

function resolveGuildVoiceState(guild: Guild | undefined, discordUserId: string) {
	if (!guild || !discordUserId) {
		return null;
	}
	const fromVs = guild.voiceStates?.cache?.get(discordUserId);
	if (fromVs) {
		return fromVs;
	}
	return guild.members.cache.get(discordUserId)?.voice ?? null;
}

function parseLevelRewardedAtMs(value: unknown) {
	if (value == null) {
		return null;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	const parsed = parseMySQLDateTimeUtc(value);
	return parsed ? parsed.getTime() : null;
}

async function getXpForVoiceMinutes(minutes: number, isAFK: boolean, guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for voice XP');
	}
	if (!minutes || minutes <= 0) {
		return 0;
	}

	const settings = await getLevelingSettings(guildId);
	const afkXPPerMin = Math.max(0, Number(settings.VOICE.AFK_XP_PER_MINUTE) || 0);
	const voiceXPPerMin = Math.max(0, Number(settings.VOICE.XP_PER_MINUTE) || 0);

	if (isAFK) {
		return afkXPPerMin * minutes;
	}
	return voiceXPPerMin * minutes;
}

async function getVideoXpForVoiceTick(minutes: number, guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for video voice XP');
	}
	if (!minutes || minutes <= 0) {
		return 0;
	}
	const settings = await getLevelingSettings(guildId);
	return Math.max(0, Number(settings.VIDEO.XP_PER_MINUTE) || 0) * minutes;
}

async function getStreamingXpForVoiceTick(minutes: number, guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for streaming voice XP');
	}
	if (!minutes || minutes <= 0) {
		return 0;
	}
	const settings = await getLevelingSettings(guildId);
	return Math.max(0, Number(settings.STREAMING.XP_PER_MINUTE) || 0) * minutes;
}

async function getMessageCooldownMs(guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for message cooldown');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.MESSAGE.COOLDOWN_SECONDS * SECOND_MS;
}

async function getVoiceCooldownMs(guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for voice cooldown');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.VOICE.COOLDOWN_SECONDS * SECOND_MS;
}

export async function determineLevel(xp: number, guildId: string) {
	if (!guildId) {
		throw new Error('guildId is required for level determination');
	}
	if (xp <= 0) {
		return 1;
	}

	let level = 1;
	while (xp >= (await getLevelRequirement(level + 1, guildId))) {
		level += 1;
	}
	return level;
}

async function resolveServerAndMember(guild: Guild | null, memberLike: MemberLike | null) {
	if (!guild) {
		return { server: null, dbMember: null, guildMember: null };
	}

	try {
		const server = await getServerForCurrentBot(guild.id).catch(() => null);
		if (!server) {
			return { server: null, dbMember: null, guildMember: null };
		}

		let guildMember = memberLike;
		const candidateIds = new Set<string>();

		if (guildMember?.id) {
			candidateIds.add(guildMember.id);
		}
		if (guildMember?.user?.id) {
			candidateIds.add(guildMember.user.id);
		}

		if (!guildMember || typeof guildMember.user === 'undefined') {
			for (const candidateId of candidateIds) {
				try {
					guildMember = await guild.members.fetch({ user: candidateId, cache: true });
					break;
				} catch (_) {
					guildMember = null;
				}
			}
		}

		if (!guildMember) {
			for (const candidateId of candidateIds) {
				try {
					guildMember = await guild.members.fetch(candidateId);
					break;
				} catch (_) {
					guildMember = null;
				}
			}
		}

		if (!guildMember) {
			return { server, dbMember: null, guildMember: null };
		}

		const dbMember = await db.upsertMember(server.id, guildMember);

		return { server, dbMember, guildMember };
	} catch (error) {
		const msg = error instanceof Error ? (error as Error).message : String(error);
		await logger.log(`❌ Leveling resolve failure for guild ${guild?.id}: ${msg}`);
		return { server: null, dbMember: null, guildMember: null };
	}
}

async function isMemberEligible(guildId: string, guildMember: MemberLike | null) {
	if (!guildId || !guildMember) {
		return false;
	}

	return !(guildMember.user?.bot ?? guildMember.bot ?? false);
}

async function countVoiceFriends(guildId: string, discordMemberId: string) {
	const guild = clientInstance?.guilds.cache.get(guildId);
	if (!guild) {
		return { count: 0, discordIds: [] };
	}

	const self = resolveGuildVoiceState(guild, discordMemberId);
	const channelId = self?.channelId;
	if (!channelId) {
		return { count: 0, discordIds: [] };
	}

	const discordIds: string[] = [];
	for (const [, vs] of guild.voiceStates.cache) {
		if (vs.channelId !== channelId) {
			continue;
		}
		if (vs.id === discordMemberId) {
			continue;
		}
		const otherMember = vs.member ?? guild.members.cache.get(vs.id);
		if (!otherMember || otherMember.user?.bot) {
			continue;
		}
		discordIds.push(vs.id);
	}
	return { count: discordIds.length, discordIds };
}

function normalizeRankValue(value: unknown) {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === 'bigint') {
		const n = Number(value);
		return Number.isFinite(n) && n > 0 ? n : null;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) && value > 0 ? value : null;
	}
	const parsed = parseInt(value as string, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function normalizeLevelValue(value: unknown, fallback = 1) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (value === null || value === undefined) {
		return fallback;
	}
	const parsed = parseInt(value as string, 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}
	return parsed;
}

function getRankMedal(rank: number | null) {
	if (rank === 1) {
		return '🥇';
	}
	if (rank === 2) {
		return '🥈';
	}
	if (rank === BRONZE_RANK) {
		return '🥉';
	}
	return null;
}

type ProgressField = { name: string; value: string; inline: boolean };
type ProgressCard = {
	member: GuildMember;
	eventType: 'level' | 'rank';
	totalXp: number;
	shownLevel: number;
	currentRank: number | null;
	previousRank: number | null;
	rewardRoleIds: string[];
	progressField: ProgressField | null;
};

export async function levelProgressField(
	xp: number,
	{ level, guildId, tr }: { level: number; guildId: string; tr: Translator }
): Promise<ProgressField | null> {
	try {
		const floorXp = await getLevelRequirement(level, guildId);
		const nextXp = await getLevelRequirement(level + 1, guildId);
		const span = Math.max(1, nextXp - floorXp);
		const ratio = Math.max(0, Math.min(1, (xp - floorXp) / span));
		const filled = Math.round(ratio * PROGRESS_BAR_SEGMENTS);
		return {
			name: tr('leveling.fields.progress', { level: level + 1 }),
			value: `${'▰'.repeat(filled)}${'▱'.repeat(PROGRESS_BAR_SEGMENTS - filled)} ${Math.round(ratio * PERCENT)}%\n${tr('leveling.xpToGo', { xp: Math.max(0, Math.ceil(nextXp - xp)).toLocaleString() })}`,
			inline: false
		};
	} catch (_) {
		return null;
	}
}

async function progressChannel(guild: Guild, channelId: string | null | undefined) {
	if (!channelId) {
		return null;
	}
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased() || !channel.permissionsFor(guild.members.me!)?.has(['ViewChannel', 'SendMessages'])) {
		return null;
	}
	return channel;
}

async function rankedMemberLevel(
	serverId: number,
	{ discordMemberId, snapshot }: { discordMemberId: string; snapshot: ProgressNotification['memberLevelSnapshot'] }
) {
	if (snapshot) {
		return snapshot;
	}
	await db.recalculateServerMemberRanks(serverId);
	return db.getMemberLevelByDiscordId(serverId, discordMemberId);
}

function progressCardEmbed(tr: Translator, card: ProgressCard) {
	const { member, totalXp, currentRank, previousRank } = card;
	const rankDelta = previousRank && currentRank && currentRank < previousRank ? previousRank - currentRank : 0;
	const rankValue = currentRank ? `#${currentRank}${rankDelta > 0 ? ` (▲${rankDelta})` : ''}` : tr('leveling.unranked');
	const embed = new EmbedBuilder();
	if (card.eventType === 'rank') {
		const medal = getRankMedal(currentRank);
		embed
			.setTitle(`${medal ? `${medal} ` : ''}${tr('leveling.rankUp.title')}`)
			.setDescription(tr(medal ? 'leveling.rankUp.topSpot' : 'leveling.rankUp.climbed', { member: `${member}` }))
			.addFields(
				{ name: tr('leveling.fields.previousRank'), value: previousRank ? `#${previousRank}` : tr('leveling.unranked'), inline: true },
				{ name: tr('leveling.fields.newRank'), value: rankValue, inline: true },
				{ name: tr('leveling.fields.totalXp'), value: totalXp.toLocaleString(), inline: true }
			);
	} else {
		embed
			.setTitle(tr('leveling.levelUp.title'))
			.setDescription(tr('leveling.levelUp.description', { member: `${member}`, level: card.shownLevel }))
			.addFields(
				{ name: tr('leveling.fields.totalXp'), value: totalXp.toLocaleString(), inline: true },
				{ name: tr('leveling.fields.rank'), value: rankValue, inline: true }
			);
		if (card.rewardRoleIds.length > 0) {
			embed.addFields({ name: tr('leveling.fields.reward'), value: card.rewardRoleIds.map((id) => `<@&${id}>`).join(' '), inline: false });
		}
	}
	if (card.progressField) {
		embed.addFields(card.progressField);
	}
	return embed;
}

function progressButtonsRow(tr: Translator, slug: string | null) {
	const leaderboardUrl = slug ? publicServerUrl(slug, 'leaderboard') : null;
	const buttons: ButtonBuilder[] = [];
	if (slug) {
		buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId('level_my_account').setLabel(tr('menu.account')));
	}
	if (leaderboardUrl) {
		buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(leaderboardUrl).setLabel(tr('leveling.leaderboardButton')).setEmoji('🌐'));
	}
	return buttons.length > 0 ? new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons) : null;
}

async function progressCard(
	guild: Guild,
	notice: ProgressNotification & { discordMemberId: string }
): Promise<{ card: ProgressCard; serverId: number } | null> {
	const member = await guild.members.fetch(notice.discordMemberId);
	const server = member?.user ? await getServerForCurrentBot(guild.id).catch(() => null) : null;
	const dbMember = server ? await db.getMemberByDiscordId(server.id, notice.discordMemberId) : null;
	const levelStats = dbMember ? await db.getMemberLevel(dbMember.id) : null;
	if (!server || !levelStats) {
		return null;
	}
	const memberWithRank = await rankedMemberLevel(server.id, { discordMemberId: notice.discordMemberId, snapshot: notice.memberLevelSnapshot ?? null });
	if (!memberWithRank) {
		return null;
	}

	const currentRank = normalizeRankValue(memberWithRank.rank);
	const previousRank = normalizeRankValue(notice.previousRank ?? null);
	const eventType = notice.eventType ?? 'level';
	if (eventType === 'rank' && (!previousRank || !currentRank || currentRank >= previousRank)) {
		return null;
	}

	const totalXp = Number(levelStats.xp ?? 0) || 0;
	const shownLevel = normalizeLevelValue(notice.newLevel ?? memberWithRank.level ?? levelStats.level ?? 1);
	const tr = await serverTranslator(guild.id);
	const progressField = await levelProgressField(totalXp, { level: shownLevel, guildId: guild.id, tr });
	return {
		serverId: server.id,
		card: { member, eventType, totalXp, shownLevel, currentRank, previousRank, rewardRoleIds: notice.rewardRoleIds ?? [], progressField }
	};
}

export async function sendLevelProgressNotification(notice: ProgressNotification = {}) {
	const { guildId, discordMemberId, serverName, contextLabel = 'level-change' } = notice;
	if (!clientInstance || !guildId || !discordMemberId) {
		return false;
	}

	try {
		const guild = clientInstance.guilds.cache.get(guildId);
		if (!guild) {
			return false;
		}
		const settings = await getLevelingSettings(guildId);
		const progressChannelId = settings.PROGRESS_CHANNEL_ID || notice.fallbackChannelId;
		const channel = await progressChannel(guild, progressChannelId);
		if (!channel) {
			return false;
		}

		const built = await progressCard(guild, { ...notice, discordMemberId });
		if (!built) {
			return false;
		}

		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId);
		const embed = progressCardEmbed(tr, built.card)
			.setColor(embedConfig.COLOR)
			.setThumbnail(built.card.member.user.displayAvatarURL())
			.setFooter({ text: (embedConfig.FOOTER || serverName) as string })
			.setTimestamp();
		const progressRow = progressButtonsRow(tr, await computePublicServerSlugForServerId(Number(built.serverId)));

		await sendWithNotifiedMentions(channel, { embeds: [embed], components: progressRow ? [progressRow] : undefined });
		await logger.log(`⭐ Sent ${built.card.eventType} notification (${contextLabel}) to channel ${progressChannelId} for ${discordMemberId} in ${serverName}`);
		return true;
	} catch (error) {
		await logger.log(`⚠️ Failed to send progress notification (${contextLabel}) to ${discordMemberId}: ${(error as Error).message}`);
		return false;
	}
}

async function deriveBaselineLevel(
	{ previousLevel, previousXp, storedLevel }: { previousLevel: unknown; previousXp: unknown; storedLevel: unknown },
	guildId: string
) {
	if (typeof previousLevel === 'number' && !Number.isNaN(previousLevel)) {
		return previousLevel;
	}

	if (typeof previousXp === 'number' && !Number.isNaN(previousXp)) {
		try {
			return await determineLevel(previousXp, guildId);
		} catch (_) {}
	}

	if (typeof storedLevel === 'number' && !Number.isNaN(storedLevel)) {
		return storedLevel;
	}

	return 1;
}

type LevelCheck = { currentStats: MemberLevel | null; guildId: string; context?: LevelContext };

async function handleLevelEvaluation(
	server: Pick<ServerRow, 'id' | 'name'>,
	dbMember: Pick<ServerMemberRow, 'id' | 'display_name' | 'username' | 'discord_member_id'>,
	{ currentStats, guildId, context = {} }: LevelCheck
) {
	if (!server || !dbMember || !currentStats) {
		return currentStats;
	}

	const { previousLevel = null, previousXp = null, previousRank: contextPreviousRank = null, reason = 'unknown', sourceChannelId = null } = context;
	const rawXp = currentStats.xp ?? 0;
	const xpForLevel = typeof rawXp === 'bigint' ? Number(rawXp) : typeof rawXp === 'string' ? parseFloat(rawXp) || 0 : Number(rawXp) || 0;
	const expectedLevel = await determineLevel(xpForLevel, guildId);

	let storedLevel: unknown = currentStats.level;
	if (typeof storedLevel === 'bigint') {
		storedLevel = Number(storedLevel);
	}
	if (typeof storedLevel === 'string') {
		const parsed = parseInt(storedLevel, 10);
		storedLevel = Number.isNaN(parsed) ? null : parsed;
	} else if (typeof storedLevel !== 'number' || Number.isNaN(storedLevel)) {
		storedLevel = null;
	}

	const baselineLevel = await deriveBaselineLevel({ previousLevel, previousXp, storedLevel }, guildId);
	const normalizedPreviousRank = normalizeRankValue(contextPreviousRank);

	let finalStats = currentStats;
	let rewardRoleIds: string[] = [];
	if (storedLevel !== expectedLevel) {
		const updatedStats = await db.updateMemberLevelStats(dbMember.id, { level: expectedLevel });
		if (updatedStats) {
			finalStats = updatedStats;
			let lv = updatedStats.level;
			if (typeof lv === 'bigint') {
				lv = Number(lv);
			}
			storedLevel = typeof lv === 'number' && !Number.isNaN(lv) ? lv : expectedLevel;
		}
		const memberName = dbMember.display_name || dbMember.username || dbMember.discord_member_id || 'Unknown member';
		await logger.log(`⭐ Level stored update (${reason}): ${memberName} -> level ${expectedLevel} in ${server.name}`);
		const guild = clientInstance?.guilds.cache.get(guildId);
		if (guild && dbMember.discord_member_id) {
			rewardRoleIds = await syncMemberRewards(guild, String(dbMember.discord_member_id), { level: baselineLevel });
		}
	}

	let memberLevelSnapshot = null;
	let currentRank = null;
	if (dbMember.discord_member_id) {
		await db.recalculateServerMemberRanks(server.id);
		memberLevelSnapshot = await db.getMemberLevelByDiscordId(server.id, dbMember.discord_member_id);
		currentRank = normalizeRankValue(memberLevelSnapshot?.rank);
	}
	const hasRankImproved = normalizedPreviousRank !== null && currentRank !== null && currentRank < normalizedPreviousRank;

	if (expectedLevel > baselineLevel) {
		if (dbMember.discord_member_id) {
			await sendLevelProgressNotification({
				guildId,
				discordMemberId: dbMember.discord_member_id,
				serverName: server.name,
				newLevel: expectedLevel,
				previousRank: normalizedPreviousRank,
				memberLevelSnapshot,
				contextLabel: `level-eval:${reason}`,
				fallbackChannelId: sourceChannelId,
				rewardRoleIds
			});
		}
	} else if (dbMember.discord_member_id && hasRankImproved) {
		await sendLevelProgressNotification({
			guildId,
			discordMemberId: dbMember.discord_member_id,
			serverName: server.name,
			previousRank: normalizedPreviousRank,
			memberLevelSnapshot,
			eventType: 'rank',
			contextLabel: `rank-eval:${reason}`,
			fallbackChannelId: sourceChannelId
		});
	}

	return finalStats;
}

export async function evaluateMemberLevelAndRank(guildId: string, memberId: number | string, context: LevelContext = {}) {
	try {
		if (!guildId || !memberId) {
			return null;
		}
		const server = await getServerForCurrentBot(guildId).catch(() => null);
		if (!server) {
			return null;
		}
		const dbMember = await db.getServerMemberById(memberId);
		if (!dbMember || Number(dbMember.server_id) !== Number(server.id)) {
			return null;
		}
		const currentStats = await db.getMemberLevel(memberId);
		if (!currentStats) {
			return null;
		}
		return await handleLevelEvaluation(server, dbMember, { currentStats, guildId, context: { reason: 'items', ...context } });
	} catch (error) {
		await logger.log(`⚠️ evaluateMemberLevelAndRank failed for member ${memberId}: ${(error as Error).message}`);
		return null;
	}
}

const XP_LOG_EMOJI: Record<string, string> = {
	Chat: '💬',
	Voice: '🎤',
	'AFK Voice': '🔇',
	Video: '📹',
	Streaming: '📡',
	Invite: '📨'
};

const XP_LOG_TYPE_KEY: Record<string, string> = {
	Chat: 'chat',
	Voice: 'voice',
	'AFK Voice': 'afkVoice',
	Video: 'video',
	Streaming: 'streaming',
	Invite: 'invite'
};

const XP_LOG_SOURCE: Record<string, string> = {
	Chat: 'chat',
	Voice: 'voice',
	'AFK Voice': 'voice_afk',
	Video: 'video',
	Streaming: 'stream',
	Invite: 'invite'
};

const disguisedCache = new Map<string, { ids: Set<number>; at: number }>();
const DISGUISE_CACHE_MS = 10_000;

async function isMemberDisguised(guild: Guild, memberId: number | string | null | undefined): Promise<boolean> {
	if (!guild?.id || !memberId) {
		return false;
	}
	try {
		const key = String(guild.id);
		const cached = disguisedCache.get(key);
		let ids = cached && Date.now() - cached.at < DISGUISE_CACHE_MS ? cached.ids : null;
		if (!ids) {
			const server = await getServerForCurrentBot(guild.id);
			const list = await db.getDisguisedMemberIds(server.id).catch(() => []);
			ids = new Set((list as number[]).map((n) => Number(n)));
			disguisedCache.set(key, { ids, at: Date.now() });
		}
		return ids.has(Number(memberId));
	} catch (_) {
		return false;
	}
}

function fmtRate(n: unknown): string {
	const v = Number(n) || 0;
	return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

function luckRateLabel(total: unknown, luckPercent: unknown): string {
	const t = Number(total) || 0;
	const luck = Math.max(0, Number(luckPercent) || 0);
	return luck > 0 ? `${fmtRate(t)}% (${fmtRate(t - luck)} +${fmtRate(luck)} 🍀)` : `${fmtRate(t)}%`;
}

type XpLogAward = {
	staff?: boolean;
	boosted?: boolean;
	multiplier?: number;
	leeched?: boolean;
	skimPercent?: number;
	friendBoosted?: boolean;
	friendPercent?: number;
	luckPercent?: number;
	victimLuckPercent?: number;
	note?: string | null;
	inviteShare?: { amount: number; percent: number; staff: boolean; inviterName: string | null } | null;
};

type XpLogStats = { xp?: unknown; level?: unknown; rank?: unknown };

type XpLogEntry = { xpGained: number; xpType: string; award?: XpLogAward | null; stats?: XpLogStats | null };

async function sendXPLogToChannel(guild: Guild, dbMember: ServerMemberRow, { xpGained, xpType, award = null, stats = null }: XpLogEntry) {
	try {
		await db
			.logMemberLevelGain(dbMember.id, {
				source: XP_LOG_SOURCE[xpType] ?? String(xpType).toLowerCase(),
				xp: xpGained,
				xp_total: stats?.xp != null ? Number(stats.xp) : null,
				level: stats?.level != null ? Number(stats.level) : null,
				rank: stats?.rank != null ? Number(stats.rank) : null,
				multiplier: award?.boosted || award?.staff ? award.multiplier : null,
				skim_percent: award?.leeched ? award.skimPercent : null,
				friend_percent: award?.friendBoosted ? award.friendPercent : null,
				luck_percent: award?.victimLuckPercent && award.victimLuckPercent > 0 ? award.victimLuckPercent : null
			})
			.catch(() => null);

		if (await isMemberDisguised(guild, dbMember.id)) {
			return;
		}

		const settings = await getLevelingSettings(guild.id);
		if (!settings.PROGRESS_CHANNEL_ID) {
			return;
		}

		const channel = (await guild.channels.fetch(settings.PROGRESS_CHANNEL_ID).catch(() => null)) as GuildTextBasedChannel | null;
		if (!channel) {
			return;
		}

		const tr = await serverTranslator(guild.id);
		const memberName = dbMember.server_display_name || dbMember.display_name || dbMember.username || tr('leveling.log.unknownMember');
		const emoji = XP_LOG_EMOJI[xpType] ?? '⭐';
		const typeKey = XP_LOG_TYPE_KEY[xpType];
		const typeLabel = typeKey ? tr(`leveling.log.types.${typeKey}`) : String(xpType);
		const boostSuffix = award?.staff
			? ` ${tr('leveling.log.staff', { multiplier: award.multiplier })}`
			: award?.boosted
				? ` ${tr('leveling.log.boost', { multiplier: award.multiplier })}`
				: '';
		const noteSuffix = award?.note ? ` ${award.note}` : '';
		const share = award?.inviteShare;
		const shareSuffix =
			share && share.amount > 0 && share.inviterName
				? ` · ${tr('leveling.log.share', { amount: share.amount, name: share.inviterName, percent: share.percent, staff: share.staff ? ' 🛡️' : '' })}`
				: '';
		const friendSuffix = award?.friendBoosted ? ` ${tr('leveling.log.friend', { rate: luckRateLabel(award.friendPercent, award.luckPercent) })}` : '';
		const leechSuffix = award?.leeched ? ` ${tr('leveling.log.leech', { rate: luckRateLabel(award.skimPercent, 0) })}` : '';
		const logMessage = `${tr('leveling.log.gain', { emoji, type: typeLabel, name: memberName, xp: xpGained })}${noteSuffix}${boostSuffix}${friendSuffix}${leechSuffix}${shareSuffix}`;

		await channel.send(logMessage);
	} catch (error) {
		const msg = error instanceof Error ? (error as Error).message : String(error);
		await logger.log(`⚠️ Failed to send XP log to channel: ${msg}`);
	}
}

const SHARE_CACHE_MS = 60_000;
const inviterShareCache = new Map<number, { at: number; row: Awaited<ReturnType<typeof db.getActiveInviterForShare>> | null }>();
const staffCache = new Map<string, { at: number; staff: boolean | null }>();

async function inviterForShare(memberId: number) {
	const hit = inviterShareCache.get(memberId);
	if (hit && Date.now() - hit.at < SHARE_CACHE_MS) {
		return hit.row;
	}
	const row = await db.getActiveInviterForShare(memberId).catch(() => null);
	inviterShareCache.set(memberId, { at: Date.now(), row });
	return row;
}

async function isStaffInviter(guild: Guild, discordId: string): Promise<boolean | null> {
	const key = `${guild.id}:${discordId}`;
	const hit = staffCache.get(key);
	if (hit && Date.now() - hit.at < SHARE_CACHE_MS) {
		return hit.staff;
	}
	const guildMember = guild.members.cache.get(discordId) ?? (await guild.members.fetch(discordId).catch(() => null));
	if (!guildMember) {
		staffCache.set(key, { at: Date.now(), staff: null });
		return null;
	}
	let isStaff = false;
	try {
		const perms = await PERMISSIONS.getPermissions(guild.id);
		isStaff = await PERMISSIONS.hasAnyRole(guildMember, perms.STAFF_ROLES);
	} catch (_) {}
	staffCache.set(key, { at: Date.now(), staff: isStaff });
	return isStaff;
}

async function getInviteSharePercent(guildId: string): Promise<number> {
	try {
		return (await getLevelingSettings(guildId)).INVITE.SHARE_PERCENT;
	} catch (_) {
		return 0;
	}
}

type ShareSource = { invitee: Record<string, unknown>; earnedXp: number };

async function creditInviteShare(guild: Guild, server: Pick<ServerRow, 'id' | 'name'>, { invitee, earnedXp }: ShareSource) {
	try {
		if (!guild || !server || !invitee?.id || !(earnedXp > 0)) {
			return null;
		}
		const basePercent = await getInviteSharePercent(guild.id);
		if (basePercent <= 0) {
			return null;
		}
		const link = await inviterForShare(Number(invitee.id));
		if (!link?.inviter_member_id || !link.inviter_discord_id) {
			return null;
		}

		const isStaff = await isStaffInviter(guild, String(link.inviter_discord_id));
		if (isStaff === null) {
			return null;
		}
		const percent = isStaff ? basePercent * INVITE_STAFF_MULTIPLIER : basePercent;
		const amount = Math.floor((earnedXp * percent) / PERCENT);
		if (amount <= 0) {
			return null;
		}

		const inviterId = Number(link.inviter_member_id);
		await db.ensureMemberLevel(inviterId);
		const before = await db.getMemberLevel(inviterId);
		const stats = await db.updateMemberLevelStats(inviterId, { xpIncrement: amount });
		await db.addInviteShareXp(Number(link.id), amount).catch(() => null);
		await db
			.logMemberLevelGain(inviterId, {
				source: 'invite_share',
				xp: amount,
				xp_total: stats?.xp != null ? Number(stats.xp) : null,
				level: stats?.level != null ? Number(stats.level) : null,
				rank: stats?.rank != null ? Number(stats.rank) : null,
				multiplier: percent / PERCENT
			})
			.catch(() => null);

		const inviter = await db.getServerMemberById(inviterId).catch(() => null);
		if (inviter && stats) {
			await handleLevelEvaluation(server, inviter, {
				currentStats: stats,
				guildId: guild.id,
				context: {
					previousLevel: before?.level ?? null,
					previousXp: before?.xp ?? null,
					previousRank: before?.rank ?? null,
					reason: 'invite-share'
				}
			});
		}

		const isHidden = await isMemberDisguised(guild, inviterId);
		return { amount, percent, staff: isStaff, inviterName: isHidden ? null : (link.inviter_name ?? null) };
	} catch (error) {
		await logger.log(`⚠️ Invite share failed for member ${invitee?.id}: ${(error as Error).message}`);
		return null;
	}
}

type InviteAward = { xp: number; meta: { multiplier: number; inviteeName: string | null } };

export async function awardInviteXp(guild: Guild, guildMember: MemberLike, { xp, meta }: InviteAward) {
	const recorded = await attempt(async () => {
		const resolved = await resolveServerAndMember(guild, guildMember);
		if (!resolved.server || !resolved.dbMember) {
			return null;
		}
		await db.ensureMemberLevel(resolved.dbMember.id);
		const before = await db.getMemberLevel(resolved.dbMember.id);
		const after = await db.updateMemberLevelStats(resolved.dbMember.id, { xpIncrement: xp });
		return { server: resolved.server, dbMember: resolved.dbMember, previousStats: before, stats: after };
	});
	if (!recorded.ok) {
		await logger.log(`❌ Invite XP award failed: ${(recorded.error as Error).message}`);
		return null;
	}
	if (!recorded.value) {
		return null;
	}
	const { server, dbMember, previousStats, stats } = recorded.value;

	try {
		const tr = await serverTranslator(guild.id);
		const award = {
			staff: meta.multiplier > 1,
			multiplier: meta.multiplier,
			note: meta.inviteeName ? tr('leveling.log.inviteNote', { name: meta.inviteeName }) : null
		};
		await sendXPLogToChannel(guild, dbMember, { xpGained: xp, xpType: 'Invite', award, stats });
		await handleLevelEvaluation(server, dbMember, {
			currentStats: stats,
			guildId: guild.id,
			context: {
				previousLevel: previousStats?.level ?? null,
				previousXp: previousStats?.xp ?? null,
				previousRank: previousStats?.rank ?? null,
				reason: 'invite'
			}
		});
	} catch (error) {
		await logger.log(`⚠️ Invite XP follow-up failed: ${(error as Error).message}`);
	}
	return stats ?? {};
}

async function announceLeechCredits(guild: Guild, victim: ServerMemberRow, credits: Awaited<ReturnType<typeof creditLeechers>>) {
	try {
		if (!guild || !Array.isArray(credits) || credits.length === 0) {
			return;
		}
		const settings = await getLevelingSettings(guild.id);
		if (!settings.PROGRESS_CHANNEL_ID) {
			return;
		}
		const channel = (await guild.channels.fetch(settings.PROGRESS_CHANNEL_ID).catch(() => null)) as GuildTextBasedChannel | null;
		if (!channel) {
			return;
		}

		if (await isMemberDisguised(guild, victim?.id)) {
			return;
		}

		const tr = await serverTranslator(guild.id);
		const victimName = victim?.server_display_name || victim?.display_name || victim?.username || tr('leveling.log.someMember');
		for (const credit of credits) {
			if (!credit?.amount || credit.amount <= 0) {
				continue;
			}
			const b = credit.beneficiary;
			if (await isMemberDisguised(guild, b?.id)) {
				continue;
			}
			const attackerName = b?.server_display_name || b?.display_name || b?.username || tr('leveling.log.someLeecher');
			const attackerLuck = await getActiveLuckPercent(credit.beneficiaryMemberId).catch(() => 0);
			const pct = credit.percent != null ? ` (${luckRateLabel(credit.percent, attackerLuck)})` : '';
			await channel.send(tr('leveling.log.leechCredit', { attacker: attackerName, amount: credit.amount, victim: victimName, pct })).catch(() => null);
		}
	} catch (error) {
		const msg = error instanceof Error ? (error as Error).message : String(error);
		await logger.log(`⚠️ Failed to announce leech credits: ${msg}`);
	}
}

async function handleReactionChange(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, delta: number) {
	try {
		if (!reaction || user?.bot) {
			return;
		}

		let fullReaction: MessageReaction | PartialMessageReaction = reaction;
		if (reaction.partial) {
			try {
				fullReaction = await reaction.fetch();
			} catch {
				return;
			}
		}

		const guild = fullReaction.message?.guild;
		if (!guild) {
			return;
		}
		if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.leveling))) {
			return;
		}

		const fetchedMember = await guild.members.fetch({ user: user.id, cache: true }).catch(() => null);
		if (!fetchedMember) {
			return;
		}

		const { dbMember, guildMember } = await resolveServerAndMember(guild, fetchedMember);
		if (!dbMember || !guildMember) {
			return;
		}
		if (!(await isMemberEligible(guild.id, guildMember))) {
			return;
		}

		await db.ensureMemberLevel(dbMember.id);
		await db.updateMemberLevelStats(dbMember.id, { reactionsIncrement: delta });
	} catch (error) {
		await logger.log(`⚠️ Reaction tracking error: ${(error as Error).message}`);
	}
}

async function handleMessageCreate(message: Message) {
	try {
		if (!message?.guild || message.author?.bot) {
			return;
		}
		if (!(await isComponentFeatureEnabled(message.guild.id, serverSettingsComponent.leveling))) {
			return;
		}

		const cooldownKey = `${message.guild.id}:${message.author.id}`;
		const guildId = message.guild.id;

		const messageCooldownMs = await getMessageCooldownMs(guildId);
		if (!(await claimMessageCooldown(cooldownKey, messageCooldownMs))) {
			return;
		}

		const memberReference = message.member || { id: message.author.id, user: message.author };
		const { server, dbMember, guildMember } = await resolveServerAndMember(message.guild, memberReference);

		if (!server || !dbMember || !guildMember) {
			return;
		}

		const isEligible = await isMemberEligible(message.guild.id, guildMember);
		if (!isEligible) {
			return;
		}

		await db.ensureMemberLevel(dbMember.id);
		const previousStats = await db.getMemberLevel(dbMember.id);
		const baseXp = await getXpForMessage(guildId);
		const award = await applyAwardEffects(dbMember.id, baseXp, { source: 'message', guildId });
		const { memberXp, leechCredits } = award;
		const stats = await db.updateMemberLevelStats(dbMember.id, {
			chatIncrement: 1,
			xpIncrement: memberXp,
			chatRewardedAt: message.createdAt ? new Date(message.createdAt) : new Date()
		});
		checkRewardProgress(message.guild, String(dbMember.discord_member_id), { beforeStats: previousStats, afterStats: stats });
		const leechApplied = await creditLeechers(leechCredits, guildId);
		const inviteShare = await creditInviteShare(message.guild, server, { invitee: dbMember, earnedXp: memberXp });

		await sendXPLogToChannel(message.guild, dbMember, { xpGained: memberXp, xpType: 'Chat', award: { ...award, inviteShare }, stats });
		await announceLeechCredits(message.guild, dbMember, leechApplied);

		await handleLevelEvaluation(server, dbMember, {
			currentStats: stats,
			guildId: message.guild.id,
			context: {
				previousLevel: previousStats?.level ?? null,
				previousXp: previousStats?.xp ?? null,
				previousRank: previousStats?.rank ?? null,
				reason: 'message',
				sourceChannelId: message.channel?.id ?? null
			}
		});
	} catch (error) {
		await logger.log(`❌ Leveling message handler error: ${(error as Error).message}`);
	}
}

async function awardVoiceXP(
	server: Pick<ServerRow, 'id' | 'name'>,
	dbMember: ServerMemberRow,
	{ guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId = null }: VoiceTick
) {
	const lockKey = `${guildId}:${dbMember.id}`;
	if (voiceAwardLocks.has(lockKey)) {
		return null;
	}
	voiceAwardLocks.add(lockKey);
	try {
		return await awardVoiceXPLocked(server, dbMember, { guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId });
	} finally {
		voiceAwardLocks.delete(lockKey);
	}
}

type VoiceTick = {
	guildId: string;
	reason: string;
	previousStats: MemberLevel | null;
	buckets: VoiceBuckets;
	mediaFlags: MediaFlags;
	voiceChannelId?: string | null;
};

async function awardVoiceXPLocked(
	server: Pick<ServerRow, 'id' | 'name'>,
	dbMember: ServerMemberRow,
	{ guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId = null }: VoiceTick
) {
	const { isAFK, voiceMinutes, videoMinutes, streamMinutes } = buckets;
	const vm = Math.max(0, Math.floor(Number(voiceMinutes) || 0));
	const vid = Math.max(0, Math.floor(Number(videoMinutes) || 0));
	const strm = Math.max(0, Math.floor(Number(streamMinutes) || 0));
	if (vm <= 0 && vid <= 0 && strm <= 0) {
		return null;
	}

	const oldStats = previousStats || (await db.getMemberLevel(dbMember.id));
	const baseXp = await getXpForVoiceMinutes(vm, isAFK, guildId);
	const videoXp = await getVideoXpForVoiceTick(vid, guildId);
	const streamXp = await getStreamingXpForVoiceTick(strm, guildId);
	const rawXpGained = baseXp + videoXp + streamXp;
	const award = await applyAwardEffects(dbMember.id, rawXpGained, { source: 'voice', guildId });
	const { memberXp: baseAwardXp, leechCredits } = award;

	const { count: friendCount, discordIds: friendDiscordIds } = await countVoiceFriends(guildId, dbMember.discord_member_id);
	const luckPercent = await getActiveLuckPercent(dbMember.id);
	const friendPercent = friendCount * VOICE_FRIEND_BONUS_PERCENT + luckPercent;
	const friendBonus = Math.floor((baseAwardXp * friendPercent) / PERCENT);
	const xpGained = baseAwardXp + friendBonus;
	const loggedAward: XpLogAward = { ...award, friendPercent, friendBoosted: friendPercent > 0, luckPercent };

	if (friendDiscordIds.length > 0) {
		const perFriendXp = Math.floor(friendBonus / friendDiscordIds.length);
		db.recordLevelFriends(dbMember.id, friendDiscordIds, { perFriendXp, minutes: Math.max(vm, vid, strm) }).catch(() => null);
	}

	const stats = await db.updateMemberLevelStats(dbMember.id, {
		xpIncrement: xpGained,
		isInVoice: true,
		isInVideo: !!mediaFlags?.selfVideo,
		isInStream: !!mediaFlags?.streaming,
		...(vm > 0 ? { voiceRewardedAt: new Date() } : {}),
		...(vid > 0 ? { videoRewardedAt: new Date() } : {}),
		...(strm > 0 ? { streamRewardedAt: new Date() } : {}),
		...(isAFK ? { voiceMinutesAfkIncrement: vm } : { voiceMinutesActiveIncrement: vm }),
		...(vid > 0 ? { voiceMinutesVideoIncrement: vid } : {}),
		...(strm > 0 ? { voiceMinutesStreamingIncrement: strm } : {})
	});
	const leechApplied = await creditLeechers(leechCredits, guildId);

	const discordGuild = clientInstance?.guilds.cache.get(guildId);
	checkRewardProgress(discordGuild, String(dbMember.discord_member_id), { beforeStats: oldStats, afterStats: stats });
	if (discordGuild) {
		let inviteShare = await creditInviteShare(discordGuild, server, { invitee: dbMember, earnedXp: xpGained });
		const rate = rawXpGained > 0 ? xpGained / rawXpGained : 1;
		const shown = (bucket: number) => Math.max(0, Math.round(bucket * rate));
		const send = async (amount: number, type: string) => {
			await sendXPLogToChannel(discordGuild, dbMember, { xpGained: amount, xpType: type, award: { ...loggedAward, inviteShare }, stats });
			inviteShare = null;
		};
		if (baseXp > 0) {
			await send(shown(baseXp), isAFK ? 'AFK Voice' : 'Voice');
		}
		if (videoXp > 0) {
			await send(shown(videoXp), 'Video');
		}
		if (streamXp > 0) {
			await send(shown(streamXp), 'Streaming');
		}
		await announceLeechCredits(discordGuild, dbMember, leechApplied);
	}

	return await handleLevelEvaluation(server, dbMember, {
		currentStats: stats,
		guildId,
		context: {
			previousLevel: oldStats?.level ?? null,
			previousXp: oldStats?.xp ?? null,
			previousRank: oldStats?.rank ?? null,
			reason,
			sourceChannelId: voiceChannelId
		}
	});
}

type MediaBaseline = { lastVideoMs: number | null; lastStreamMs: number | null };

async function syncVoiceMediaBaselines(dbMemberId: number, mediaFlags: MediaFlags, { lastVideoMs, lastStreamMs }: MediaBaseline) {
	await db.updateMemberLevelStats(dbMemberId, {
		isInVoice: true,
		isInVideo: !!mediaFlags.selfVideo,
		isInStream: !!mediaFlags.streaming,
		...(!mediaFlags.selfVideo ? { videoRewardedAt: new Date() } : {}),
		...(!mediaFlags.streaming ? { streamRewardedAt: new Date() } : {}),
		...(mediaFlags.selfVideo && lastVideoMs === null ? { videoRewardedAt: new Date() } : {}),
		...(mediaFlags.streaming && lastStreamMs === null ? { streamRewardedAt: new Date() } : {})
	});
}

async function handleVoiceMediaOnlyUpdate(oldState: VoiceState, newState: VoiceState) {
	try {
		const { guild } = newState;
		if (!guild?.id) {
			return;
		}
		if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.leveling))) {
			return;
		}

		const memberLike = newState.member ?? (newState.id ? { id: newState.id } : null);
		if (!memberLike) {
			return;
		}

		const { server, dbMember, guildMember } = await resolveServerAndMember(guild, memberLike);
		if (!server || !dbMember || !guildMember) {
			return;
		}

		const isEligible = await isMemberEligible(guild.id, guildMember);
		if (!isEligible) {
			return;
		}

		const hasSelfVideo = !!newState.selfVideo;
		const isStreaming = !!newState.streaming;
		await db.updateMemberLevelStats(dbMember.id, {
			isInVideo: hasSelfVideo,
			isInStream: isStreaming,
			...(oldState.selfVideo !== newState.selfVideo ? { videoRewardedAt: new Date() } : {}),
			...(oldState.streaming !== newState.streaming ? { streamRewardedAt: new Date() } : {})
		});
	} catch (error) {
		await logger.log(`❌ Leveling voice media update error: ${(error as Error).message}`);
	}
}

type VoiceStart = {
	state: VoiceState;
	server: Pick<ServerRow, 'id' | 'name'>;
	dbMember: ServerMemberRow;
	levelData: MemberLevel | null;
	isResumeCatchup: boolean;
	isAfk: boolean;
	cooldownMs: number;
	now: number;
};

function minutesSince(now: number, ms: number | null) {
	return ms === null ? 0 : Math.max(0, Math.floor((now - ms) / MINUTE_MS));
}

function resumeCatchupMinutes({ state, levelData, now }: VoiceStart, lastVoiceMs: number) {
	const voiceMinutes = minutesSince(now, lastVoiceMs);
	const rawVideo = state.selfVideo && levelData?.is_in_video ? minutesSince(now, parseLevelRewardedAtMs(levelData?.video_rewarded_at)) : 0;
	const rawStream = state.streaming && levelData?.is_in_stream ? minutesSince(now, parseLevelRewardedAtMs(levelData?.stream_rewarded_at)) : 0;
	return {
		voiceMinutes,
		videoMinutes: voiceMinutes > 0 ? Math.min(voiceMinutes, rawVideo) : 0,
		streamMinutes: voiceMinutes > 0 ? Math.min(voiceMinutes, rawStream) : 0
	};
}

async function rewardVoiceStart(start: VoiceStart): Promise<boolean> {
	const { state, levelData } = start;
	const lastVoiceMs = parseLevelRewardedAtMs(levelData?.voice_rewarded_at);
	if (lastVoiceMs === null || !state.guild) {
		return false;
	}
	const minutes = start.isResumeCatchup
		? resumeCatchupMinutes(start, lastVoiceMs)
		: { voiceMinutes: 1, videoMinutes: state.selfVideo ? 1 : 0, streamMinutes: state.streaming ? 1 : 0 };
	if (start.isResumeCatchup && minutes.voiceMinutes <= 0 && minutes.videoMinutes <= 0 && minutes.streamMinutes <= 0) {
		return false;
	}
	if (!(await db.claimVoiceRewardWindow(start.dbMember.id, start.cooldownMs))) {
		return false;
	}
	await awardVoiceXP(start.server, start.dbMember, {
		guildId: state.guild.id,
		reason: start.isResumeCatchup ? 'voice-resume-catchup' : 'voice-start-interval',
		previousStats: levelData,
		buckets: { isAFK: start.isAfk, ...minutes },
		mediaFlags: { selfVideo: !!state.selfVideo, streaming: !!state.streaming },
		voiceChannelId: state.channelId
	});
	return true;
}

async function startVoiceSession(state: VoiceState, wasResumed = false) {
	try {
		if (!state?.channelId || !state.guild) {
			return;
		}
		if (!(await isComponentFeatureEnabled(state.guild.id, serverSettingsComponent.leveling))) {
			return;
		}

		const memberLike = state.member ?? (state.id ? { id: state.id } : null);
		if (!memberLike) {
			return;
		}

		const { server, dbMember, guildMember } = await resolveServerAndMember(state.guild, memberLike);
		if (!server || !dbMember || !guildMember) {
			return;
		}

		const isEligible = await isMemberEligible(state.guild.id, guildMember);
		if (!isEligible) {
			return;
		}

		await db.ensureMemberLevel(dbMember.id);
		const levelData = await db.getMemberLevel(dbMember.id);
		const wasMarkedInVoice = !!levelData?.is_in_voice;

		const lastVoiceMs = parseLevelRewardedAtMs(levelData?.voice_rewarded_at);
		const lastVideoMs = parseLevelRewardedAtMs(levelData?.video_rewarded_at);
		const lastStreamMs = parseLevelRewardedAtMs(levelData?.stream_rewarded_at);

		const sessionKey = `${state.guild.id}:${guildMember.id}`;
		const existingSession = voiceSessions.get(sessionKey);
		if (existingSession?.interval) {
			clearInterval(existingSession.interval);
		}

		const now = Date.now();
		const guildId = state.guild.id;
		const voiceCooldownMs = await getVoiceCooldownMs(guildId);
		const isVoiceAfkForXp = await resolveVoiceAFK(server.id, guildMember.id, state);
		const mediaFlags = { selfVideo: !!state.selfVideo, streaming: !!state.streaming };

		if (lastVoiceMs === null) {
			await db.updateMemberLevelStats(dbMember.id, {
				isInVoice: true,
				voiceRewardedAt: new Date(),
				isInVideo: mediaFlags.selfVideo,
				isInStream: mediaFlags.streaming,
				videoRewardedAt: new Date(),
				streamRewardedAt: new Date()
			});
		} else {
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: true });
		}

		const wasRewarded = await rewardVoiceStart({
			state,
			server,
			dbMember,
			levelData,
			isResumeCatchup: wasResumed && wasMarkedInVoice,
			isAfk: isVoiceAfkForXp,
			cooldownMs: voiceCooldownMs,
			now
		});
		const finalLastRewardedAt = wasRewarded ? now : lastVoiceMs || now;

		await syncVoiceMediaBaselines(dbMember.id, mediaFlags, { lastVideoMs, lastStreamMs });

		const tickInterval = Math.min(Math.max(voiceCooldownMs || MIN_VOICE_TICK_MS, MIN_VOICE_TICK_MS), MAX_VOICE_TICK_MS);
		const interval = setInterval(async () => {
			await handleVoiceTick(sessionKey);
		}, tickInterval);

		voiceSessions.set(sessionKey, {
			serverId: server.id,
			serverName: server.name,
			memberId: dbMember.id,
			discordMemberId: guildMember.id,
			guildId: state.guild.id,
			interval,
			lastRewardedAt: finalLastRewardedAt,
			joinedAt: now,
			channelId: state.channelId
		});
	} catch (error) {
		await logger.log(`❌ Leveling voice session start error: ${(error as Error).message}`);
	}
}

async function endVoiceSession(state: VoiceState) {
	try {
		const { guild } = state;
		if (!guild) {
			return;
		}

		const memberId = state.member?.id || state.id;
		if (!memberId) {
			return;
		}

		const sessionKey = `${guild.id}:${memberId}`;
		const session = voiceSessions.get(sessionKey);

		if (session && session.interval) {
			clearInterval(session.interval);
		}

		voiceSessions.delete(sessionKey);

		const server = await getServerForCurrentBot(guild.id).catch(() => null);
		if (!server) {
			return;
		}

		const dbMember = await db.getMemberByDiscordId(server.id, memberId);
		if (!dbMember) {
			return;
		}
		await db.updateMemberLevelStats(dbMember.id, {
			isInVoice: false
		});
	} catch (error) {
		await logger.log(`❌ Leveling voice session end error: ${(error as Error).message}`);
	}
}

async function handleVoiceTick(sessionKey: string) {
	const session = voiceSessions.get(sessionKey);
	if (!session) {
		return;
	}

	try {
		if (!(await isComponentFeatureEnabled(session.guildId, serverSettingsComponent.leveling))) {
			if (session.interval) {
				clearInterval(session.interval);
			}
			voiceSessions.delete(sessionKey);
			await db.updateMemberLevelStats(session.memberId, { isInVoice: false });
			return;
		}

		const server = await getServerForCurrentBot(session.guildId).catch(() => null);
		if (!server) {
			return;
		}

		const dbMember = await db.getMemberByDiscordId(server.id, session.discordMemberId);
		if (!dbMember) {
			return;
		}

		const { guildId } = session;
		const voiceCooldownMs = await getVoiceCooldownMs(guildId);

		if (!(await db.claimVoiceRewardWindow(dbMember.id, voiceCooldownMs))) {
			return;
		}

		const guild = clientInstance?.guilds.cache.get(session.guildId);
		const voiceState = resolveGuildVoiceState(guild, session.discordMemberId);
		const isVoiceAfkForXp = await resolveVoiceAFK(server.id, session.discordMemberId, voiceState);

		const levelSnapshot = await db.getMemberLevel(dbMember.id);
		const serverInfo = { id: session.serverId, name: session.serverName };

		const mf = { selfVideo: !!voiceState?.selfVideo, streaming: !!voiceState?.streaming };
		await awardVoiceXP(serverInfo, dbMember, {
			guildId,
			reason: 'voice-tick',
			previousStats: levelSnapshot,
			buckets: {
				isAFK: isVoiceAfkForXp,
				voiceMinutes: 1,
				videoMinutes: mf.selfVideo ? 1 : 0,
				streamMinutes: mf.streaming ? 1 : 0
			},
			mediaFlags: mf,
			voiceChannelId: voiceState?.channelId ?? session.channelId ?? null
		});
	} catch (error) {
		await logger.log(`❌ Leveling voice tick error: ${(error as Error).message}`);
	}
}

type LevelRecount = { recalculated: number; fixed: number };
type BotServer = Awaited<ReturnType<typeof db.getServersForBot>>[number];

async function recalculateMemberLevel(memberId: number, guildId: string): Promise<boolean | null> {
	const levelData = await db.getMemberLevel(memberId);
	if (!levelData) {
		return null;
	}
	const expectedLevel = await determineLevel(levelData.xp ?? 0, guildId);
	if ((levelData.level ?? 1) === expectedLevel) {
		return false;
	}
	await db.updateMemberLevelStats(memberId, { level: expectedLevel });
	return true;
}

async function recalculateServerLevels(server: BotServer, guildId: string): Promise<LevelRecount> {
	const recount: LevelRecount = { recalculated: 0, fixed: 0 };
	const members = await db.getServerMembersList(server.id);
	for (const member of members ?? []) {
		if (!member.id || !member.xp) {
			continue;
		}
		const wasFixed = await recalculateMemberLevel(member.id, guildId);
		if (wasFixed === null) {
			continue;
		}
		recount.recalculated++;
		if (wasFixed) {
			recount.fixed++;
		}
	}

	if (recount.recalculated > 0) {
		await db.recalculateServerMemberRanks(server.id);
		await logger.log(`✅ Recalculated ${recount.recalculated} member(s) in ${server.name} (${recount.fixed} level(s) corrected)`);
	}
	return recount;
}

async function recalculateAllMemberLevels(client: Client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log('⚠️ Bot config not available, skipping level recalculation');
			return;
		}

		const servers = await db.getServersForBot(botConfig.id);
		if (!servers || servers.length === 0) {
			await logger.log('ℹ️ No servers found, skipping level recalculation');
			return;
		}

		await logger.log(`🔄 Starting level recalculation for ${servers.length} server(s)...`);
		const total: LevelRecount = { recalculated: 0, fixed: 0 };

		for (const server of servers) {
			const guild = client.guilds.cache.get(server.discord_server_id);
			if (!guild) {
				continue;
			}
			try {
				const recount = await recalculateServerLevels(server, guild.id);
				total.recalculated += recount.recalculated;
				total.fixed += recount.fixed;
			} catch (error) {
				await logger.log(`❌ Error recalculating levels for server ${server.name}: ${(error as Error).message}`);
			}
		}

		await logger.log(`✅ Level recalculation complete: ${total.recalculated} member(s) checked, ${total.fixed} level(s) corrected`);

		for (const server of servers) {
			if (client.guilds.cache.has(server.discord_server_id)) {
				await syncGuildRewards(client, server.discord_server_id);
			}
		}
	} catch (error) {
		await logger.log(`❌ Error during level recalculation: ${(error as Error).message}`);
	}
}

export async function resumeLevelingVoiceForGuild(client: Client, guild: Guild) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id || !guild) {
			return;
		}

		const activeVoiceMemberIds = new Set();

		for (const [, voiceState] of guild.voiceStates.cache) {
			if (!voiceState.channelId || !voiceState.id) {
				continue;
			}
			activeVoiceMemberIds.add(voiceState.id);
			try {
				await startVoiceSession(voiceState, true);
			} catch (err) {
				await logger.log(`❌ Leveling: failed to resume voice session for ${voiceState.id}: ${(err as Error).message}`);
			}
		}

		const server = await getServerForCurrentBot(guild.id).catch(() => null);
		if (server) {
			const membersWithFlag = await db.getMembersWithInVoiceFlag(server.id);
			const staleMemberIds = membersWithFlag.filter((m) => !activeVoiceMemberIds.has(m.discord_member_id)).map((m) => m.member_id);

			if (staleMemberIds.length > 0) {
				for (const memberId of staleMemberIds) {
					await db.updateMemberLevelStats(memberId, { isInVoice: false, isInVideo: false, isInStream: false });
				}
				await logger.log(`🧹 Leveling: Cleaned up ${staleMemberIds.length} stale is_in_voice flag(s) for guild ${guild.name}`);
			}
		}
	} catch (error) {
		await logger.log(`❌ Leveling resume guild error (${guild?.id}): ${(error as Error).message}`);
	}
}

export async function stopLevelingVoiceSessionsForGuild(guildDiscordId: string) {
	if (!guildDiscordId) {
		return;
	}
	const prefix = `${guildDiscordId}:`;
	const server = await getServerForCurrentBot(guildDiscordId).catch(() => null);
	for (const [sessionKey, session] of [...voiceSessions.entries()]) {
		if (!sessionKey.startsWith(prefix)) {
			continue;
		}
		if (session?.interval) {
			clearInterval(session.interval);
		}
		voiceSessions.delete(sessionKey);

		if (!server) {
			continue;
		}
		const dbMember = await db.getMemberByDiscordId(server.id, session.discordMemberId);
		if (dbMember) {
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: false, isInVideo: false, isInStream: false });
		}
	}
	await logger.log(`🔇 Leveling: Stopped voice XP timers for guild ${guildDiscordId}`);
}

export async function startLevelingRuntime(client: Client, guildDiscordId: string) {
	if (!client || !guildDiscordId) {
		return;
	}
	const guild = client.guilds.cache.get(guildDiscordId) ?? (await client.guilds.fetch(guildDiscordId).catch(() => null));
	if (guild) {
		await resumeLevelingVoiceForGuild(client, guild);
	}
}

export async function stopLevelingRuntime(guildDiscordId: string) {
	if (guildDiscordId) {
		await stopLevelingVoiceSessionsForGuild(guildDiscordId);
	}
}

async function resumeVoiceSessions(client: Client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id) {
			return;
		}

		for (const guild of client.guilds.cache.values()) {
			await resumeLevelingVoiceForGuild(client, guild);
		}
	} catch (error) {
		await logger.log(`❌ Leveling resume error: ${(error as Error).message}`);
	}
}

async function handleRewardRejoin(member: GuildMember) {
	if (member.user?.bot) {
		return;
	}
	try {
		await syncMemberRewards(member.guild, member.id);
	} catch (_) {}
}

function init(client: Client) {
	clientInstance = client;
	client.on('messageCreate', handleMessageCreate);
	client.on('messageReactionAdd', (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => handleReactionChange(reaction, user, 1));
	client.on('messageReactionRemove', (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) =>
		handleReactionChange(reaction, user, -1)
	);
	client.on('guildMemberAdd', handleRewardRejoin);

	if (client.isReady()) {
		resumeVoiceSessions(client);
		setTimeout(() => recalculateAllMemberLevels(client), RECALCULATE_DELAY_SECONDS * SECOND_MS);
	} else {
		client.once('ready', () => {
			resumeVoiceSessions(client);
			setTimeout(() => recalculateAllMemberLevels(client), RECALCULATE_DELAY_SECONDS * SECOND_MS);
		});
	}

	client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
		try {
			const oldChannel = oldState?.channelId;
			const newChannel = newState?.channelId;

			if (!oldChannel && newChannel) {
				await startVoiceSession(newState, false);
			} else if (oldChannel && !newChannel) {
				await endVoiceSession(oldState);
			} else if (oldChannel && newChannel && oldChannel !== newChannel) {
				await endVoiceSession(oldState);
				await startVoiceSession(newState, false);
			} else if (oldChannel && newChannel && oldChannel === newChannel) {
				if (oldState.selfVideo !== newState.selfVideo || oldState.streaming !== newState.streaming) {
					await handleVoiceMediaOnlyUpdate(oldState, newState);
				}
			}
		} catch (error) {
			await logger.log(`❌ Leveling voice state update error: ${(error as Error).message}`);
		}
	});
}

export default { init };
