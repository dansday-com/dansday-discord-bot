import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import {
	DEFAULT_LEVELING_SETTINGS,
	PERMISSIONS,
	getBotConfig,
	getLevelingSettings,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	isPublicSubFeatureEnabled,
	serverSettingsComponent
} from '../../../config.js';
import { awardInviteXp } from './leveling.js';
import { INVITE_STAFF_MULTIPLIER } from '../../../../invites.js';

type CachedInvite = { uses: number; inviterId: string | null; maxUses: number; expiresAt: number | null };
type GuildInviteState = { invites: Map<string, CachedInvite>; vanityCode: string | null; vanityUses: number | null };
type Attribution = { code: string | null; inviterDiscordId: string | null; source: 'invite' | 'vanity' | 'unknown' };

export type JoinInviteResult = {
	inviterDiscordId: string | null;
	inviterMemberId: number | null;
	code: string | null;
	source: string;
	fakeReason: string | null;
	rejoin: boolean;
	inviterTotal: number | null;
};

const REWARD_SWEEP_MS = 5 * 60_000;
const DELETED_INVITE_GRACE_MS = 15_000;
const JOIN_RESULT_TTL_MS = 60_000;
const WARMUP_GAP_MS = 750;
const UNKNOWN_MEMBER_CODES = new Set([10007, 10013]);
const SERVER_INVITE_CHECK_MS = 30 * 60_000;

const guildStates = new Map<string, GuildInviteState>();
const guildQueues = new Map<string, Promise<unknown>>();
const joinResults = new Map<string, Promise<JoinInviteResult | null>>();
let clientRef: any = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let serverInviteTimer: ReturnType<typeof setInterval> | null = null;

function enqueue<T>(guildId: string, task: () => Promise<T>): Promise<T> {
	const previous = guildQueues.get(guildId) ?? Promise.resolve();
	const next = previous.catch(() => null).then(task);
	guildQueues.set(
		guildId,
		next.catch(() => null)
	);
	return next;
}

export function canReadInvites(guild: any): boolean {
	return guild?.members?.me?.permissions?.has?.(PermissionFlagsBits.ManageGuild) === true;
}

function toCached(invite: any): CachedInvite {
	return {
		uses: Number(invite.uses) || 0,
		inviterId: invite.inviterId ?? invite.inviter?.id ?? null,
		maxUses: Number(invite.maxUses) || 0,
		expiresAt: invite.expiresTimestamp ?? null
	};
}

async function snapshotGuild(guild: any): Promise<GuildInviteState | null> {
	if (!canReadInvites(guild)) return null;
	const fetched = await guild.invites.fetch({ cache: false }).catch(() => null);
	if (!fetched) return null;
	const invites = new Map<string, CachedInvite>();
	for (const invite of fetched.values()) invites.set(invite.code, toCached(invite));
	let vanityCode: string | null = guild.vanityURLCode ?? null;
	let vanityUses: number | null = null;
	if (vanityCode) {
		const vanity = await guild.fetchVanityData().catch(() => null);
		if (vanity) {
			vanityCode = vanity.code ?? vanityCode;
			vanityUses = Number(vanity.uses) || 0;
		}
	}
	return { invites, vanityCode, vanityUses };
}

const UNKNOWN_ATTRIBUTION: Attribution = { code: null, inviterDiscordId: null, source: 'unknown' };

function diffSnapshots(before: GuildInviteState, after: GuildInviteState): { attribution: Attribution; extra: number } {
	const now = Date.now();
	const candidates: (Attribution & { delta: number })[] = [];

	for (const [code, invite] of after.invites) {
		const delta = invite.uses - (before.invites.get(code)?.uses ?? 0);
		if (delta > 0) candidates.push({ code, inviterDiscordId: invite.inviterId, source: 'invite', delta });
	}

	for (const [code, invite] of before.invites) {
		if (after.invites.has(code)) continue;
		if (invite.maxUses <= 0 || invite.uses + 1 < invite.maxUses) continue;
		if (invite.expiresAt && invite.expiresAt <= now) continue;
		candidates.push({ code, inviterDiscordId: invite.inviterId, source: 'invite', delta: 1 });
	}

	if (before.vanityUses != null && after.vanityUses != null && after.vanityUses > before.vanityUses) {
		candidates.push({ code: after.vanityCode, inviterDiscordId: null, source: 'vanity', delta: after.vanityUses - before.vanityUses });
	}

	if (candidates.length !== 1) return { attribution: UNKNOWN_ATTRIBUTION, extra: 0 };
	const [{ delta, ...attribution }] = candidates;
	return { attribution, extra: delta - 1 };
}

