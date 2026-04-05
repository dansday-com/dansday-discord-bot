import {
	getLevelingSettings,
	PERMISSIONS,
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

const recentMessages = new Map();
const voiceSessions = new Map();
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

async function getExperienceForMessage(guildId) {
	if (!guildId) {
		throw new Error('guildId is required for message XP');
	}
	const settings = await getLevelingSettings(guildId);
	return settings.MESSAGE.XP;
}

function isVoiceStateAFK(voiceState) {
	return !!(voiceState?.selfMute || voiceState?.selfDeaf);
}

function resolveGuildVoiceState(guild, discordUserId) {
	if (!guild || !discordUserId) return null;
	const fromVs = guild.voiceStates?.cache?.get(discordUserId);
	if (fromVs) return fromVs;
	return guild.members.cache.get(discordUserId)?.voice ?? null;
}

async function getExperienceForVoiceMinutes(minutes, isAFK = false, guildId) {
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

export async function determineLevel(experience = 0, guildId) {
	if (!guildId) {
		throw new Error('guildId is required for level determination');
	}
	if (experience <= 0) return 1;

	let level = 1;
	while (experience >= (await getLevelRequirement(level + 1, guildId))) {
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

async function getMemberRoleIds(guildId) {
	try {
		const permissions = await PERMISSIONS.getPermissions(guildId);
		const roles = permissions?.MEMBER_ROLES || [];
		return roles;
	} catch {
		return [];
	}
}

async function isMemberEligible(guildId, guildMember) {
	if (!guildId || !guildMember) {
		return false;
	}

	const memberRoles = await getMemberRoleIds(guildId);
	if (!memberRoles || memberRoles.length === 0) {
		return false;
	}

	try {
		return await PERMISSIONS.hasAnyRole(guildMember, memberRoles);
	} catch {
		return false;
	}
}

function normalizeRankValue(value) {
	if (value === null || value === undefined) {
		return null;
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

export async function sendLevelChangeDM(guildId, discordMemberId, serverName, newLevel, contextLabel = 'level-change') {
	if (!clientInstance || !guildId || !discordMemberId || !newLevel) {
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

		const dmChannel = await member.user.createDM();

		const embedConfig = await getEmbedConfig(guildId);
		const dmEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle('🎉 Congratulations!')
			.setDescription(`You've reached **Level ${newLevel}** in **${serverName}**!\n\nKeep up the great work! 🚀`)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();

		let dmLeaderboardUrl: string | null = null;
		if (await isComponentFeatureEnabled(guildId, serverSettingsComponent.public_statistics)) {
			try {
				const srv = await getServerForCurrentBot(guildId);
				const slug = await computePublicServerSlugForServerId(Number(srv.id));
				if (slug) dmLeaderboardUrl = publicServerUrl(slug, 'leaderboard');
			} catch (_) {}
		}
		if (dmLeaderboardUrl) dmEmbed.setURL(dmLeaderboardUrl);

		const dmRow = dmLeaderboardUrl
			? new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(dmLeaderboardUrl).setLabel('Web leaderboard').setEmoji('🌐')
				)
			: null;

		await dmChannel.send({
			embeds: [dmEmbed],
			components: dmRow ? [dmRow] : undefined
		});
		await logger.log(`⭐ Sent level change DM (${contextLabel}) to ${discordMemberId} for level ${newLevel} in ${serverName}`);
		return true;
	} catch (error) {
		await logger.log(`⚠️ Failed to send level change DM (${contextLabel}) to ${discordMemberId}: ${error.message}`);
		return false;
	}
}

export async function sendLevelProgressNotification({
	guildId,
	discordMemberId,
	serverName,
	newLevel = null,
	previousRank = null,
	eventType = 'level',
	memberLevelSnapshot = null,
	contextLabel = 'level-change'
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
		const progressChannelId = settings.PROGRESS_CHANNEL_ID;

		if (!progressChannelId) {
			return false;
		}

		const channel = await guild.channels.fetch(progressChannelId);
		if (!channel || !channel.isTextBased()) {
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

		let leaderboardUrl: string | null = null;
		if (await isComponentFeatureEnabled(guildId, serverSettingsComponent.public_statistics)) {
			const slug = await computePublicServerSlugForServerId(Number(server.id));
			if (slug) leaderboardUrl = publicServerUrl(slug, 'leaderboard');
		}

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
					{ name: 'New Rank', value: currentRank ? `#${currentRank}` : 'Unranked', inline: true }
				);
		} else {
			const snapshotLevel = normalizeLevelValue(newLevel ?? memberWithRank.level ?? levelStats.level ?? 1);
			embed
				.setTitle('🎉 Level Up!')
				.setDescription(`${member} has reached **Level ${snapshotLevel}**!`)
				.addFields(
					{ name: '📊 Total XP', value: `${(levelStats.experience ?? 0).toLocaleString()}`, inline: true },
					{ name: '🏆 Rank', value: currentRank ? `#${currentRank}` : 'Unranked', inline: true }
				);
		}

		if (leaderboardUrl) embed.setURL(leaderboardUrl);

		const notificationRoleId = await NOTIFICATIONS.getNotificationRoleIdForChannel(guildId, progressChannelId).catch(() => null);
		const content = notificationRoleId ? `<@&${notificationRoleId}>` : undefined;

		const progressRow = leaderboardUrl
			? new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(leaderboardUrl).setLabel('Web leaderboard').setEmoji('🌐')
				)
			: null;

		await channel.send({
			content,
			embeds: [embed],
			components: progressRow ? [progressRow] : undefined
		});
		const typeLabel = eventType === 'rank' ? 'rank' : 'level';
		await logger.log(`⭐ Sent ${typeLabel} notification (${contextLabel}) to channel ${progressChannelId} for ${discordMemberId} in ${serverName}`);
		return true;
	} catch (error) {
		await logger.log(`⚠️ Failed to send progress notification (${contextLabel}) to ${discordMemberId}: ${error.message}`);
		return false;
	}
}

async function deriveBaselineLevel({ previousLevel, previousExperience, storedLevel }, guildId) {
	if (typeof previousLevel === 'number' && !Number.isNaN(previousLevel)) {
		return previousLevel;
	}

	if (typeof previousExperience === 'number' && !Number.isNaN(previousExperience)) {
		try {
			return await determineLevel(previousExperience, guildId);
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

	const { previousLevel = null, previousExperience = null, previousRank: contextPreviousRank = null, reason = 'unknown' } = context;
	const expectedLevel = await determineLevel(currentStats.experience || 0, guildId);

	let storedLevel = currentStats.level;
	if (typeof storedLevel === 'string') {
		const parsed = parseInt(storedLevel, 10);
		storedLevel = Number.isNaN(parsed) ? null : parsed;
	} else if (typeof storedLevel !== 'number' || Number.isNaN(storedLevel)) {
		storedLevel = null;
	}

	const baselineLevel = await deriveBaselineLevel({ previousLevel, previousExperience, storedLevel }, guildId);
	const normalizedPreviousRank = normalizeRankValue(contextPreviousRank);
	let memberLevelSnapshot = null;
	let currentRank = null;
	if (dbMember.discord_member_id) {
		await db.recalculateServerMemberRanks(server.id);
		memberLevelSnapshot = await db.getMemberLevelByDiscordId(server.id, dbMember.discord_member_id);
		currentRank = normalizeRankValue(memberLevelSnapshot?.rank);
	}
	const rankImproved = normalizedPreviousRank !== null && currentRank !== null && currentRank < normalizedPreviousRank;

	let finalStats = currentStats;
	if (storedLevel !== expectedLevel) {
		const updatedStats = await db.updateMemberLevelStats(dbMember.id, { level: expectedLevel });
		if (updatedStats) {
			finalStats = updatedStats;
			storedLevel = updatedStats.level ?? expectedLevel;
		}
		const memberName = dbMember.display_name || dbMember.username || dbMember.discord_member_id || 'Unknown member';
		await logger.log(`⭐ Level stored update (${reason}): ${memberName} -> level ${expectedLevel} in ${server.name}`);
	}

	const dmPreference = finalStats?.dm_notifications_enabled;
	const notificationsEnabled = !(dmPreference === false || dmPreference === 0);

	if (expectedLevel > baselineLevel) {
		const memberName = dbMember.server_display_name || dbMember.display_name || dbMember.username || dbMember.discord_member_id || 'Unknown member';

		if (dbMember.discord_member_id) {
			await sendLevelProgressNotification({
				guildId,
				discordMemberId: dbMember.discord_member_id,
				serverName: server.name,
				newLevel: expectedLevel,
				previousRank: normalizedPreviousRank,
				memberLevelSnapshot,
				contextLabel: `level-eval:${reason}`
			});
		}

		if (!notificationsEnabled) {
			await logger.log(`🔕 Level up detected (${reason}) for ${memberName} but DM notifications are disabled`);
		} else if (dbMember.discord_member_id) {
			await sendLevelChangeDM(guildId, dbMember.discord_member_id, server.name, expectedLevel, `level-eval:${reason}`);
		}
	} else if (dbMember.discord_member_id && rankImproved) {
		await sendLevelProgressNotification({
			guildId,
			discordMemberId: dbMember.discord_member_id,
			serverName: server.name,
			previousRank: normalizedPreviousRank,
			memberLevelSnapshot,
			eventType: 'rank',
			contextLabel: `rank-eval:${reason}`
		});
	}

	return finalStats;
}

const XP_LOG_EMOJI = {
	Chat: '💬',
	Voice: '🎤',
	'AFK Voice': '🔇',
	Video: '📹',
	Streaming: '📡'
};

async function sendXPLogToChannel(guild, dbMember, xpGained, xpType) {
	try {
		const settings = await getLevelingSettings(guild.id);
		if (!settings.PROGRESS_CHANNEL_ID) return;

		const channel = await guild.channels.fetch(settings.PROGRESS_CHANNEL_ID).catch(() => null);
		if (!channel) return;

		const memberName = dbMember.server_display_name || dbMember.display_name || dbMember.username || 'Unknown';
		const emoji = XP_LOG_EMOJI[xpType] ?? '⭐';
		const logMessage = `${emoji} ${xpType} XP: ${memberName} gained +${xpGained} XP`;

		await channel.send(logMessage);
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await logger.log(`⚠️ Failed to send XP log to channel: ${msg}`);
	}
}

async function handleMessageCreate(message) {
	try {
		if (!message?.guild || message.author?.bot) return;
		if (!(await isComponentFeatureEnabled(message.guild.id, serverSettingsComponent.leveling))) return;

		const now = Date.now();
		const cooldownKey = `${message.guild.id}:${message.author.id}`;
		const lastMessageAt = recentMessages.get(cooldownKey);
		const guildId = message.guild.id;

		const messageCooldownMs = await getMessageCooldownMs(guildId);
		if (messageCooldownMs > 0 && lastMessageAt && now - lastMessageAt < messageCooldownMs) {
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
		const xpGained = await getExperienceForMessage(guildId);
		const stats = await db.updateMemberLevelStats(dbMember.id, {
			chatIncrement: 1,
			experienceIncrement: xpGained,
			chatRewardedAt: message.createdAt ? new Date(message.createdAt) : new Date()
		});

		await sendXPLogToChannel(message.guild, dbMember, xpGained, 'Chat');

		await handleLevelEvaluation(server, dbMember, stats, message.guild.id, {
			previousLevel: previousStats?.level ?? null,
			previousExperience: previousStats?.experience ?? null,
			previousRank: previousStats?.rank ?? null,
			reason: 'message'
		});
		recentMessages.set(cooldownKey, now);
	} catch (error) {
		await logger.log(`❌ Leveling message handler error: ${error.message}`);
	}
}

async function awardVoiceXP(server, dbMember, minutes, isAFK, guildId, reason, previousStats = null, voiceState = null) {
	const oldStats = previousStats || (await db.getMemberLevel(dbMember.id));
	const baseXp = await getExperienceForVoiceMinutes(minutes, isAFK, guildId);
	const applyMediaBonuses = reason !== 'voice-resume-catchup';
	let videoXp = 0;
	let streamXp = 0;
	if (applyMediaBonuses && voiceState) {
		if (voiceState.selfVideo) {
			videoXp = await getVideoXpForVoiceTick(minutes, guildId);
		}
		if (voiceState.streaming) {
			streamXp = await getStreamingXpForVoiceTick(minutes, guildId);
		}
	}
	const xpGained = baseXp + videoXp + streamXp;

	const updates = {
		experienceIncrement: xpGained,
		voiceRewardedAt: new Date(),
		isInVoice: true
	};
	if (isAFK) {
		updates.voiceMinutesAfkIncrement = minutes;
	} else {
		updates.voiceMinutesActiveIncrement = minutes;
	}
	if (applyMediaBonuses && voiceState?.selfVideo) {
		updates.voiceMinutesVideoIncrement = minutes;
	}
	if (applyMediaBonuses && voiceState?.streaming) {
		updates.voiceMinutesStreamingIncrement = minutes;
	}

	const stats = await db.updateMemberLevelStats(dbMember.id, updates);

	const discordGuild = clientInstance?.guilds.cache.get(guildId);
	if (discordGuild) {
		if (baseXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, baseXp, isAFK ? 'AFK Voice' : 'Voice');
		}
		if (videoXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, videoXp, 'Video');
		}
		if (streamXp > 0) {
			await sendXPLogToChannel(discordGuild, dbMember, streamXp, 'Streaming');
		}
	}

	return await handleLevelEvaluation(server, dbMember, stats, guildId, {
		previousLevel: oldStats?.level ?? null,
		previousExperience: oldStats?.experience ?? null,
		previousRank: oldStats?.rank ?? null,
		reason
	});
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
		let lastRewardedAtMs = null;
		if (levelData?.voice_rewarded_at) {
			if (levelData.voice_rewarded_at instanceof Date) {
				lastRewardedAtMs = levelData.voice_rewarded_at.getTime();
			} else {
				const parsedDate = parseMySQLDateTimeUtc(levelData.voice_rewarded_at);
				lastRewardedAtMs = parsedDate ? parsedDate.getTime() : null;
			}
		}

		const sessionKey = `${state.guild.id}:${guildMember.id}`;
		const existingSession = voiceSessions.get(sessionKey);
		if (existingSession?.interval) {
			clearInterval(existingSession.interval);
		}

		const now = Date.now();
		const guildId = state.guild.id;
		const voiceCooldownMs = await getVoiceCooldownMs(guildId);

		if (lastRewardedAtMs === null) {
			await db.updateMemberLevelStats(dbMember.id, {
				isInVoice: true,
				voiceRewardedAt: new Date()
			});
		} else {
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: true });
		}

		let finalLastRewardedAt = lastRewardedAtMs || now;

		const voiceAfkForXp = isVoiceStateAFK(state);

		if (resumed && wasMarkedInVoice && lastRewardedAtMs !== null) {
			const minutesSinceReward = Math.max(0, Math.floor((now - lastRewardedAtMs) / 60000));
			if (minutesSinceReward > 0) {
				await awardVoiceXP(server, dbMember, minutesSinceReward, voiceAfkForXp, guildId, 'voice-resume-catchup', levelData, state);
				finalLastRewardedAt = now;
			}
		} else if (lastRewardedAtMs !== null && now - lastRewardedAtMs >= voiceCooldownMs) {
			await awardVoiceXP(
				server,
				dbMember,
				1,
				voiceAfkForXp,
				guildId,
				resumed && wasMarkedInVoice ? 'voice-resume-interval' : 'voice-start-interval',
				levelData,
				state
			);
			finalLastRewardedAt = now;
		}

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
		const now = Date.now();
		const lastRewardedAt = session.lastRewardedAt || 0;

		if (now - lastRewardedAt < voiceCooldownMs) return;

		const guild = clientInstance?.guilds.cache.get(session.guildId);
		const voiceState = resolveGuildVoiceState(guild, session.discordMemberId);
		const voiceAfkForXp = isVoiceStateAFK(voiceState);

		const levelSnapshot = await db.getMemberLevel(dbMember.id);
		const serverInfo = { id: session.serverId, name: session.serverName };

		await awardVoiceXP(serverInfo, dbMember, 1, voiceAfkForXp, guildId, 'voice-tick', levelSnapshot, voiceState);
		session.lastRewardedAt = now;
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
					if (!member.id || !member.experience) {
						continue;
					}

					const levelData = await db.getMemberLevel(member.id);
					if (!levelData) {
						continue;
					}

					const currentLevel = levelData.level ?? 1;
					const expectedLevel = await determineLevel(levelData.experience ?? 0, guild.id);

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
					await db.updateMemberLevelStats(memberId, { isInVoice: false });
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
			await db.updateMemberLevelStats(dbMember.id, { isInVoice: false });
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
			}
		} catch (error) {
			await logger.log(`❌ Leveling voice state update error: ${error.message}`);
		}
	});
}

export default { init };
