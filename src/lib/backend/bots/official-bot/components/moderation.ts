import { AuditLogEvent, EmbedBuilder } from 'discord.js';
import { getEmbedConfig, getBotConfig, MODERATION_CONFIG } from '../../../config.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { escalationStepFor, MODERATION_REASON_MAX_LENGTH } from '../../../../moderation-rules.js';
import { errorReasonFor, memberTranslator, serverTranslator, translatorFor, type Translator } from '../i18n.js';
import { parseLocalizedDuration } from '../localizedInput.js';
import type { APIEmbedField, GuildBan, GuildMember, GuildTextBasedChannel, PartialGuildMember, Client, Guild, Role, User } from 'discord.js';
import { notifiedMentions, sendMentionOverflow } from './notifiedMentions.js';
import { MINUTE_MS, SECOND_MS, DAY_SECONDS, HOUR_SECONDS, MINUTE_SECONDS } from '../../../../utils/time.js';
import { DISCORD_LIMITS, truncateToLimit } from '../../../../discordLimits.js';

export const MODERATION_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns'] as const;
export const BULK_MODERATION_ACTIONS = ['role_add', 'role_remove'] as const;

const ACTION_TITLE_KEYS = new Set(['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'unban', 'unwarn', 'clearwarns', 'tempban_expired']);
const LOG_SOURCE_KEYS = new Set(['panel', 'menu', 'discord', 'auto']);

function actionTitle(tr: Translator, action: string) {
	return ACTION_TITLE_KEYS.has(action) ? tr(`moderation.caseLog.titles.${action}`) : action;
}

function sourceLabel(tr: Translator, source: string) {
	return LOG_SOURCE_KEYS.has(source) ? tr(`moderation.caseLog.sources.${source}`) : source;
}

const BULK_TITLES: Record<string, string> = {
	role_add: '➕ Bulk Role Add',
	role_remove: '➖ Bulk Role Remove'
};

const WARN_EXPIRY_SWEEP_MINUTES = 15;
const WARN_EXPIRY_SWEEP_MS = WARN_EXPIRY_SWEEP_MINUTES * MINUTE_MS;
const bulkRunning = new Set<string>();
let lastWarnExpirySweep = 0;

const MAX_TIMEOUT_DAYS = 28;
const MAX_TIMEOUT_SECONDS = MAX_TIMEOUT_DAYS * DAY_SECONDS;
const SWEEP_MS = MINUTE_MS;
const MODERATION_FALLBACK_COLOR = 0xc0392b;
const MIN_DURATION_SECONDS = MINUTE_SECONDS;
const BAN_AUDIT_WINDOW_SECONDS = 5;
const KICK_AUDIT_WINDOW_SECONDS = 10;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export function formatDuration(tr: Translator, seconds: number | null | undefined) {
	if (!seconds || seconds <= 0) {
		return null;
	}
	const units: [number, string][] = [
		[DAY_SECONDS, 'd'],
		[HOUR_SECONDS, 'h'],
		[MINUTE_SECONDS, 'm']
	];
	const parts: string[] = [];
	let rest = Math.floor(seconds);
	for (const [size, unit] of units) {
		const n = Math.floor(rest / size);
		if (n > 0) {
			parts.push(tr(`moderation.durationUnits.${unit}`, { n }));
			rest -= n * size;
		}
	}
	if (parts.length === 0) {
		parts.push(tr('moderation.durationUnits.s', { n: rest }));
	}
	return parts.join(' ');
}

export function parseDuration(input: string | null | undefined) {
	return parseLocalizedDuration(input);
}

async function memberLabel(serverId: number, discordId: string | null | undefined) {
	if (!discordId) {
		return null;
	}
	const row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	return row ? row.server_display_name || row.display_name || row.username || null : null;
}

async function resolveMemberRow(serverId: number, guild: Guild, discordId: string) {
	let row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	if (row) {
		return row;
	}
	const live = await guild.members.fetch(discordId).catch(() => null);
	const source = live ?? (await guild.client.users.fetch(discordId).catch(() => null));
	if (!source) {
		return null;
	}
	await db.upsertMember(serverId, source).catch(() => null);
	row = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	return row;
}

type ModerationLogEmbed = {
	title: string;
	description: string;
	thumbnail?: string | null;
	userTag?: string | null;
	mentionId?: string | null;
	fields?: APIEmbedField[];
};

type CaseServer = { guild: Guild; serverId: number };

async function recordCase(
	client: Client,
	{ guild, serverId }: CaseServer,
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
	if (!memberRow) {
		return null;
	}
	const staffRow = opts.staffId ? await resolveMemberRow(serverId, guild, opts.staffId) : null;
	const expiresAt = opts.durationSeconds ? new Date(Date.now() + opts.durationSeconds * SECOND_MS) : null;
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

	const tr = await serverTranslator(guild.id);
	const memberName = memberRow.server_display_name || memberRow.display_name || memberRow.username || opts.targetId;
	const staffName =
		(staffRow && (staffRow.server_display_name || staffRow.display_name || staffRow.username)) || opts.staffName || tr('moderation.caseLog.unknown');
	const fields: APIEmbedField[] = [
		{ name: tr('moderation.caseLog.fields.member'), value: `<@${opts.targetId}> (${memberName})`, inline: true },
		{ name: tr('moderation.caseLog.fields.staff'), value: staffRow ? `<@${opts.staffId}> (${staffName})` : staffName, inline: true },
		{ name: tr('moderation.caseLog.fields.source'), value: sourceLabel(tr, opts.source), inline: true },
		{
			name: tr('moderation.caseLog.fields.reason'),
			value: truncateToLimit(opts.reason || tr('moderation.caseLog.noReason'), DISCORD_LIMITS.EMBED_FIELD_VALUE),
			inline: false
		}
	];
	const duration = formatDuration(tr, opts.durationSeconds);
	if (duration && expiresAt) {
		fields.push({
			name: tr('moderation.caseLog.fields.duration'),
			value: tr('moderation.caseLog.durationValue', { duration, ends: `<t:${Math.floor(expiresAt.getTime() / SECOND_MS)}:R>` }),
			inline: false
		});
	}
	if (opts.action === 'warn' || opts.action === 'unwarn' || opts.action === 'clearwarns') {
		const active = await db.countActiveWarnings(Number(memberRow.id)).catch(() => 0);
		fields.push({ name: tr('moderation.caseLog.fields.activeWarnings'), value: String(active), inline: true });
	}
	if (opts.extraFields) {
		fields.push(...opts.extraFields);
	}

	await sendModerationLog(
		client,
		{
			title: tr('moderation.caseLog.title', { action: actionTitle(tr, opts.logAction ?? opts.action), case: caseNumber }),
			description: tr('moderation.caseLog.description', { case: caseNumber, member: `<@${opts.targetId}>` }),
			thumbnail: memberRow.avatar || null,
			userTag: memberName,
			mentionId: opts.targetId,
			fields
		},
		guild.id
	);
	return { caseNumber, memberRow };
}

type ModerationNotice = { action: string; reason: string | null; durationSeconds: number | null };

async function notifyMember(user: User, guild: Guild, { action, reason, durationSeconds }: ModerationNotice) {
	if (!user || user.bot) {
		return;
	}
	const tr = await memberTranslator(guild.id, user.id);
	const lines = [
		tr('moderation.memberDm.server', { server: guild.name }),
		tr('moderation.memberDm.reason', { reason: reason || tr('moderation.caseLog.noReason') })
	];
	const duration = formatDuration(tr, durationSeconds);
	if (duration) {
		lines.push(tr('moderation.memberDm.duration', { duration }));
	}
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? MODERATION_FALLBACK_COLOR)
		.setTitle(actionTitle(tr, action))
		.setDescription(lines.join('\n'))
		.setTimestamp();
	await user.send({ embeds: [embed] }).catch(() => null);
}

export type ModerationResult =
	{ ok: true; case_number: number | null; cleared?: number; escalated?: { action: string; case_number: number | null } } | { ok: false; error: string };

type ModerationPayload = {
	guild_id: string;
	action: string;
	target_id?: string;
	staff_id?: string | null;
	staff_name?: string | null;
	reason?: string | null;
	duration_seconds?: number | null;
	case_number?: number | null;
	source?: string;
};
type ModerationFailure = { ok: false; error: string };
type ModerationContext = CaseServer & {
	client: Client;
	tr: Translator;
	action: string;
	source: string;
	reason: string | null;
	staffId: string | null;
	payload: ModerationPayload;
};
type DiscordAction = { ctx: ModerationContext; member: GuildMember | null; targetId: string; durationSeconds: number | null; auditReason: string };

const failure = (error: string): ModerationFailure => ({ ok: false, error });

const BOT_ROLE_CHECKS: { actions: string[]; isAllowed: (member: GuildMember) => boolean; verb: string }[] = [
	{ actions: ['timeout', 'untimeout'], isAllowed: (member) => member.moderatable, verb: 'time out' },
	{ actions: ['kick'], isAllowed: (member) => member.kickable, verb: 'kick' },
	{ actions: ['ban', 'tempban'], isAllowed: (member) => member.bannable, verb: 'ban' }
];

const ENDS_ACTIVE: Record<string, { kinds: string[]; isRevoked: boolean }> = {
	untimeout: { kinds: ['timeout'], isRevoked: true },
	unban: { kinds: ['ban', 'tempban'], isRevoked: true },
	timeout: { kinds: ['timeout'], isRevoked: false },
	ban: { kinds: ['ban', 'tempban'], isRevoked: false },
	tempban: { kinds: ['ban', 'tempban'], isRevoked: false }
};

const notice = ({ ctx, member }: DiscordAction, durationSeconds: number | null) =>
	member ? notifyMember(member.user, ctx.guild, { action: ctx.action, reason: ctx.reason, durationSeconds }) : Promise.resolve();

const DISCORD_ACTIONS: Record<string, (input: DiscordAction) => Promise<string | null>> = {
	warn: async (input) => {
		await notice(input, null);
		return null;
	},
	timeout: async (input) => {
		await input.member!.timeout(input.durationSeconds! * SECOND_MS, input.auditReason);
		await notice(input, input.durationSeconds);
		return null;
	},
	untimeout: async ({ member, auditReason }) => {
		if (!member!.communicationDisabledUntilTimestamp || member!.communicationDisabledUntilTimestamp < Date.now()) {
			return 'Member is not timed out';
		}
		await member!.timeout(null, auditReason);
		return null;
	},
	kick: async (input) => {
		await notice(input, null);
		await input.member!.kick(input.auditReason);
		return null;
	},
	ban: async (input) => {
		await notice(input, input.durationSeconds);
		await input.ctx.guild.members.ban(input.targetId, { reason: input.auditReason, deleteMessageSeconds: 0 });
		return null;
	},
	unban: async ({ ctx, targetId, auditReason }) => {
		if (!(await ctx.guild.bans.fetch(targetId).catch(() => null))) {
			return 'User is not banned';
		}
		await ctx.guild.members.unban(targetId, auditReason);
		return null;
	}
};
DISCORD_ACTIONS.tempban = DISCORD_ACTIONS.ban;

async function moderationContext(client: Client, payload: ModerationPayload): Promise<ModerationContext | ModerationFailure> {
	const action = String(payload.action || '');
	if (!(MODERATION_ACTIONS as readonly string[]).includes(action)) {
		return failure('Unknown moderation action');
	}
	const guild = client.guilds.cache.get(String(payload.guild_id));
	if (!guild) {
		return failure('Bot is not in this server');
	}
	const botConfig = getBotConfig();
	const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
	if (!server) {
		return failure('Server not found');
	}
	return {
		client,
		guild,
		serverId: Number(server.id),
		tr: await serverTranslator(guild.id),
		action,
		source: payload.source || 'panel',
		reason: payload.reason ? String(payload.reason).trim().slice(0, MODERATION_REASON_MAX_LENGTH) : null,
		staffId: payload.staff_id ? String(payload.staff_id) : null,
		payload
	};
}

function caseOptions(ctx: ModerationContext, targetId: string) {
	return { action: ctx.action, targetId, staffId: ctx.staffId, staffName: ctx.payload.staff_name, source: ctx.source };
}

async function revokeWarning(ctx: ModerationContext): Promise<ModerationResult> {
	const row = ctx.payload.case_number ? await db.getModerationCase(ctx.serverId, Number(ctx.payload.case_number)) : null;
	if (!row || row.action !== 'warn') {
		return failure('Warning case not found');
	}
	if (!(await db.revokeModerationCase(row.id))) {
		return failure('Warning is already removed');
	}
	const logged = await recordCase(ctx.client, ctx, {
		...caseOptions(ctx, row.discord_member_id),
		reason: ctx.reason || ctx.tr('moderation.caseLog.reasons.unwarn', { case: row.case_number }),
		active: false
	});
	return { ok: true, case_number: logged?.caseNumber ?? null };
}

function targetRejection(ctx: ModerationContext, targetId: string): string | null {
	if (!/^\d{15,25}$/.test(targetId)) {
		return 'Select a member';
	}
	if (targetId === ctx.client.user?.id) {
		return 'The bot cannot moderate itself';
	}
	return ctx.staffId && ctx.staffId === targetId ? 'You cannot moderate yourself' : null;
}

async function clearWarnings(ctx: ModerationContext, targetId: string): Promise<ModerationResult> {
	const memberRow = await resolveMemberRow(ctx.serverId, ctx.guild, targetId);
	if (!memberRow) {
		return failure('Member not found');
	}
	const cleared = await db.endActiveModeration(Number(memberRow.id), ['warn'], true);
	if (!cleared) {
		return failure('Member has no active warnings');
	}
	const logged = await recordCase(ctx.client, ctx, {
		...caseOptions(ctx, targetId),
		reason: ctx.reason || ctx.tr('moderation.caseLog.reasons.clearwarns', { count: cleared }),
		active: false
	});
	return { ok: true, case_number: logged?.caseNumber ?? null, cleared };
}

async function memberRejection(ctx: ModerationContext, member: GuildMember): Promise<string | null> {
	if (member.id === ctx.guild.ownerId) {
		return 'The server owner cannot be moderated';
	}
	if (member.user?.bot) {
		return 'Bots cannot be moderated';
	}
	const staff = ctx.staffId ? await ctx.guild.members.fetch(ctx.staffId).catch(() => null) : null;
	if (staff && staff.id !== ctx.guild.ownerId && staff.roles.highest.position <= member.roles.highest.position) {
		return 'That member has an equal or higher role than you, so only someone above them can do this';
	}
	const check = BOT_ROLE_CHECKS.find((candidate) => candidate.actions.includes(ctx.action));
	if (check && !check.isAllowed(member)) {
		return `The bot's role is too low to ${check.verb} this member. Move the bot's role above theirs in Server Settings → Roles`;
	}
	return null;
}

function moderationDuration(action: string, raw: number | null | undefined): { seconds: number | null } | { error: string } {
	const seconds = raw ? Math.floor(Number(raw)) : null;
	if (action !== 'timeout' && action !== 'tempban') {
		return { seconds: null };
	}
	if (!seconds || seconds < MIN_DURATION_SECONDS) {
		return { error: action === 'timeout' ? 'Timeout needs a duration of at least 1 minute' : 'Tempban needs a duration of at least 1 minute' };
	}
	return { seconds: action === 'timeout' ? Math.min(seconds, MAX_TIMEOUT_SECONDS) : seconds };
}

async function syncActiveModeration(ctx: ModerationContext, targetId: string) {
	const ends = ENDS_ACTIVE[ctx.action];
	const memberRow = ends ? await resolveMemberRow(ctx.serverId, ctx.guild, targetId) : null;
	if (memberRow) {
		await db.endActiveModeration(Number(memberRow.id), ends.kinds, ends.isRevoked);
	}
}

async function moderationPrecheck(
	ctx: ModerationContext,
	{ targetId, member }: { targetId: string; member: GuildMember | null }
): Promise<ModerationFailure | number | null> {
	if (['warn', 'timeout', 'untimeout', 'kick'].includes(ctx.action) && !member) {
		return failure('Member is not in the server');
	}
	const rejected = member ? await memberRejection(ctx, member) : null;
	if (rejected) {
		return failure(rejected);
	}
	const duration = moderationDuration(ctx.action, ctx.payload.duration_seconds);
	if ('error' in duration) {
		return failure(duration.error);
	}
	const user = member?.user ?? (await ctx.client.users.fetch(targetId).catch(() => null));
	return user?.bot ? failure('Bots cannot be moderated') : duration.seconds;
}

async function moderateTarget(ctx: ModerationContext, targetId: string): Promise<ModerationResult> {
	const member = await ctx.guild.members.fetch(targetId).catch(() => null);
	const checked = await moderationPrecheck(ctx, { targetId, member });
	if (checked !== null && typeof checked === 'object') {
		return checked;
	}
	const durationSeconds = checked;

	const auditReason = truncateToLimit(
		`${ctx.reason || 'No reason provided'} · by ${ctx.payload.staff_name || 'staff'} via ${ctx.source}`,
		DISCORD_LIMITS.AUDIT_LOG_REASON
	);
	try {
		const refused = await DISCORD_ACTIONS[ctx.action]?.({ ctx, member, targetId, durationSeconds, auditReason });
		if (refused) {
			return failure(refused);
		}
	} catch (err) {
		await logger.log(`❌ Moderation ${ctx.action} failed for ${targetId}: ${(err as Error).message}`);
		return failure(`Discord rejected the ${ctx.action}: ${errorReasonFor(translatorFor('en'), err)}`);
	}

	await syncActiveModeration(ctx, targetId);
	const logged = await recordCase(ctx.client, ctx, { ...caseOptions(ctx, targetId), reason: ctx.reason, durationSeconds });
	await logger.log(`🛡️ Moderation ${ctx.action} on ${targetId} in ${ctx.guild.id} via ${ctx.source} (case #${logged?.caseNumber ?? '?'})`);
	const escalated =
		ctx.action === 'warn' && logged?.memberRow
			? await escalate(ctx.client, { guild: ctx.guild, serverId: ctx.serverId, targetId, memberId: Number(logged.memberRow.id) })
			: null;
	return { ok: true, case_number: logged?.caseNumber ?? null, ...(escalated ? { escalated } : {}) };
}

export async function performModerationAction(client: Client, payload: ModerationPayload): Promise<ModerationResult> {
	const ctx = await moderationContext(client, payload);
	if ('ok' in ctx) {
		return ctx;
	}
	if (ctx.action === 'unwarn') {
		return revokeWarning(ctx);
	}

	const targetId = String(payload.target_id || '').trim();
	const rejected = targetRejection(ctx, targetId);
	if (rejected) {
		return failure(rejected);
	}
	return ctx.action === 'clearwarns' ? clearWarnings(ctx, targetId) : moderateTarget(ctx, targetId);
}

type EscalationTarget = { guild: Guild; serverId: number; targetId: string; memberId: number };

async function escalate(client: Client, { guild, serverId, targetId, memberId }: EscalationTarget) {
	const rules = await MODERATION_CONFIG.getRulesForServer(serverId).catch(() => null);
	if (!rules || rules.escalation.length === 0) {
		return null;
	}
	const active = await db.countActiveWarnings(memberId).catch(() => 0);
	const step = escalationStepFor(rules, active);
	if (!step) {
		return null;
	}
	const tr = await serverTranslator(guild.id);
	const result = await performModerationAction(client, {
		guild_id: guild.id,
		action: step.action,
		target_id: targetId,
		staff_name: tr('moderation.caseLog.automatic'),
		reason: tr('moderation.caseLog.reasons.escalation', { count: active }),
		duration_seconds: step.duration_seconds,
		source: 'auto'
	});
	if (!result.ok) {
		await logger.log(`⚠️ Auto-escalation ${step.action} failed for ${targetId} in ${guild.id}: ${result.error}`);
		return null;
	}
	return { action: step.action, case_number: result.case_number ?? null };
}

async function expireOldWarnings(client: Client, botId: number) {
	if (Date.now() - lastWarnExpirySweep < WARN_EXPIRY_SWEEP_MS) {
		return;
	}
	lastWarnExpirySweep = Date.now();
	const servers = await db.getServersForBot(botId).catch(() => []);
	for (const server of servers) {
		if (!client.guilds.cache.has(String(server.discord_server_id))) {
			continue;
		}
		const rules = await MODERATION_CONFIG.getRulesForServer(Number(server.id)).catch(() => null);
		if (!rules?.warn_expiry_days) {
			continue;
		}
		const expired = await db.expireModerationWarnings(Number(server.id), rules.warn_expiry_days).catch(() => 0);
		if (expired > 0) {
			await logger.log(`⌛ Expired ${expired} warning(s) older than ${rules.warn_expiry_days} days in ${server.discord_server_id}`);
		}
	}
}

type BulkJob = {
	guild: Guild;
	role: Role;
	action: string;
	targets: GuildMember[];
	auditReason: string;
	source: string;
	staffName: string;
	staffLabel: string | null;
};

async function runBulkRoleChange(client: Client, job: BulkJob) {
	const { guild, role, action } = job;
	const isAdding = action === 'role_add';
	let done = 0;
	let failed = 0;
	for (const member of job.targets) {
		try {
			await (isAdding ? member.roles.add(role, job.auditReason) : member.roles.remove(role, job.auditReason));
			done++;
		} catch (err) {
			failed++;
			await logger.log(`⚠️ Bulk ${action} failed for ${member.id} in ${guild.id}: ${(err as Error).message}`);
		}
	}
	await logger.log(`🛡️ Bulk ${action} ${role.id} in ${guild.id} via ${job.source}: ${done} done, ${failed} failed`);
	const tr = await serverTranslator(guild.id);
	await sendModerationLog(
		client,
		{
			title: tr(`moderation.caseLog.bulkTitles.${action}`),
			description: tr('moderation.caseLog.bulkSummary', { done: done.toLocaleString(), failed: failed.toLocaleString() }),
			userTag: job.staffName,
			fields: [
				{ name: tr('moderation.caseLog.fields.role'), value: `<@&${role.id}>`, inline: true },
				{ name: tr('moderation.caseLog.fields.staff'), value: job.staffLabel || tr('moderation.caseLog.staffFallback'), inline: true },
				{ name: tr('moderation.caseLog.fields.source'), value: sourceLabel(tr, job.source), inline: true }
			]
		},
		guild.id
	).catch(() => null);
}

export async function startBulkModeration(
	client: Client,
	payload: {
		guild_id: string;
		action: string;
		role_id?: string | null;
		target_ids?: string[];
		skip_ids?: string[];
		staff_name?: string | null;
		source?: string;
	}
) {
	const action = String(payload.action || '');
	if (!(BULK_MODERATION_ACTIONS as readonly string[]).includes(action)) {
		return { ok: false, error: 'Unknown bulk action' };
	}

	const guild = client.guilds.cache.get(String(payload.guild_id));
	if (!guild) {
		return { ok: false, error: 'Bot is not in this server' };
	}
	if (bulkRunning.has(guild.id)) {
		return { ok: false, error: 'Another bulk action is still running in this server' };
	}

	const role = guild.roles.cache.get(String(payload.role_id || ''));
	if (!role || role.id === guild.id) {
		return { ok: false, error: 'Pick a role' };
	}
	if (role.managed) {
		return { ok: false, error: `${role.name} is managed by an integration and can't be given or removed` };
	}
	if (!role.editable) {
		return { ok: false, error: `The bot's role must be above ${role.name}` };
	}

	const picked = new Set((payload.target_ids ?? []).map(String));
	const skip = new Set((payload.skip_ids ?? []).map(String));
	if (picked.size === 0) {
		return { ok: false, error: 'Select at least one member' };
	}
	const members = await guild.members.fetch().catch(() => null);
	if (!members) {
		return { ok: false, error: 'Could not load the member list' };
	}

	const isAdding = action === 'role_add';
	const source = payload.source || 'panel';
	const staffName = payload.staff_name || 'staff';
	const auditReason = truncateToLimit(`${BULK_TITLES[action]} · by ${staffName} via ${source} (bulk)`, DISCORD_LIMITS.AUDIT_LOG_REASON);
	const targets = [...members.values()].filter((m) => picked.has(m.id) && !m.user?.bot && !skip.has(m.id) && m.roles.cache.has(role.id) !== isAdding);
	if (targets.length === 0) {
		return { ok: false, error: isAdding ? `Everyone selected already has ${role.name}` : `Nobody selected has ${role.name}` };
	}

	bulkRunning.add(guild.id);
	runBulkRoleChange(client, { guild, role, action, targets, auditReason, source, staffName, staffLabel: payload.staff_name ?? null }).finally(() =>
		bulkRunning.delete(guild.id)
	);

	return { ok: true, queued: targets.length };
}

async function sweepModeration(client: Client) {
	const botConfig = getBotConfig();
	if (!botConfig?.id) {
		return;
	}
	await db.expireModerationTimeouts().catch(() => null);
	await expireOldWarnings(client, Number(botConfig.id)).catch(() => null);
	const due = await db.getDueTempbans(Number(botConfig.id)).catch(() => []);
	for (const row of due) {
		const guild = client.guilds.cache.get(String(row.discord_server_id));
		if (!guild) {
			continue;
		}
		await guild.members.unban(String(row.discord_member_id), `Tempban case #${row.case_number} expired`).catch(() => null);
		await db.revokeModerationCase(row.id).catch(() => null);
		const tr = await serverTranslator(guild.id);
		await recordCase(
			client,
			{ guild, serverId: Number(row.server_id) },
			{
				action: 'unban',
				logAction: 'tempban_expired',
				targetId: String(row.discord_member_id),
				staffName: tr('moderation.caseLog.automatic'),
				reason: tr('moderation.caseLog.reasons.tempbanExpired', { case: row.case_number }),
				source: 'auto',
				active: false
			}
		).catch(() => null);
	}
}

export function initModerationSweeper(client: Client) {
	if (sweepTimer) {
		clearInterval(sweepTimer);
	}
	sweepTimer = setInterval(() => {
		sweepModeration(client).catch((err) => logger.log(`❌ Moderation sweep failed: ${err.message}`));
	}, SWEEP_MS);
}

export function stopModerationSweeper() {
	if (sweepTimer) {
		clearInterval(sweepTimer);
	}
	sweepTimer = null;
}

type NativeCase = { action: string; targetId: string; executorId: string | null; reason: string | null; durationSeconds?: number | null };

async function recordNativeCase(client: Client<true>, guild: Guild, { action, targetId, executorId, reason, durationSeconds = null }: NativeCase) {
	if (executorId && executorId === client.user.id) {
		return;
	}
	const botConfig = getBotConfig();
	if (!botConfig?.id) {
		return;
	}
	const server = await db.getServerByDiscordId(botConfig.id, guild.id);
	if (!server) {
		return;
	}
	const serverId = Number(server.id);
	const memberRow = await resolveMemberRow(serverId, guild, targetId);
	if (memberRow) {
		if (action === 'unban') {
			await db.endActiveModeration(Number(memberRow.id), ['ban', 'tempban'], true);
		}
		if (action === 'untimeout') {
			await db.endActiveModeration(Number(memberRow.id), ['timeout'], true);
		}
		if (action === 'timeout') {
			await db.endActiveModeration(Number(memberRow.id), ['timeout']);
		}
	}
	await recordCase(
		client,
		{ guild, serverId },
		{
			action,
			targetId,
			staffId: executorId,
			staffName: await memberLabel(serverId, executorId),
			reason,
			durationSeconds,
			source: 'discord'
		}
	);
}

async function sendModerationLog(client: Client, embedData: ModerationLogEmbed, guildId: string | null = null) {
	if (!guildId) {
		return;
	}
	const logChannelId = await MODERATION_CONFIG.getLogChannel(guildId);
	if (!logChannelId) {
		return;
	}
	const channel = client.channels.cache.get(logChannelId) as GuildTextBasedChannel | undefined;
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

		const mentions = await notifiedMentions(channel);
		const firstMentions = mentions[0] ?? null;
		const memberMention = embedData.mentionId ? `<@${embedData.mentionId}>` : null;
		await channel.send({
			content: [memberMention && !firstMentions?.includes(memberMention) ? memberMention : null, firstMentions].filter(Boolean).join(' ') || undefined,
			embeds: [embed]
		});

		await sendMentionOverflow(channel, mentions);

		await logger.log(`✅ Sent moderation log: ${embedData.title} for ${embedData.userTag || 'unknown'}`);
	} catch (err) {
		await logger.log(`❌ Failed to send moderation log: ${(err as Error).message}`);
	}
}

