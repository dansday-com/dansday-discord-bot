import { EmbedBuilder } from 'discord.js';
import { getEmbedConfig, getBotConfig, MODERATION_CONFIG, NOTIFICATIONS } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';

export const MODERATION_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns'] as const;

const ACTION_TITLES: Record<string, string> = {
	warn: '⚠️ Member Warned',
	timeout: '🔇 Member Timed Out',
	untimeout: '🔊 Timeout Removed',
	kick: '👢 Member Kicked',
	ban: '🔨 Member Banned',
	tempban: '⏳ Member Temporarily Banned',
	unban: '🕊️ Member Unbanned',
	unwarn: '🧹 Warning Removed',
	clearwarns: '🧹 Warnings Cleared',
	tempban_expired: '⌛ Tempban Expired'
};

const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;
const SWEEP_MS = 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function clip(text: string, max = 1024) {
	return text.length > max ? text.substring(0, max - 3) + '...' : text;
}

export function formatDuration(seconds: number | null | undefined) {
	if (!seconds || seconds <= 0) return null;
	const units: [number, string][] = [
		[86400, 'd'],
		[3600, 'h'],
		[60, 'm']
	];
	const parts: string[] = [];
	let rest = Math.floor(seconds);
	for (const [size, label] of units) {
		const n = Math.floor(rest / size);
		if (n > 0) {
			parts.push(`${n}${label}`);
			rest -= n * size;
		}
	}
	if (parts.length === 0) parts.push(`${rest}s`);
	return parts.join(' ');
}

export function parseDuration(input: string | null | undefined) {
	if (!input) return null;
	let total = 0;
	const re = /(\d+)\s*([smhdw]?)/gi;
	let match;
	let found = false;
	while ((match = re.exec(String(input))) !== null) {
		found = true;
		const n = Number(match[1]);
		const unit = (match[2] || 'm').toLowerCase();
		total += n * ({ s: 1, m: 60, h: 3600, d: 86400, w: 604800 }[unit] ?? 60);
	}
	return found && total > 0 ? total : null;
}

async function memberLabel(serverId: number, discordId: string | null | undefined) {
	if (!discordId) return null;
	const row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	return row ? row.server_display_name || row.display_name || row.username || null : null;
}

async function resolveMemberRow(serverId: number, guild: any, discordId: string) {
	let row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	if (row) return row;
	const live = await guild.members.fetch(discordId).catch(() => null);
	const source = live ?? (await guild.client.users.fetch(discordId).catch(() => null));
	if (!source) return null;
	await db.upsertMember(serverId, source).catch(() => null);
	row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	return row;
}

