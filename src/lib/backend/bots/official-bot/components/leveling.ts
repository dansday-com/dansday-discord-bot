import {
	getLevelingSettings,
	getBotConfig,
	getEmbedConfig,
	getServerForCurrentBot,
	NOTIFICATIONS,
	isComponentFeatureEnabled,
	serverSettingsComponent,
	computePublicServerSlugForServerId,
	publicServerUrl
} from '../../../config.js';
import db from '../../../../database.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { getRedisClient } from '../../../../redis.js';
import { applyAwardEffects, creditLeechers, getActiveLuckPercent } from './items.js';
import { translate } from '../i18n.js';

const recentMessages = new Map();

async function claimMessageCooldown(cooldownKey, cooldownMs) {
	if (cooldownMs <= 0) return true;

	const redis = await getRedisClient().catch(() => null);
	if (redis) {
		try {
			const res = await redis.set(`lvl:msgcd:${cooldownKey}`, '1', { NX: true, PX: cooldownMs });
			return res === 'OK';
		} catch (error) {
			await logger.log(`⚠️ Leveling cooldown Redis error, falling back to memory: ${error.message}`);
		}
	}

	const now = Date.now();
	const lastMessageAt = recentMessages.get(cooldownKey);
	if (lastMessageAt && now - lastMessageAt < cooldownMs) return false;
	recentMessages.set(cooldownKey, now);
	return true;
}
const voiceSessions = new Map();
const voiceAwardLocks = new Set();
let clientInstance = null;

export async function getLevelRequirement(level, guildId) {
	if (!guildId) {
		throw new Error('guildId is required for level requirement calculation');
	}
	if (level <= 1) return 0;

	const settings = await getLevelingSettings(guildId);
	const baseXP = settings.REQUIREMENTS.BASE_XP;
	const multiplier = settings.REQUIREMENTS.MULTIPLIER;

	if (multiplier === 1) {
		return baseXP * (level - 1);
	} else {
		return (baseXP * (Math.pow(multiplier, level - 1) - 1)) / (multiplier - 1);
	}
}