async function getAuditLogEntry(
	guild: Guild,
	action: AuditLogEvent.MemberKick | AuditLogEvent.MemberBanAdd | AuditLogEvent.MemberBanRemove | AuditLogEvent.MemberUpdate,
	targetId: string
) {
	try {
		const auditLogs = await guild.fetchAuditLogs({
			limit: 1,
			type: action
		});

		const entry = auditLogs.entries.first();
		if (entry && entry.target!.id === targetId) {
			return entry;
		}
		return null;
	} catch (err) {
		await logger.log(`⚠️ Could not fetch audit log for ${action}: ${(err as Error).message}`);
		return null;
	}
}

async function onBanAdd(client: Client<true>, ban: GuildBan) {
	try {
		const { guild, user } = ban;
		const auditEntry = await getAuditLogEntry(guild, AuditLogEvent.MemberBanAdd, user.id);
		await recordNativeCase(client, guild, {
			action: 'ban',
			targetId: user.id,
			executorId: auditEntry?.executor?.id ?? null,
			reason: ban.reason || auditEntry?.reason || null
		});
	} catch (err) {
		await logger.log(`❌ Error handling ban: ${(err as Error).message}`);
	}
}

async function onBanRemove(client: Client<true>, ban: GuildBan) {
	try {
		const { guild, user } = ban;
		const auditEntry = await getAuditLogEntry(guild, AuditLogEvent.MemberBanRemove, user.id);
		await recordNativeCase(client, guild, {
			action: 'unban',
			targetId: user.id,
			executorId: auditEntry?.executor?.id ?? null,
			reason: auditEntry?.reason || null
		});
	} catch (err) {
		await logger.log(`❌ Error handling unban: ${(err as Error).message}`);
	}
}