function holdBackUses(state: GuildInviteState, attribution: Attribution, extra: number) {
	if (extra <= 0) return;
	if (attribution.source === 'vanity' && state.vanityUses != null) {
		state.vanityUses -= extra;
		return;
	}
	const cached = attribution.code ? state.invites.get(attribution.code) : null;
	if (cached) cached.uses -= extra;
}

async function loadInviteSettings(guildId: string) {
	try {
		return (await getLevelingSettings(guildId)).INVITE;
	} catch (_) {
		return DEFAULT_LEVELING_SETTINGS.INVITE;
	}
}

async function resolveInviterMember(guild: any, serverId: number, discordId: string) {
	const existing = await db.getMemberByDiscordId(serverId, discordId, { includeDeleted: true }).catch(() => null);
	if (existing) return existing;
	const guildMember = await guild.members.fetch(discordId).catch(() => null);
	if (!guildMember) return null;
	return db.upsertMember(serverId, guildMember).catch(() => null);
}

async function resolveAndRecordJoin(member: any): Promise<JoinInviteResult | null> {
	const guild = member.guild;
	const before = guildStates.get(guild.id) ?? null;
	const after = await snapshotGuild(guild);
	if (after) guildStates.set(guild.id, after);

	let server: any;
	try {
		server = await getServerForCurrentBot(guild.id);
	} catch (_) {
		return null;
	}

	const { attribution, extra } = before && after ? diffSnapshots(before, after) : { attribution: UNKNOWN_ATTRIBUTION, extra: 0 };
	if (after) holdBackUses(after, attribution, extra);

	let inviterDiscordId = attribution.inviterDiscordId;
	let source: string = attribution.source;
	if (attribution.code && attribution.source === 'invite') {
		const owners = await db.getInviteLinkOwners(server.id).catch(() => []);
		const owner = owners.find((o: any) => o.code === attribution.code);
		if (owner) inviterDiscordId = String(owner.discord_member_id);
		else if ((await db.getServer(server.id).catch(() => null))?.invite_code === attribution.code) source = 'server';
	}
	if (inviterDiscordId && inviterDiscordId === guild.client?.user?.id) inviterDiscordId = null;

	const invitee = await db.upsertMember(server.id, member).catch(() => null);
	if (!invitee?.id) return null;

	const settings = await loadInviteSettings(guild.id);
	const inviter = inviterDiscordId ? await resolveInviterMember(guild, server.id, inviterDiscordId) : null;
	const accountAgeDays = member.user?.createdTimestamp ? (Date.now() - member.user.createdTimestamp) / 86_400_000 : Infinity;

	let fakeReason: string | null = null;
	if (inviterDiscordId && inviterDiscordId === member.id) fakeReason = 'self';
	else if (inviter?.is_bot) fakeReason = 'bot';
	else if (settings.MIN_ACCOUNT_AGE_DAYS > 0 && accountAgeDays < settings.MIN_ACCOUNT_AGE_DAYS) fakeReason = 'account_age';

	const { rejoin } = await db.recordMemberJoinInvite({
		member_id: Number(invitee.id),
		inviter_member_id: inviter?.id ? Number(inviter.id) : null,
		code: attribution.code,
		source,
		fake_reason: fakeReason,
		joined_at: new Date(member.joinedTimestamp ?? Date.now())
	});

	const stored = await db.getMemberInviter(Number(invitee.id)).catch(() => null);
	const storedInviterId = stored?.inviter_discord_id ? String(stored.inviter_discord_id) : null;
	const storedInviter = storedInviterId ? await db.getMemberByDiscordId(server.id, storedInviterId, { includeDeleted: true }).catch(() => null) : null;
	const inviterTotal = storedInviter?.id ? ((await db.getMemberInviteStats(Number(storedInviter.id)).catch(() => null))?.total ?? null) : null;
	const storedFake = stored?.fake_reason ?? null;
	const storedSource = stored?.source ?? attribution.source;
	const sourceLabel = storedSource === 'invite' ? `code ${stored?.code ?? attribution.code}` : storedSource;
	await logger.log(
		`📨 Join attributed: ${member.user?.tag || member.id} → ${storedInviterId ? `inviter ${storedInviterId}` : 'no inviter'} (${sourceLabel}${storedFake ? `, fake: ${storedFake}` : ''}${rejoin ? ', rejoin' : ''})`
	);

	if (settings.HOLD_HOURS === 0 && storedInviter?.id && !storedFake) {
		processGuildRewards(guild, Number(server.id)).catch(() => {});
	}

	return {
		inviterDiscordId: storedInviterId,
		inviterMemberId: storedInviter?.id ? Number(storedInviter.id) : null,
		code: stored?.code ?? attribution.code,
		source: storedSource,
		fakeReason: storedFake,
		rejoin,
		inviterTotal
	};
}