async function getXpForMessage(guildId) {
	if (!guildId) {
		throw new Error('guildId is required for message XP');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.MESSAGE.XP;
}

function isVoiceStateAFK(voiceState) {
	return !!(voiceState?.selfMute || voiceState?.selfDeaf || voiceState?.serverMute || voiceState?.serverDeaf || voiceState?.mute || voiceState?.deaf);
}

async function hasAFKRecord(serverId, discordMemberId) {
	if (!serverId || !discordMemberId) return false;
	try {
		return !!(await db.getAFKStatus(serverId, discordMemberId));
	} catch {
		return false;
	}
}

async function resolveVoiceAFK(serverId, discordMemberId, voiceState) {
	if (isVoiceStateAFK(voiceState)) return true;
	return await hasAFKRecord(serverId, discordMemberId);
}

function resolveGuildVoiceState(guild, discordUserId) {
	if (!guild || !discordUserId) return null;
	const fromVs = guild.voiceStates?.cache?.get(discordUserId);
	if (fromVs) return fromVs;
	return guild.members.cache.get(discordUserId)?.voice ?? null;
}

function parseLevelRewardedAtMs(value) {
	if (value == null) return null;
	if (value instanceof Date) return value.getTime();
	const parsed = parseMySQLDateTimeUtc(value);
	return parsed ? parsed.getTime() : null;
}

async function getXpForVoiceMinutes(minutes, isAFK = false, guildId) {
	if (!guildId) {
		throw new Error('guildId is required for voice XP');
	}
	if (!minutes || minutes <= 0) return 0;

	const settings = await getLevelingSettings(guildId);
	const afkXPPerMin = Math.max(0, Number(settings.VOICE.AFK_XP_PER_MINUTE) || 0);
	const voiceXPPerMin = Math.max(0, Number(settings.VOICE.XP_PER_MINUTE) || 0);

	if (isAFK) {
		return afkXPPerMin * minutes;
	}
	return voiceXPPerMin * minutes;
}

async function getVideoXpForVoiceTick(minutes, guildId) {
	if (!guildId) throw new Error('guildId is required for video voice XP');
	if (!minutes || minutes <= 0) return 0;
	const settings = await getLevelingSettings(guildId);
	return Math.max(0, Number(settings.VIDEO.XP_PER_MINUTE) || 0) * minutes;
}

async function getStreamingXpForVoiceTick(minutes, guildId) {
	if (!guildId) throw new Error('guildId is required for streaming voice XP');
	if (!minutes || minutes <= 0) return 0;
	const settings = await getLevelingSettings(guildId);
	return Math.max(0, Number(settings.STREAMING.XP_PER_MINUTE) || 0) * minutes;
}

async function getMessageCooldownMs(guildId) {
	if (!guildId) {
		throw new Error('guildId is required for message cooldown');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.MESSAGE.COOLDOWN_SECONDS * 1000;
}

async function getVoiceCooldownMs(guildId) {
	if (!guildId) {
		throw new Error('guildId is required for voice cooldown');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.VOICE.COOLDOWN_SECONDS * 1000;
}

export async function determineLevel(xp = 0, guildId) {
	if (!guildId) {
		throw new Error('guildId is required for level determination');
	}
	if (xp <= 0) return 1;

	let level = 1;
	while (xp >= (await getLevelRequirement(level + 1, guildId))) {
		level += 1;
	}
	return level;
}

async function resolveServerAndMember(guild, memberLike) {
	if (!guild) {
		return { server: null, dbMember: null, guildMember: null };
	}

	try {
		let server;
		try {
			server = await getServerForCurrentBot(guild.id);
		} catch {
			return { server: null, dbMember: null, guildMember: null };
		}

		let guildMember = memberLike;
		const candidateIds = new Set();

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
		const msg = error instanceof Error ? error.message : String(error);
		await logger.log(`❌ Leveling resolve failure for guild ${guild?.id}: ${msg}`);
		return { server: null, dbMember: null, guildMember: null };
	}
}

async function isMemberEligible(guildId, guildMember) {
	if (!guildId || !guildMember) {
		return false;
	}

	return !(guildMember.user?.bot ?? guildMember.bot ?? false);
}

async function countVoiceFriends(guildId, discordMemberId) {
	const guild = clientInstance?.guilds.cache.get(guildId);
	if (!guild) return { count: 0, discordIds: [] };

	const self = resolveGuildVoiceState(guild, discordMemberId);
	const channelId = self?.channelId;
	if (!channelId) return { count: 0, discordIds: [] };

	const discordIds: string[] = [];
	for (const [, vs] of guild.voiceStates.cache) {
		if (vs.channelId !== channelId) continue;
		if (vs.id === discordMemberId) continue;
		const otherMember = vs.member ?? guild.members.cache.get(vs.id);
		if (!otherMember || otherMember.user?.bot) continue;
		discordIds.push(vs.id);
	}
	return { count: discordIds.length, discordIds };
}

function normalizeRankValue(value) {
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
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function normalizeLevelValue(value, fallback = 1) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (value === null || value === undefined) {
		return fallback;
	}
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) {
		return fallback;
	}
	return parsed;
}

function getRankMedal(rank) {
	if (rank === 1) {
		return '🥇';
	}
	if (rank === 2) {
		return '🥈';
	}
	if (rank === 3) {
		return '🥉';
	}
	return null;
}

export async function sendLevelProgressNotification({
	guildId,
	discordMemberId,
	serverName,
	newLevel = null,
	previousRank = null,
	eventType = 'level',
	memberLevelSnapshot = null,
	contextLabel = 'level-change',
	fallbackChannelId = null
} = {}) {
	if (!clientInstance || !guildId || !discordMemberId) {
		return false;
	}

	try {
		const guild = clientInstance.guilds.cache.get(guildId);
		if (!guild) {
			return false;
		}

		const member = await guild.members.fetch(discordMemberId);
		if (!member || !member.user) {
			return false;
		}

		const settings = await getLevelingSettings(guildId);
		const progressChannelId = settings.PROGRESS_CHANNEL_ID || fallbackChannelId;

		if (!progressChannelId) {
			return false;
		}

		const channel = await guild.channels.fetch(progressChannelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			return false;
		}
		if (!channel.permissionsFor(guild.members.me)?.has(['ViewChannel', 'SendMessages'])) {
			return false;
		}

		let server;
		try {
			server = await getServerForCurrentBot(guildId);
		} catch {
			return false;
		}
		const dbMember = await db.getMemberByDiscordId(server.id, discordMemberId);
		if (!dbMember) {
			return false;
		}
		const levelStats = await db.getMemberLevel(dbMember.id);
		if (!levelStats) {
			return false;
		}

		let memberWithRank = memberLevelSnapshot;
		if (!memberWithRank) {
			await db.recalculateServerMemberRanks(server.id);
			memberWithRank = await db.getMemberLevelByDiscordId(server.id, discordMemberId);
		}
		if (!memberWithRank) {
			return false;
		}

		const currentRank = normalizeRankValue(memberWithRank.rank);
		const previousRankValue = normalizeRankValue(previousRank);

		if (eventType === 'rank' && (!previousRankValue || !currentRank || currentRank >= previousRankValue)) {
			return false;
		}

		const slug = await computePublicServerSlugForServerId(Number(server.id));
		const leaderboardUrl = slug ? publicServerUrl(slug, 'leaderboard') : null;

		const totalXp = Number(levelStats.xp ?? 0) || 0;
		const shownLevel = normalizeLevelValue(newLevel ?? memberWithRank.level ?? levelStats.level ?? 1);

		let progressField = null;
		try {
			const floorXp = await getLevelRequirement(shownLevel, guildId);
			const nextXp = await getLevelRequirement(shownLevel + 1, guildId);
			const span = Math.max(1, nextXp - floorXp);
			const ratio = Math.max(0, Math.min(1, (totalXp - floorXp) / span));
			const filled = Math.round(ratio * 10);
			progressField = {
				name: `⚡ Progress to Level ${shownLevel + 1}`,
				value: `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${Math.round(ratio * 100)}%\n**${Math.max(0, nextXp - totalXp).toLocaleString()}** XP to go`,
				inline: false
			};
		} catch (_) {}

		const rankDelta = previousRankValue && currentRank && currentRank < previousRankValue ? previousRankValue - currentRank : 0;
		const rankValue = currentRank ? `#${currentRank}${rankDelta > 0 ? ` (▲${rankDelta})` : ''}` : 'Unranked';

		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
			.setFooter({ text: embedConfig.FOOTER || serverName })
			.setTimestamp();

		if (eventType === 'rank') {
			const medal = getRankMedal(currentRank);
			const titlePrefix = medal ? `${medal} ` : '';
			embed
				.setTitle(`${titlePrefix}Rank Update!`)
				.setDescription(medal ? `${member} just secured a top spot!` : `${member} climbed the leaderboard!`)
				.addFields(
					{ name: 'Previous Rank', value: previousRankValue ? `#${previousRankValue}` : 'Unranked', inline: true },
					{ name: 'New Rank', value: rankValue, inline: true },
					{ name: '📊 Total XP', value: totalXp.toLocaleString(), inline: true }
				);
			if (progressField) embed.addFields(progressField);
		} else {
			embed
				.setTitle('🎉 Level Up!')
				.setDescription(`${member} has reached **Level ${shownLevel}**!`)
				.addFields({ name: '📊 Total XP', value: totalXp.toLocaleString(), inline: true }, { name: '🏆 Rank', value: rankValue, inline: true });
			if (progressField) embed.addFields(progressField);
		}

		const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(guildId, progressChannelId).catch(() => null);
		const content = notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined;

		const progressButtons: ButtonBuilder[] = [];
		if (slug) {
			const accountLabel = await translate('menu.account', guildId, discordMemberId).catch(() => '👤 Account');
			progressButtons.push(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setCustomId('level_my_account').setLabel(accountLabel));
		}
		if (leaderboardUrl) {
			progressButtons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(leaderboardUrl).setLabel('Leaderboard').setEmoji('🌐'));
		}
		const progressRow = progressButtons.length > 0 ? new ActionRowBuilder<ButtonBuilder>().addComponents(...progressButtons) : null;

		await channel.send({
			content,
			embeds: [embed],
			components: progressRow ? [progressRow] : undefined
		});

		if (notificationMentions && notificationMentions.length > 1) {
			for (let i = 1; i < notificationMentions.length; i++) {
				await channel.send({ content: notificationMentions[i] }).catch(() => null);
			}
		}
		const typeLabel = eventType === 'rank' ? 'rank' : 'level';
		await logger.log(`⭐ Sent ${typeLabel} notification (${contextLabel}) to channel ${progressChannelId} for ${discordMemberId} in ${serverName}`);
		return true;
	} catch (error) {
		await logger.log(`⚠️ Failed to send progress notification (${contextLabel}) to ${discordMemberId}: ${error.message}`);
		return false;
	}
}

async function deriveBaselineLevel({ previousLevel, previousXp, storedLevel }, guildId) {
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

async function handleLevelEvaluation(server, dbMember, currentStats, guildId, context = {}) {
	if (!server || !dbMember || !currentStats) {
		return currentStats;
	}

	const { previousLevel = null, previousXp = null, previousRank: contextPreviousRank = null, reason = 'unknown', sourceChannelId = null } = context;
	const rawXp = currentStats.xp ?? 0;
	const xpForLevel = typeof rawXp === 'bigint' ? Number(rawXp) : typeof rawXp === 'string' ? parseFloat(rawXp) || 0 : Number(rawXp) || 0;
	const expectedLevel = await determineLevel(xpForLevel, guildId);

	let storedLevel = currentStats.level;
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
	if (storedLevel !== expectedLevel) {
		const updatedStats = await db.updateMemberLevelStats(dbMember.id, { level: expectedLevel });
		if (updatedStats) {
			finalStats = updatedStats;
			let lv = updatedStats.level;
			if (typeof lv === 'bigint') lv = Number(lv);
			storedLevel = typeof lv === 'number' && !Number.isNaN(lv) ? lv : expectedLevel;
		}
		const memberName = dbMember.display_name || dbMember.username || dbMember.discord_member_id || 'Unknown member';
		await logger.log(`⭐ Level stored update (${reason}): ${memberName} -> level ${expectedLevel} in ${server.name}`);
	}

	let memberLevelSnapshot = null;
	let currentRank = null;
	if (dbMember.discord_member_id) {
		await db.recalculateServerMemberRanks(server.id);
		memberLevelSnapshot = await db.getMemberLevelByDiscordId(server.id, dbMember.discord_member_id);
		currentRank = normalizeRankValue(memberLevelSnapshot?.rank);
	}
	const rankImproved = normalizedPreviousRank !== null && currentRank !== null && currentRank < normalizedPreviousRank;

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
				fallbackChannelId: sourceChannelId
			});
		}
	} else if (dbMember.discord_member_id && rankImproved) {
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

export async function evaluateMemberLevelAndRank(guildId, memberId, context = {}) {
	try {
		if (!guildId || !memberId) return null;
		let server;
		try {
			server = await getServerForCurrentBot(guildId);
		} catch {
			return null;
		}
		const dbMember = await db.getServerMemberById(memberId);
		if (!dbMember || Number(dbMember.server_id) !== Number(server.id)) return null;
		const currentStats = await db.getMemberLevel(memberId);
		if (!currentStats) return null;
		return await handleLevelEvaluation(server, dbMember, currentStats, guildId, { reason: 'items', ...context });
	} catch (error) {
		await logger.log(`⚠️ evaluateMemberLevelAndRank failed for member ${memberId}: ${error.message}`);
		return null;
	}
}

const XP_LOG_EMOJI = {
	Chat: '💬',
	Voice: '🎤',
	'AFK Voice': '🔇',
	Video: '📹',
	Streaming: '📡'
};

const XP_LOG_SOURCE: Record<string, string> = {
	Chat: 'chat',
	Voice: 'voice',
	'AFK Voice': 'voice_afk',
	Video: 'video',
	Streaming: 'stream'
};

const disguisedCache = new Map<string, { ids: Set<number>; at: number }>();
const DISGUISE_CACHE_MS = 10_000;

async function isMemberDisguised(guild: any, memberId: any): Promise<boolean> {
	if (!guild?.id || !memberId) return false;
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

function fmtRate(n: any): string {
	const v = Number(n) || 0;
	return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

function luckRateLabel(total: any, luckPercent: any): string {
	const t = Number(total) || 0;
	const luck = Math.max(0, Number(luckPercent) || 0);
	return luck > 0 ? `${fmtRate(t)}% (${fmtRate(t - luck)} +${fmtRate(luck)} 🍀)` : `${fmtRate(t)}%`;
}

async function sendXPLogToChannel(guild, dbMember, xpGained, xpType, award: any = null, stats: any = null) {
	try {
		await db
			.logMemberLevelGain(dbMember.id, {
				source: XP_LOG_SOURCE[xpType] ?? String(xpType).toLowerCase(),
				xp: xpGained,
				xp_total: stats?.xp != null ? Number(stats.xp) : null,
				level: stats?.level != null ? Number(stats.level) : null,
				rank: stats?.rank != null ? Number(stats.rank) : null,
				multiplier: award?.boosted ? award.multiplier : null,
				skim_percent: award?.leeched ? award.skimPercent : null,
				friend_percent: award?.friendBoosted ? award.friendPercent : null,
				luck_percent: award?.victimLuckPercent > 0 ? award.victimLuckPercent : null
			})
			.catch(() => null);

		if (await isMemberDisguised(guild, dbMember.id)) return;

		const settings = await getLevelingSettings(guild.id);
		if (!settings.PROGRESS_CHANNEL_ID) return;

		const channel = await guild.channels.fetch(settings.PROGRESS_CHANNEL_ID).catch(() => null);
		if (!channel) return;

		const memberName = dbMember.server_display_name || dbMember.display_name || dbMember.username || 'Unknown';
		const emoji = XP_LOG_EMOJI[xpType] ?? '⭐';
		const boostSuffix = award?.boosted ? ` (${award.multiplier}× Boost ⚡)` : '';
		const friendSuffix = award?.friendBoosted ? ` (+${luckRateLabel(award.friendPercent, award.luckPercent)} Friend boost 🤝)` : '';
		const leechSuffix = award?.leeched ? ` (−${luckRateLabel(award.skimPercent, 0)} Leech 🩸)` : '';
		const logMessage = `${emoji} ${xpType} XP: ${memberName} gained +${xpGained} XP${boostSuffix}${friendSuffix}${leechSuffix}`;

		await channel.send(logMessage);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await logger.log(`⚠️ Failed to send XP log to channel: ${msg}`);
	}
}

async function announceLeechCredits(guild, victim, credits) {
	try {
		if (!guild || !Array.isArray(credits) || credits.length === 0) return;
		const settings = await getLevelingSettings(guild.id);
		if (!settings.PROGRESS_CHANNEL_ID) return;
		const channel = await guild.channels.fetch(settings.PROGRESS_CHANNEL_ID).catch(() => null);
		if (!channel) return;

		if (await isMemberDisguised(guild, victim?.id)) return;

		const victimName = victim?.server_display_name || victim?.display_name || victim?.username || 'a member';
		for (const credit of credits) {
			if (!credit?.amount || credit.amount <= 0) continue;
			const b = credit.beneficiary;
			if (await isMemberDisguised(guild, b?.id)) continue;
			const attackerName = b?.server_display_name || b?.display_name || b?.username || 'A leecher';
			const attackerLuck = await getActiveLuckPercent(credit.beneficiaryMemberId).catch(() => 0);
			const pct = credit.percent != null ? ` (${luckRateLabel(credit.percent, attackerLuck)})` : '';
			await channel.send(`🩸 Leech: ${attackerName} siphoned +${credit.amount} XP from ${victimName}${pct}`).catch(() => null);
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await logger.log(`⚠️ Failed to announce leech credits: ${msg}`);
	}
}

async function handleReactionChange(reaction, user, delta) {
	try {
		if (!reaction || user?.bot) return;

		if (reaction.partial) {
			try {
				reaction = await reaction.fetch();
			} catch {
				return;
			}
		}

		const guild = reaction.message?.guild;
		if (!guild) return;
		if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.leveling))) return;

		const fetchedMember = await guild.members.fetch({ user: user.id, cache: true }).catch(() => null);
		if (!fetchedMember) return;

		const { dbMember, guildMember } = await resolveServerAndMember(guild, fetchedMember);
		if (!dbMember || !guildMember) return;
		if (!(await isMemberEligible(guild.id, guildMember))) return;

		await db.ensureMemberLevel(dbMember.id);
		await db.updateMemberLevelStats(dbMember.id, { reactionsIncrement: delta });
	} catch (error) {
		await logger.log(`⚠️ Reaction tracking error: ${error.message}`);
	}
}

async function handleMessageCreate(message) {
	try {
		if (!message?.guild || message.author?.bot) return;
		if (!(await isComponentFeatureEnabled(message.guild.id, serverSettingsComponent.leveling))) return;

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

		const eligible = await isMemberEligible(message.guild.id, guildMember);
		if (!eligible) {
			return;
		}

		await db.ensureMemberLevel(dbMember.id);
		const previousStats = await db.getMemberLevel(dbMember.id);
		const baseXp = await getXpForMessage(guildId);
		const award = await applyAwardEffects(dbMember.id, baseXp, 'message', guildId);
		const { memberXp, leechCredits } = award;
		const stats = await db.updateMemberLevelStats(dbMember.id, {
			chatIncrement: 1,
			xpIncrement: memberXp,
			chatRewardedAt: message.createdAt ? new Date(message.createdAt) : new Date()
		});
		const leechApplied = await creditLeechers(leechCredits, guildId);

		await sendXPLogToChannel(message.guild, dbMember, memberXp, 'Chat', award, stats);
		await announceLeechCredits(message.guild, dbMember, leechApplied);

		await handleLevelEvaluation(server, dbMember, stats, message.guild.id, {
			previousLevel: previousStats?.level ?? null,
			previousXp: previousStats?.xp ?? null,
			previousRank: previousStats?.rank ?? null,
			reason: 'message',
			sourceChannelId: message.channel?.id ?? null
		});
	} catch (error) {
		await logger.log(`❌ Leveling message handler error: ${error.message}`);
	}
}

async function awardVoiceXP(server, dbMember, guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId = null) {
	const lockKey = `${guildId}:${dbMember.id}`;
	if (voiceAwardLocks.has(lockKey)) return null;
	voiceAwardLocks.add(lockKey);
	try {
		return await awardVoiceXPLocked(server, dbMember, guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId);
	} finally {
		voiceAwardLocks.delete(lockKey);
	}
}

async function awardVoiceXPLocked(server, dbMember, guildId, reason, previousStats, buckets, mediaFlags, voiceChannelId = null) {
	const { isAFK, voiceMinutes, videoMinutes, streamMinutes } = buckets;
	const vm = Math.max(0, Math.floor(Number(voiceMinutes) || 0));
	const vid = Math.max(0, Math.floor(Number(videoMinutes) || 0));
	const strm = Math.max(0, Math.floor(Number(streamMinutes) || 0));
	if (vm <= 0 && vid <= 0 && strm <= 0) return null;

	const oldStats = previousStats || (await db.getMemberLevel(dbMember.id));
	const baseXp = await getXpForVoiceMinutes(vm, isAFK, guildId);
	const videoXp = await getVideoXpForVoiceTick(vid, guildId);
	const streamXp = await getStreamingXpForVoiceTick(strm, guildId);
	const rawXpGained = baseXp + videoXp + streamXp;
	const award = await applyAwardEffects(dbMember.id, rawXpGained, 'voice', guildId);
	const { memberXp: baseAwardXp, leechCredits } = award;

	const { count: friendCount, discordIds: friendDiscordIds } = await countVoiceFriends(guildId, dbMember.discord_member_id);
	const luckPercent = await getActiveLuckPercent(dbMember.id);
	const friendPercent = friendCount * 10 + luckPercent;
	const friendBonus = Math.floor((baseAwardXp * friendPercent) / 100);
	const xpGained = baseAwardXp + friendBonus;
	(award as any).friendPercent = friendPercent;
	(award as any).friendBoosted = friendPercent > 0;
	(award as any).luckPercent = luckPercent;

	if (friendDiscordIds.length > 0) {
		const perFriendXp = Math.floor(friendBonus / friendDiscordIds.length);
		db.recordLevelFriends(dbMember.id, friendDiscordIds, perFriendXp, Math.max(vm, vid, strm)).catch(() => null);
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
	if (discordGuild) {
		const rate = rawXpGained > 0 ? xpGained / rawXpGained : 1;
		const shown = (bucket: number) => Math.max(0, Math.round(bucket * rate));
		if (baseXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, shown(baseXp), isAFK ? 'AFK Voice' : 'Voice', award, stats);
		}
		if (videoXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, shown(videoXp), 'Video', award, stats);
		}
		if (streamXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, shown(streamXp), 'Streaming', award, stats);
		}
		await announceLeechCredits(discordGuild, dbMember, leechApplied);
	}

	return await handleLevelEvaluation(server, dbMember, stats, guildId, {
		previousLevel: oldStats?.level ?? null,
		previousXp: oldStats?.xp ?? null,
		previousRank: oldStats?.rank ?? null,
		reason,
		sourceChannelId: voiceChannelId
	});
}

