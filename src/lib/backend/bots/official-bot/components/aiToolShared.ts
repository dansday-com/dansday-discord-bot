import db from '../../../../database.js';
import { formatDuration } from '../../../../items.js';
import { SERVER_SETTINGS } from '../../../../frontend/panelServer.js';

export function fail(reason, extra = {}) {
	return { ok: false, reason, ...extra };
}

export function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function formatMs(ms) {
	return formatDuration(Math.max(0, num(ms)) / 60000);
}

export function safeConfig(raw) {
	if (!raw) return {};
	if (typeof raw !== 'string') return raw;
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export function nameOfMember(member) {
	return member?.server_display_name || member?.display_name || member?.username || 'a member';
}

async function serverFor(botId, guildId) {
	if (!guildId) return null;
	return db.getServerByDiscordId(botId, guildId).catch(() => null);
}

async function publicSettings(serverId) {
	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.public_statistics).catch(() => null);
	return row?.settings ?? {};
}

export async function publicServer(botId, guildId) {
	const server = await serverFor(botId, guildId);
	if (!server) return { error: fail('server_not_found') };

	const settings = await publicSettings(server.id);
	if (settings.enabled === false) return { error: fail('public_data_disabled') };

	return {
		server,
		itemsEnabled: settings.items_enabled === true,
		assetsEnabled: settings.assets_enabled === true,
		minigamesEnabled: settings.minigames_enabled === true
	};
}

export async function memberByDiscordId(serverId, discordMemberId) {
	const members = await db.getServerMembersList(serverId).catch(() => []);
	return members.find((m) => String(m.discord_member_id) === String(discordMemberId)) ?? null;
}

export async function memberTzOffset(memberId) {
	const streak = await db.getMemberStreak(memberId).catch(() => null);
	const raw = Number(streak?.tz_offset_min);
	return Number.isFinite(raw) ? raw : 0;
}

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