async function recordCase(
	client: any,
	guild: any,
	serverId: number,
	opts: {
		action: string;
		targetId: string;
		staffId?: string | null;
		staffName?: string | null;
		reason?: string | null;
		durationSeconds?: number | null;
		source: string;
		active?: boolean;
		logAction?: string;
		extraFields?: { name: string; value: string; inline?: boolean }[];
	}
) {
	const memberRow = await resolveMemberRow(serverId, guild, opts.targetId);
	if (!memberRow) return null;
	const staffRow = opts.staffId ? await resolveMemberRow(serverId, guild, opts.staffId) : null;
	const expiresAt = opts.durationSeconds ? new Date(Date.now() + opts.durationSeconds * 1000) : null;
	const caseNumber = await db.createModerationLog({
		server_id: serverId,
		member_id: Number(memberRow.id),
		staff_member_id: staffRow ? Number(staffRow.id) : null,
		action: opts.action,
		reason: opts.reason || null,
		duration_seconds: opts.durationSeconds ?? null,
		expires_at: expiresAt,
		active: opts.active ?? ['warn', 'timeout', 'ban', 'tempban'].includes(opts.action),
		source: opts.source
	});

	const memberName = memberRow.server_display_name || memberRow.display_name || memberRow.username || opts.targetId;
	const staffName = (staffRow && (staffRow.server_display_name || staffRow.display_name || staffRow.username)) || opts.staffName || 'Unknown';
	const fields = [
		{ name: '👤 Member', value: `<@${opts.targetId}> (${memberName})`, inline: true },
		{ name: '🛡️ Staff', value: staffRow ? `<@${opts.staffId}> (${staffName})` : staffName, inline: true },
		{ name: '📍 Source', value: opts.source, inline: true },
		{ name: '📝 Reason', value: clip(opts.reason || 'No reason provided'), inline: false }
	];
	const duration = formatDuration(opts.durationSeconds);
	if (duration && expiresAt) {
		fields.push({ name: '⏱️ Duration', value: `${duration} (ends <t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`, inline: false });
	}
	if (opts.action === 'warn' || opts.action === 'unwarn' || opts.action === 'clearwarns') {
		const active = await db.countActiveWarnings(Number(memberRow.id)).catch(() => 0);
		fields.push({ name: '📊 Active Warnings', value: String(active), inline: true });
	}
	if (opts.extraFields) fields.push(...opts.extraFields);

	await sendModerationLog(
		client,
		{
			title: `${ACTION_TITLES[opts.logAction ?? opts.action] ?? opts.action} · Case #${caseNumber}`,
			description: `Case **#${caseNumber}** recorded for <@${opts.targetId}>.`,
			thumbnail: memberRow.avatar || null,
			userTag: memberName,
			fields
		},
		guild.id
	);
	return { caseNumber, memberRow };
}

async function notifyMember(user: any, guild: any, action: string, reason: string | null, durationSeconds: number | null) {
	if (!user || user.bot) return;
	const lines = [`**Server:** ${guild.name}`, `**Reason:** ${reason || 'No reason provided'}`];
	const duration = formatDuration(durationSeconds);
	if (duration) lines.push(`**Duration:** ${duration}`);
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? 0xc0392b)
		.setTitle(ACTION_TITLES[action] ?? action)
		.setDescription(lines.join('\n'))
		.setTimestamp();
	await user.send({ embeds: [embed] }).catch(() => null);
}