async function syncVoiceMediaBaselines(dbMemberId, mediaFlags, lastVideoMs, lastStreamMs) {
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

async function handleVoiceMediaOnlyUpdate(oldState, newState) {
	try {
		const guild = newState.guild;
		if (!guild?.id) return;
		if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.leveling))) return;

		const memberLike = newState.member ?? (newState.id ? { id: newState.id } : null);
		if (!memberLike) return;

		const { server, dbMember, guildMember } = await resolveServerAndMember(guild, memberLike);
		if (!server || !dbMember || !guildMember) return;

		const eligible = await isMemberEligible(guild.id, guildMember);
		if (!eligible) return;

		const selfVideo = !!newState.selfVideo;
		const streaming = !!newState.streaming;
		await db.updateMemberLevelStats(dbMember.id, {
			isInVideo: selfVideo,
			isInStream: streaming,
			...(oldState.selfVideo !== newState.selfVideo ? { videoRewardedAt: new Date() } : {}),
			...(oldState.streaming !== newState.streaming ? { streamRewardedAt: new Date() } : {})
		});
	} catch (error) {
		await logger.log(`❌ Leveling voice media update error: ${error.message}`);
	}
}

async function startVoiceSession(state, resumed = false) {
	try {
		if (!state?.channelId || !state.guild) return;
		if (!(await isComponentFeatureEnabled(state.guild.id, serverSettingsComponent.leveling))) return;

		const memberLike = state.member ?? (state.id ? { id: state.id } : null);
		if (!memberLike) return;

		const { server, dbMember, guildMember } = await resolveServerAndMember(state.guild, memberLike);
		if (!server || !dbMember || !guildMember) return;

		const eligible = await isMemberEligible(state.guild.id, guildMember);
		if (!eligible) return;

		await db.ensureMemberLevel(dbMember.id);
		const levelData = await db.getMemberLevel(dbMember.id);
		const wasMarkedInVoice = !!levelData?.is_in_voice;
		const dbInVideo = !!levelData?.is_in_video;
		const dbInStream = !!levelData?.is_in_stream;

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
		const voiceAfkForXp = await resolveVoiceAFK(server.id, guildMember.id, state);
		const mediaFlags = { selfVideo: !!state.selfVideo, streaming: !!state.streaming };

		let finalLastRewardedAt = lastVoiceMs || now;

		if (lastVoiceMs === null) {
			await db.updateMemberLevelStats(dbMember.id, {
				isInVoice: true,
				voiceRewardedAt: new Date(),
				isInVideo: mediaFlags.selfVideo,
				isInStream: mediaFlags.streaming,
				videoRewardedAt: new Date(),
				streamRewardedAt: new Date()
			});
			finalLastRewardedAt = now;
		} else {
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: true });
		}

		if (resumed && wasMarkedInVoice && lastVoiceMs !== null) {
			const mVoice = Math.max(0, Math.floor((now - lastVoiceMs) / 60000));
			const rawVideo = state.selfVideo && dbInVideo && lastVideoMs !== null ? Math.max(0, Math.floor((now - lastVideoMs) / 60000)) : 0;
			const rawStream = state.streaming && dbInStream && lastStreamMs !== null ? Math.max(0, Math.floor((now - lastStreamMs) / 60000)) : 0;
			const mVideo = mVoice > 0 ? Math.min(mVoice, rawVideo) : 0;
			const mStream = mVoice > 0 ? Math.min(mVoice, rawStream) : 0;
			if ((mVoice > 0 || mVideo > 0 || mStream > 0) && (await db.claimVoiceRewardWindow(dbMember.id, voiceCooldownMs))) {
				await awardVoiceXP(
					server,
					dbMember,
					guildId,
					'voice-resume-catchup',
					levelData,
					{
						isAFK: voiceAfkForXp,
						voiceMinutes: mVoice,
						videoMinutes: mVideo,
						streamMinutes: mStream
					},
					mediaFlags,
					state.channelId
				);
				finalLastRewardedAt = now;
			}
		} else if (lastVoiceMs !== null && (await db.claimVoiceRewardWindow(dbMember.id, voiceCooldownMs))) {
			await awardVoiceXP(
				server,
				dbMember,
				guildId,
				resumed && wasMarkedInVoice ? 'voice-resume-interval' : 'voice-start-interval',
				levelData,
				{
					isAFK: voiceAfkForXp,
					voiceMinutes: 1,
					videoMinutes: state.selfVideo ? 1 : 0,
					streamMinutes: state.streaming ? 1 : 0
				},
				mediaFlags,
				state.channelId
			);
			finalLastRewardedAt = now;
		}

		await syncVoiceMediaBaselines(dbMember.id, mediaFlags, lastVideoMs, lastStreamMs);

		const tickInterval = Math.min(Math.max(voiceCooldownMs || 1000, 1000), 5000);
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
		await logger.log(`❌ Leveling voice session start error: ${error.message}`);
	}
}

