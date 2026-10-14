import db from '../../../../database.js';
import { formatDuration } from '../../../../items.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '../../../panelServer.js';
import { isComponentFeatureEnabled } from '../../../config.js';
import { cachedLookup } from './aiCache.js';
import { MINUTE_MS } from '../../../../utils/time.js';

const TOOL_FEATURES_TTL_SEC = 30;

export type ToolFeatures = {
	publicData: boolean;
	items: boolean;
	market: boolean;
	minigames: boolean;
	tasks: boolean;
	giveaway: boolean;
	staffRating: boolean;
	quests: boolean;
};
export type ToolContext = { botId: number; guildId: string; callerDiscordId: string | null; voice?: boolean };

export function fail(reason: string, extra = {}) {
	return { ok: false, reason, ...extra };
}

export function num(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function formatMs(ms: number) {
	return formatDuration(Math.max(0, num(ms)) / MINUTE_MS);
}

export function safeConfig(raw: unknown): Record<string, unknown> {
	if (!raw) {
		return {};
	}
	if (typeof raw !== 'string') {
		return raw as Record<string, unknown>;
	}
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export function nameOfMember(member: { server_display_name?: string | null; display_name?: string | null; username?: string | null } | null | undefined) {
	return member?.server_display_name || member?.display_name || member?.username || 'a member';
}

async function serverFor(botId: number, guildId: string) {
	if (!guildId) {
		return null;
	}
	return db.getServerByDiscordId(botId, guildId).catch(() => null);
}

async function publicSettings(serverId: number) {
	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.public).catch(() => null);
	return row?.settings ?? {};
}

export async function publicServer(botId: number, guildId: string) {
	const server = await serverFor(botId, guildId);
	if (!server) {
		return { error: fail('server_not_found') };
	}

	const settings = await publicSettings(server.id);

	return {
		server,
		itemsEnabled: publicSubfeatureEnabled(settings, 'items'),
		marketEnabled: publicSubfeatureEnabled(settings, 'market'),
		minigamesEnabled: publicSubfeatureEnabled(settings, 'minigames'),
		tasksEnabled: publicSubfeatureEnabled(settings, 'tasks')
	};
}

export async function memberByDiscordId(serverId: number, discordMemberId: string) {
	const members = await db.getServerMembersList(serverId).catch(() => []);
	return members.find((m) => String(m.discord_member_id) === String(discordMemberId)) ?? null;
}

export async function memberTzOffset(memberId: number | string) {
	const streak = await db.getMemberStreak(memberId).catch(() => null);
	const raw = Number(streak?.tz_offset_min);
	return Number.isFinite(raw) ? raw : 0;
}

export async function memberTzKnown(memberId: number | string) {
	const streak = await db.getMemberStreak(memberId).catch(() => null);
	const raw = streak?.tz_offset_min;
	return raw != null && Number.isFinite(Number(raw));
}

export async function resolveToolFeatures(botId: number, guildId: string): Promise<ToolFeatures> {
	const off: ToolFeatures = {
		publicData: false,
		items: false,
		market: false,
		minigames: false,
		tasks: false,
		giveaway: false,
		staffRating: false,
		quests: false
	};
	if (!botId || !guildId) {
		return off;
	}

	return cachedLookup(`botai:toolfeatures:${botId}:${guildId}`, TOOL_FEATURES_TTL_SEC, () => loadToolFeatures(botId, guildId, off));
}

async function loadToolFeatures(botId: number, guildId: string, off: ToolFeatures): Promise<ToolFeatures> {
	const server = await serverFor(botId, guildId);
	if (!server) {
		return off;
	}

	const settings = await publicSettings(server.id);

	const componentOn = (component: string) => isComponentFeatureEnabled(guildId, component).catch(() => false);

	const [isGiveaway, isStaffRating, isQuests] = await Promise.all([
		componentOn(SERVER_SETTINGS.component.giveaway),
		componentOn(SERVER_SETTINGS.component.staff_rating),
		componentOn(SERVER_SETTINGS.component.discord_quest_notifier)
	]);

	return {
		publicData: true,
		items: publicSubfeatureEnabled(settings, 'items'),
		market: publicSubfeatureEnabled(settings, 'market'),
		minigames: publicSubfeatureEnabled(settings, 'minigames'),
		tasks: publicSubfeatureEnabled(settings, 'tasks'),
		giveaway: isGiveaway,
		staffRating: isStaffRating,
		quests: isQuests
	};
}

export type PublicServerContext = Exclude<Awaited<ReturnType<typeof publicServer>>, { error: unknown }>;

export const VOICE_NOTE =
	'Answer out loud in one or two short spoken sentences. Never read a hash, URL or long list aloud — give the few that matter and offer to say more. Round big numbers when you speak them.';

export default {
	fail,
	num,
	formatMs,
	safeConfig,
	nameOfMember,
	publicServer,
	memberByDiscordId,
	memberTzOffset,
	VOICE_NOTE
};
