import { PERMISSIONS } from '../../../config.js';
import type { Guild, Role } from 'discord.js';

function botTopPosition(guild: Guild) {
	const me = guild.members.me;
	const highest = me?.roles?.highest;
	return typeof highest?.position === 'number' ? highest.position : null;
}

function aboveAnchor(guild: Guild, anchorRole: Role, count = 1) {
	const botTop = botTopPosition(guild);
	if (botTop === null) {
		return { ok: false, reason: 'bot_role_unknown' } as const;
	}

	const topNeeded = anchorRole.position + count;
	if (topNeeded >= botTop) {
		return {
			ok: false,
			reason: 'bot_too_low',
			anchorRole,
			botTop,
			neededPosition: topNeeded
		} as const;
	}

	return { ok: true, anchorRole, basePosition: anchorRole.position + 1, botTop } as const;
}

export function resolveSupporterAnchor(guild: Guild, count = 1) {
	const boosterRole = guild.roles.premiumSubscriberRole;
	if (!boosterRole) {
		return { ok: false, reason: 'no_booster_role' } as const;
	}
	return aboveAnchor(guild, boosterRole, count);
}

export async function resolveStaffRatingAnchor(guild: Guild, count = 1) {
	const perms = await PERMISSIONS.getPermissions(guild.id).catch(() => null);
	const staffRoleIds = perms?.STAFF_ROLES?.filter(Boolean) || [];
	if (staffRoleIds.length === 0) {
		return { ok: false, reason: 'no_staff_roles' } as const;
	}

	let anchorRole = null;
	for (const roleId of staffRoleIds) {
		const role = guild.roles.cache.get(roleId);
		if (!role) {
			continue;
		}
		if (!anchorRole || role.position > anchorRole.position) {
			anchorRole = role;
		}
	}

	if (!anchorRole) {
		return { ok: false, reason: 'staff_roles_missing' } as const;
	}

	return aboveAnchor(guild, anchorRole, count);
}

export default { resolveSupporterAnchor, resolveStaffRatingAnchor };