async function endVoiceSession(state) {
	try {
		const guild = state.guild;
		if (!guild) return;

		const memberId = state.member?.id || state.id;
		if (!memberId) return;

		const sessionKey = `${guild.id}:${memberId}`;
		const session = voiceSessions.get(sessionKey);

		if (session && session.interval) {
			clearInterval(session.interval);
		}

		voiceSessions.delete(sessionKey);

		let server;
		try {
			server = await getServerForCurrentBot(guild.id);
		} catch {
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
		await logger.log(`❌ Leveling voice session end error: ${error.message}`);
	}
}

async function handleVoiceTick(sessionKey) {
	const session = voiceSessions.get(sessionKey);
	if (!session) return;

	try {
		if (!(await isComponentFeatureEnabled(session.guildId, serverSettingsComponent.leveling))) {
			if (session.interval) clearInterval(session.interval);
			voiceSessions.delete(sessionKey);
			await db.updateMemberLevelStats(session.memberId, { isInVoice: false });
			return;
		}

		let server;
		try {
			server = await getServerForCurrentBot(session.guildId);
		} catch {
			return;
		}

		const dbMember = await db.getMemberByDiscordId(server.id, session.discordMemberId);
		if (!dbMember) return;

		const guildId = session.guildId;
		const voiceCooldownMs = await getVoiceCooldownMs(guildId);

		if (!(await db.claimVoiceRewardWindow(dbMember.id, voiceCooldownMs))) return;

		const guild = clientInstance?.guilds.cache.get(session.guildId);
		const voiceState = resolveGuildVoiceState(guild, session.discordMemberId);
		const voiceAfkForXp = await resolveVoiceAFK(server.id, session.discordMemberId, voiceState);

		const levelSnapshot = await db.getMemberLevel(dbMember.id);
		const serverInfo = { id: session.serverId, name: session.serverName };

		const mf = { selfVideo: !!voiceState?.selfVideo, streaming: !!voiceState?.streaming };
		await awardVoiceXP(
			serverInfo,
			dbMember,
			guildId,
			'voice-tick',
			levelSnapshot,
			{
				isAFK: voiceAfkForXp,
				voiceMinutes: 1,
				videoMinutes: mf.selfVideo ? 1 : 0,
				streamMinutes: mf.streaming ? 1 : 0
			},
			mf,
			voiceState?.channelId ?? session.channelId ?? null
		);
	} catch (error) {
		await logger.log(`❌ Leveling voice tick error: ${error.message}`);
	}
}

async function recalculateAllMemberLevels(client) {
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
		let totalRecalculated = 0;
		let totalFixed = 0;

		for (const server of servers) {
			try {
				const guild = client.guilds.cache.get(server.discord_server_id);
				if (!guild) {
					continue;
				}

				const members = await db.getServerMembersList(server.id);
				if (!members || members.length === 0) {
					continue;
				}

				let serverRecalculated = 0;
				let serverFixed = 0;

				for (const member of members) {
					if (!member.id || !member.xp) {
						continue;
					}

					const levelData = await db.getMemberLevel(member.id);
					if (!levelData) {
						continue;
					}

					const currentLevel = levelData.level ?? 1;
					const expectedLevel = await determineLevel(levelData.xp ?? 0, guild.id);

					if (currentLevel !== expectedLevel) {
						await db.updateMemberLevelStats(member.id, { level: expectedLevel });
						serverFixed++;
						totalFixed++;
					}
					serverRecalculated++;
					totalRecalculated++;
				}

				if (serverRecalculated > 0) {
					await db.recalculateServerMemberRanks(server.id);
					await logger.log(`✅ Recalculated ${serverRecalculated} member(s) in ${server.name} (${serverFixed} level(s) corrected)`);
				}
			} catch (error) {
				await logger.log(`❌ Error recalculating levels for server ${server.name}: ${error.message}`);
			}
		}

		await logger.log(`✅ Level recalculation complete: ${totalRecalculated} member(s) checked, ${totalFixed} level(s) corrected`);
	} catch (error) {
		await logger.log(`❌ Error during level recalculation: ${error.message}`);
	}
}