async function onTimeoutChange(client: Client<true>, { before, member }: { before: number | null; member: GuildMember }) {
	try {
		const after = member.communicationDisabledUntilTimestamp ?? null;
		if (before === after) {
			return;
		}
		const now = Date.now();
		const hasTimedOut = after !== null && after > now;
		const wasTimedOut = before !== null && before > now;
		if (!hasTimedOut && !wasTimedOut) {
			return;
		}
		const auditEntry = await getAuditLogEntry(member.guild, AuditLogEvent.MemberUpdate, member.id);
		await recordNativeCase(client, member.guild, {
			action: hasTimedOut ? 'timeout' : 'untimeout',
			targetId: member.id,
			executorId: auditEntry?.executor?.id ?? null,
			reason: auditEntry?.reason || null,
			...(hasTimedOut ? { durationSeconds: Math.max(MIN_DURATION_SECONDS, Math.round((after - now) / SECOND_MS)) } : {})
		});
	} catch (err) {
		await logger.log(`❌ Error handling timeout change: ${(err as Error).message}`);
	}
}

async function onMemberRemove(client: Client<true>, member: GuildMember | PartialGuildMember) {
	try {
		const banEntry = await getAuditLogEntry(member.guild, AuditLogEvent.MemberBanAdd, member.user.id);
		if (banEntry && Date.now() - banEntry.createdTimestamp < BAN_AUDIT_WINDOW_SECONDS * SECOND_MS) {
			return;
		}
		const kickEntry = await getAuditLogEntry(member.guild, AuditLogEvent.MemberKick, member.user.id);
		if (!kickEntry || Date.now() - kickEntry.createdTimestamp > KICK_AUDIT_WINDOW_SECONDS * SECOND_MS) {
			return;
		}
		await recordNativeCase(client, member.guild, {
			action: 'kick',
			targetId: member.user.id,
			executorId: kickEntry.executor?.id ?? null,
			reason: kickEntry.reason || null
		});
	} catch (err) {
		await logger.log(`❌ Error handling member remove: ${(err as Error).message}`);
	}
}

function init(client: Client<true>) {
	client.on('guildBanAdd', (ban) => onBanAdd(client, ban));
	client.on('guildBanRemove', (ban) => onBanRemove(client, ban));
	client.on('guildMemberUpdate', (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) =>
		onTimeoutChange(client, { before: oldMember.communicationDisabledUntilTimestamp ?? null, member: newMember })
	);
	client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => onMemberRemove(client, member));
}

export default { init };