export async function performModerationAction(
	client: any,
	payload: {
		guild_id: string;
		action: string;
		target_id?: string;
		staff_id?: string | null;
		staff_name?: string | null;
		reason?: string | null;
		duration_seconds?: number | null;
		case_number?: number | null;
		source?: string;
	}
) {
	const action = String(payload.action || '');
	if (!(MODERATION_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: 'Unknown moderation action' };

	const guild = client.guilds.cache.get(String(payload.guild_id));
	if (!guild) return { ok: false, error: 'Bot is not in this server' };

	const botConfig = getBotConfig();
	const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
	if (!server) return { ok: false, error: 'Server not found' };
	const serverId = Number(server.id);
	const source = payload.source || 'panel';
	const reason = payload.reason ? String(payload.reason).trim().slice(0, 1000) : null;
	const staffId = payload.staff_id ? String(payload.staff_id) : null;

	if (action === 'unwarn') {
		const row = payload.case_number ? await db.getModerationCase(serverId, Number(payload.case_number)) : null;
		if (!row || row.action !== 'warn') return { ok: false, error: 'Warning case not found' };
		if (!(await db.revokeModerationCase(row.id))) return { ok: false, error: 'Warning is already removed' };
		const logged = await recordCase(client, guild, serverId, {
			action,
			targetId: row.discord_member_id,
			staffId,
			staffName: payload.staff_name,
			reason: reason || `Removed warning #${row.case_number}`,
			source,
			active: false
		});
		return { ok: true, case_number: logged?.caseNumber ?? null };
	}

	const targetId = String(payload.target_id || '').trim();
	if (!/^\d{15,25}$/.test(targetId)) return { ok: false, error: 'Select a member' };
	if (targetId === client.user.id) return { ok: false, error: 'The bot cannot moderate itself' };
	if (staffId && staffId === targetId) return { ok: false, error: 'You cannot moderate yourself' };

	if (action === 'clearwarns') {
		const memberRow = await resolveMemberRow(serverId, guild, targetId);
		if (!memberRow) return { ok: false, error: 'Member not found' };
		const cleared = await db.endActiveModeration(Number(memberRow.id), ['warn'], true);
		if (!cleared) return { ok: false, error: 'Member has no active warnings' };
		const logged = await recordCase(client, guild, serverId, {
			action,
			targetId,
			staffId,
			staffName: payload.staff_name,
			reason: reason || `Cleared ${cleared} warning(s)`,
			source,
			active: false
		});
		return { ok: true, case_number: logged?.caseNumber ?? null, cleared };
	}

	const member = await guild.members.fetch(targetId).catch(() => null);
	const needsMember = ['warn', 'timeout', 'untimeout', 'kick'].includes(action);
	if (needsMember && !member) return { ok: false, error: 'Member is not in the server' };

	if (member) {
		if (member.id === guild.ownerId) return { ok: false, error: 'The server owner cannot be moderated' };
		if (member.user?.bot) return { ok: false, error: 'Bots cannot be moderated' };
		if (staffId) {
			const staff = await guild.members.fetch(staffId).catch(() => null);
			if (staff && staff.id !== guild.ownerId && staff.roles.highest.position <= member.roles.highest.position) {
				return { ok: false, error: 'That member has an equal or higher role than you' };
			}
		}
		if ((action === 'timeout' || action === 'untimeout') && !member.moderatable)
			return { ok: false, error: "The bot's role is too low to time out this member" };
		if (action === 'kick' && !member.kickable) return { ok: false, error: "The bot's role is too low to kick this member" };
		if ((action === 'ban' || action === 'tempban') && !member.bannable) return { ok: false, error: "The bot's role is too low to ban this member" };
	}

	let durationSeconds = payload.duration_seconds ? Math.floor(Number(payload.duration_seconds)) : null;
	if (action === 'timeout') {
		if (!durationSeconds || durationSeconds < 60) return { ok: false, error: 'Timeout needs a duration of at least 1 minute' };
		durationSeconds = Math.min(durationSeconds, MAX_TIMEOUT_SECONDS);
	} else if (action === 'tempban') {
		if (!durationSeconds || durationSeconds < 60) return { ok: false, error: 'Tempban needs a duration of at least 1 minute' };
	} else {
		durationSeconds = null;
	}

	const auditReason = clip(`${reason || 'No reason provided'} · by ${payload.staff_name || 'staff'} via ${source}`, 512);
	const user = member?.user ?? (await client.users.fetch(targetId).catch(() => null));
	if (user?.bot) return { ok: false, error: 'Bots cannot be moderated' };

	try {
		if (action === 'warn') {
			await notifyMember(user, guild, action, reason, null);
		} else if (action === 'timeout') {
			await member.timeout(durationSeconds! * 1000, auditReason);
			await notifyMember(user, guild, action, reason, durationSeconds);
		} else if (action === 'untimeout') {
			if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp < Date.now()) {
				return { ok: false, error: 'Member is not timed out' };
			}
			await member.timeout(null, auditReason);
		} else if (action === 'kick') {
			await notifyMember(user, guild, action, reason, null);
			await member.kick(auditReason);
		} else if (action === 'ban' || action === 'tempban') {
			if (member) await notifyMember(user, guild, action, reason, durationSeconds);
			await guild.members.ban(targetId, { reason: auditReason, deleteMessageSeconds: 0 });
		} else if (action === 'unban') {
			const existing = await guild.bans.fetch(targetId).catch(() => null);
			if (!existing) return { ok: false, error: 'User is not banned' };
			await guild.members.unban(targetId, auditReason);
		}
	} catch (err: any) {
		await logger.log(`❌ Moderation ${action} failed for ${targetId}: ${err.message}`);
		return { ok: false, error: `Discord rejected the ${action}: ${err.message}` };
	}

	const memberRow = await resolveMemberRow(serverId, guild, targetId);
	if (memberRow) {
		if (action === 'untimeout') await db.endActiveModeration(Number(memberRow.id), ['timeout'], true);
		if (action === 'unban') await db.endActiveModeration(Number(memberRow.id), ['ban', 'tempban'], true);
		if (action === 'timeout') await db.endActiveModeration(Number(memberRow.id), ['timeout']);
		if (action === 'ban' || action === 'tempban') await db.endActiveModeration(Number(memberRow.id), ['ban', 'tempban']);
	}

	const logged = await recordCase(client, guild, serverId, {
		action,
		targetId,
		staffId,
		staffName: payload.staff_name,
		reason,
		durationSeconds,
		source
	});
	await logger.log(`🛡️ Moderation ${action} on ${targetId} in ${guild.id} via ${source} (case #${logged?.caseNumber ?? '?'})`);
	return { ok: true, case_number: logged?.caseNumber ?? null };
}