function joinKey(member: any) {
	return `${member.guild.id}:${member.id}:${member.joinedTimestamp ?? 0}`;
}

export function attributeJoin(member: any): Promise<JoinInviteResult | null> {
	if (!member?.guild || member.user?.bot) return Promise.resolve(null);
	const key = joinKey(member);
	const pending = joinResults.get(key);
	if (pending) return pending;
	const result = enqueue(member.guild.id, () => resolveAndRecordJoin(member)).catch(async (error) => {
		await logger.log(`❌ Invite attribution failed for ${member.id}: ${error.message}`);
		return null;
	});
	joinResults.set(key, result);
	setTimeout(() => joinResults.delete(key), JOIN_RESULT_TTL_MS);
	return result;
}

async function recordLeave(member: any) {
	const guild = member.guild;
	let server: any;
	try {
		server = await getServerForCurrentBot(guild.id);
	} catch (_) {
		return;
	}
	const dbMember = await db.getMemberByDiscordId(server.id, member.id, { includeDeleted: true }).catch(() => null);
	if (!dbMember?.id) return;
	await db.markMemberInviteLeft(Number(dbMember.id));
}

async function isStaffMember(guildMember: any): Promise<boolean> {
	try {
		const perms = await PERMISSIONS.getPermissions(guildMember.guild.id);
		return await PERMISSIONS.hasAnyRole(guildMember, perms.STAFF_ROLES);
	} catch (_) {
		return false;
	}
}

export async function inviteRewardFor(guildMember: any): Promise<{ xp: number; multiplier: number }> {
	const settings = await loadInviteSettings(guildMember.guild.id);
	const multiplier = (await isStaffMember(guildMember)) ? INVITE_STAFF_MULTIPLIER : 1;
	return { xp: settings.XP * multiplier, multiplier };
}

async function fetchGuildMember(guild: any, discordId: string): Promise<{ member: any; gone: boolean }> {
	const cached = guild.members.cache.get(discordId);
	if (cached) return { member: cached, gone: false };
	try {
		return { member: await guild.members.fetch(discordId), gone: false };
	} catch (error) {
		return { member: null, gone: UNKNOWN_MEMBER_CODES.has(Number(error?.code)) };
	}
}

async function processGuildRewards(guild: any, serverId: number) {
	const settings = await loadInviteSettings(guild.id);
	const levelingOn = await isComponentFeatureEnabled(guild.id, serverSettingsComponent.leveling).catch(() => false);
	const cutoff = new Date(Date.now() - settings.HOLD_HOURS * 3_600_000);
	const due = await db.getDueInviteRewards(serverId, cutoff, 50);

	for (const row of due) {
		if (!levelingOn || settings.XP <= 0) {
			await db.claimInviteReward(Number(row.id), 0);
			continue;
		}
		const invitee = await fetchGuildMember(guild, row.invitee_discord_id);
		if (!invitee.member) {
			if (invitee.gone) await db.markMemberInviteLeft(Number(row.member_id));
			continue;
		}
		const inviterLookup = await fetchGuildMember(guild, row.inviter_discord_id);
		const inviter = inviterLookup.member;
		if (!inviter) {
			if (inviterLookup.gone) await db.claimInviteReward(Number(row.id), 0);
			continue;
		}

		const { xp, multiplier } = await inviteRewardFor(inviter);
		if (!(await db.claimInviteReward(Number(row.id), xp))) continue;
		const awarded = await awardInviteXp(guild, inviter, xp, { multiplier, inviteeName: row.invitee_name ?? null });
		if (!awarded) await db.releaseInviteReward(Number(row.id));
	}
}

async function sweepRewards() {
	if (!clientRef) return;
	const botId = getBotConfig()?.id;
	if (!botId) return;
	const servers = await db.getPendingInviteServers(Number(botId)).catch(() => []);
	for (const s of servers) {
		const guild = clientRef.guilds.cache.get(String(s.discord_server_id));
		if (!guild) continue;
		await enqueue(guild.id, () => processGuildRewards(guild, Number(s.server_id))).catch(async (error) => {
			await logger.log(`⚠️ Invite reward sweep failed for ${guild.id}: ${error.message}`);
		});
	}
}