export async function resumeLevelingVoiceForGuild(client, guild) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id || !guild) return;

		const activeVoiceMemberIds = new Set();

		for (const [, voiceState] of guild.voiceStates.cache) {
			if (!voiceState.channelId || !voiceState.id) continue;
			activeVoiceMemberIds.add(voiceState.id);
			try {
				await startVoiceSession(voiceState, true);
			} catch (err) {
				await logger.log(`❌ Leveling: failed to resume voice session for ${voiceState.id}: ${err.message}`);
			}
		}

		let server;
		try {
			server = await getServerForCurrentBot(guild.id);
		} catch {
			server = null;
		}
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
		await logger.log(`❌ Leveling resume guild error (${guild?.id}): ${error.message}`);
	}
}

export async function stopLevelingVoiceSessionsForGuild(guildDiscordId) {
	if (!guildDiscordId) return;
	const prefix = `${guildDiscordId}:`;
	let server;
	try {
		server = await getServerForCurrentBot(guildDiscordId);
	} catch {
		server = null;
	}
	for (const [sessionKey, session] of [...voiceSessions.entries()]) {
		if (!sessionKey.startsWith(prefix)) continue;
		if (session?.interval) clearInterval(session.interval);
		voiceSessions.delete(sessionKey);

		if (!server) continue;
		const dbMember = await db.getMemberByDiscordId(server.id, session.discordMemberId);
		if (dbMember) {
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: false, isInVideo: false, isInStream: false });
		}
	}
	await logger.log(`🔇 Leveling: Stopped voice XP timers for guild ${guildDiscordId}`);
}