async function sweepModeration(client: any) {
	const botConfig = getBotConfig();
	if (!botConfig?.id) return;
	await db.expireModerationTimeouts().catch(() => null);
	const due = await db.getDueTempbans(Number(botConfig.id)).catch(() => []);
	for (const row of due) {
		const guild = client.guilds.cache.get(String(row.discord_server_id));
		if (!guild) continue;
		await guild.members.unban(String(row.discord_member_id), `Tempban case #${row.case_number} expired`).catch(() => null);
		await db.revokeModerationCase(row.id).catch(() => null);
		await recordCase(client, guild, Number(row.server_id), {
			action: 'unban',
			logAction: 'tempban_expired',
			targetId: String(row.discord_member_id),
			staffName: 'Automatic',
			reason: `Tempban case #${row.case_number} expired`,
			source: 'auto',
			active: false
		}).catch(() => null);
	}
}

export function initModerationSweeper(client: any) {
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = setInterval(() => {
		sweepModeration(client).catch((err) => logger.log(`❌ Moderation sweep failed: ${err.message}`));
	}, SWEEP_MS);
}

export function stopModerationSweeper() {
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = null;
}

async function recordNativeCase(
	client: any,
	guild: any,
	action: string,
	targetId: string,
	executorId: string | null,
	reason: string | null,
	durationSeconds: number | null = null
) {
	if (executorId && executorId === client.user.id) return;
	const botConfig = getBotConfig();
	if (!botConfig?.id) return;
	const server = await db.getServerByDiscordId(botConfig.id, guild.id);
	if (!server) return;
	const serverId = Number(server.id);
	const memberRow = await resolveMemberRow(serverId, guild, targetId);
	if (memberRow) {
		if (action === 'unban') await db.endActiveModeration(Number(memberRow.id), ['ban', 'tempban'], true);
		if (action === 'untimeout') await db.endActiveModeration(Number(memberRow.id), ['timeout'], true);
		if (action === 'timeout') await db.endActiveModeration(Number(memberRow.id), ['timeout']);
	}
	await recordCase(client, guild, serverId, {
		action,
		targetId,
		staffId: executorId,
		staffName: (await memberLabel(serverId, executorId)) || 'Unknown',
		reason,
		durationSeconds,
		source: 'discord'
	});
}