export function pickInviteChannel(guild: any) {
	const me = guild.members.me;
	const everyone = guild.roles.everyone;
	const usable = (channel: any) =>
		channel &&
		(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
		channel.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite) &&
		channel.permissionsFor(everyone)?.has(PermissionFlagsBits.ViewChannel);
	const preferred = [guild.rulesChannel, guild.systemChannel].find(usable);
	if (preferred) return preferred;
	return [...guild.channels.cache.values()].filter(usable).sort((a: any, b: any) => a.rawPosition - b.rawPosition)[0] ?? null;
}

async function ensureServerInvite(guild: any) {
	if (guild.vanityURLCode) return;
	if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.public).catch(() => false))) return;
	if (!(await isPublicSubFeatureEnabled(guild.id, 'invite').catch(() => false))) return;
	const state = guildStates.get(guild.id);
	if (!state) return;

	let server: any;
	try {
		server = await getServerForCurrentBot(guild.id);
	} catch (_) {
		return;
	}
	const current = (await db.getServer(server.id).catch(() => null))?.invite_code ?? null;
	const botUserId = guild.client?.user?.id;
	const cached = current ? state.invites.get(current) : null;
	if (cached && cached.inviterId === botUserId && !cached.expiresAt && !(await db.getPersonalInviteCodes([current])).has(current)) return;

	const channel = pickInviteChannel(guild);
	if (!channel) return;
	const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: 'Server invite link' }).catch(() => null);
	if (!invite?.code) return;
	rememberCreatedInvite(guild.id, invite);
	await db.setServerInviteCode(Number(server.id), invite.code);
}

async function warmGuild(guild: any) {
	const state = await snapshotGuild(guild);
	if (state) guildStates.set(guild.id, state);
	else guildStates.delete(guild.id);
	await ensureServerInvite(guild).catch(() => null);
}

async function warmAll(client: any) {
	for (const guild of client.guilds.cache.values()) {
		await enqueue(guild.id, () => warmGuild(guild)).catch(() => null);
		await new Promise((resolve) => setTimeout(resolve, WARMUP_GAP_MS));
	}
}

async function checkServerInvites(client: any) {
	for (const guild of client.guilds.cache.values()) {
		await enqueue(guild.id, () => ensureServerInvite(guild)).catch(() => null);
		await new Promise((resolve) => setTimeout(resolve, WARMUP_GAP_MS));
	}
}

export function rememberCreatedInvite(guildId: string, invite: any) {
	const state = guildStates.get(guildId);
	if (state && invite?.code) state.invites.set(invite.code, toCached(invite));
}

function init(client: any) {
	clientRef = client;

	client.on('inviteCreate', (invite: any) => {
		if (invite.guild?.id) rememberCreatedInvite(invite.guild.id, invite);
	});

	client.on('inviteDelete', (invite: any) => {
		const guildId = invite.guild?.id;
		if (!guildId) return;
		setTimeout(() => guildStates.get(guildId)?.invites.delete(invite.code), DELETED_INVITE_GRACE_MS);
	});

	client.on('guildCreate', (guild: any) => {
		enqueue(guild.id, () => warmGuild(guild)).catch(() => null);
	});

	client.on('guildDelete', (guild: any) => {
		guildStates.delete(guild.id);
		guildQueues.delete(guild.id);
	});

	client.on('guildMemberAdd', (member: any) => {
		attributeJoin(member).catch(() => null);
	});

	client.on('guildMemberRemove', (member: any) => {
		if (!member.guild || member.user?.bot || member.guild.available === false) return;
		joinResults.delete(joinKey(member));
		enqueue(member.guild.id, () => recordLeave(member)).catch(async (error) => {
			await logger.log(`⚠️ Invite leave tracking failed for ${member.id}: ${error.message}`);
		});
	});

	warmAll(client).catch(() => null);
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = setInterval(() => {
		sweepRewards().catch(() => null);
	}, REWARD_SWEEP_MS);
	sweepRewards().catch(() => null);
	if (serverInviteTimer) clearInterval(serverInviteTimer);
	serverInviteTimer = setInterval(() => {
		checkServerInvites(client).catch(() => null);
	}, SERVER_INVITE_CHECK_MS);
}

export function stopInviteRewards() {
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = null;
	if (serverInviteTimer) clearInterval(serverInviteTimer);
	serverInviteTimer = null;
}

export default { init };