export async function syncLevelingRuntime(client, guildDiscordId, enabled) {
	if (!client || !guildDiscordId) return;
	if (enabled) {
		let guild = client.guilds.cache.get(guildDiscordId);
		if (!guild) {
			guild = await client.guilds.fetch(guildDiscordId).catch(() => null);
		}
		if (guild) await resumeLevelingVoiceForGuild(client, guild);
	} else {
		await stopLevelingVoiceSessionsForGuild(guildDiscordId);
	}
}

async function resumeVoiceSessions(client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id) return;

		for (const guild of client.guilds.cache.values()) {
			await resumeLevelingVoiceForGuild(client, guild);
		}
	} catch (error) {
		await logger.log(`❌ Leveling resume error: ${error.message}`);
	}
}

function init(client) {
	clientInstance = client;
	client.on('messageCreate', handleMessageCreate);
	client.on('messageReactionAdd', (reaction, user) => handleReactionChange(reaction, user, 1));
	client.on('messageReactionRemove', (reaction, user) => handleReactionChange(reaction, user, -1));

	if (client.isReady()) {
		resumeVoiceSessions(client);
		setTimeout(() => recalculateAllMemberLevels(client), 5000);
	} else {
		client.once('ready', () => {
			resumeVoiceSessions(client);
			setTimeout(() => recalculateAllMemberLevels(client), 5000);
		});
	}

	client.on('voiceStateUpdate', async (oldState, newState) => {
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
			await logger.log(`❌ Leveling voice state update error: ${error.message}`);
		}
	});
}

export default { init };