async function sendModerationLog(client, embedData, guildId = null) {
	if (!guildId) return;
	const logChannelId = await MODERATION_CONFIG.getLogChannel(guildId);
	if (!logChannelId) return;
	const channel = client.channels.cache.get(logChannelId);
	if (!channel) {
		await logger.log(`❌ Moderation log channel not found: ${logChannelId}`);
		return;
	}

	try {
		const embedConfig = await getEmbedConfig(guildId);
		const embed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(embedData.title)
			.setDescription(embedData.description)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		if (embedData.thumbnail) {
			embed.setThumbnail(embedData.thumbnail);
		}

		if (embedData.fields && embedData.fields.length > 0) {
			embed.addFields(embedData.fields);
		}

		const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(guildId, logChannelId).catch(() => null);
		await channel.send({
			content: notificationMentions && notificationMentions.length > 0 ? notificationMentions[0] : undefined,
			embeds: [embed]
		});

		if (notificationMentions && notificationMentions.length > 1) {
			for (let i = 1; i < notificationMentions.length; i++) {
				await channel.send({ content: notificationMentions[i] }).catch(() => null);
			}
		}

		await logger.log(`✅ Sent moderation log: ${embedData.title} for ${embedData.userTag || 'unknown'}`);
	} catch (err) {
		await logger.log(`❌ Failed to send moderation log: ${err.message}`);
	}
}

async function getAuditLogEntry(guild, action, targetId) {
	try {
		const auditLogs = await guild.fetchAuditLogs({
			limit: 1,
			type: action
		});

		const entry = auditLogs.entries.first();
		if (entry && entry.target.id === targetId) {
			return entry;
		}
		return null;
	} catch (err) {
		await logger.log(`⚠️ Could not fetch audit log for ${action}: ${err.message}`);
		return null;
	}
}

function init(client) {
	client.on('guildBanAdd', async (ban) => {
		try {
			const { guild, user } = ban;
			const auditEntry = await getAuditLogEntry(guild, 22, user.id);
			await recordNativeCase(client, guild, 'ban', user.id, auditEntry?.executor?.id ?? null, ban.reason || auditEntry?.reason || null);
		} catch (err) {
			await logger.log(`❌ Error handling ban: ${err.message}`);
		}
	});

	client.on('guildBanRemove', async (ban) => {
		try {
			const { guild, user } = ban;
			const auditEntry = await getAuditLogEntry(guild, 23, user.id);
			await recordNativeCase(client, guild, 'unban', user.id, auditEntry?.executor?.id ?? null, auditEntry?.reason || null);
		} catch (err) {
			await logger.log(`❌ Error handling unban: ${err.message}`);
		}
	});

	client.on('guildMemberUpdate', async (oldMember, newMember) => {
		try {
			const before = oldMember.communicationDisabledUntilTimestamp ?? null;
			const after = newMember.communicationDisabledUntilTimestamp ?? null;
			if (before === after) return;
			const now = Date.now();
			const timedOut = after !== null && after > now;
			const wasTimedOut = before !== null && before > now;
			if (!timedOut && !wasTimedOut) return;
			const auditEntry = await getAuditLogEntry(newMember.guild, 24, newMember.id);
			if (timedOut) {
				await recordNativeCase(
					client,
					newMember.guild,
					'timeout',
					newMember.id,
					auditEntry?.executor?.id ?? null,
					auditEntry?.reason || null,
					Math.max(60, Math.round((after - now) / 1000))
				);
			} else {
				await recordNativeCase(client, newMember.guild, 'untimeout', newMember.id, auditEntry?.executor?.id ?? null, auditEntry?.reason || null);
			}
		} catch (err) {
			await logger.log(`❌ Error handling timeout change: ${err.message}`);
		}
	});

	client.on('guildMemberRemove', async (member) => {
		try {
			const banEntry = await getAuditLogEntry(member.guild, 22, member.user.id);
			if (banEntry && Date.now() - banEntry.createdTimestamp < 5000) return;
			const kickEntry = await getAuditLogEntry(member.guild, 20, member.user.id);
			if (!kickEntry || Date.now() - kickEntry.createdTimestamp > 10000) return;
			await recordNativeCase(client, member.guild, 'kick', member.user.id, kickEntry.executor?.id ?? null, kickEntry.reason || null);
		} catch (err) {
			await logger.log(`❌ Error handling member remove: ${err.message}`);
		}
	});
}

export default { init };
