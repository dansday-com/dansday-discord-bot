import { PERMISSIONS } from '../../../config.js';

function botTopPosition(guild) {
	const me = guild.members.me;
	const highest = me?.roles?.highest;
	return typeof highest?.position === 'number' ? highest.position : null;
}

function aboveAnchor(guild, anchorRole, count = 1) {
	const botTop = botTopPosition(guild);
	if (botTop === null) {
		return { ok: false, reason: 'bot_role_unknown' };
	}

	const topNeeded = anchorRole.position + count;
	if (topNeeded >= botTop) {
		return {
			ok: false,
			reason: 'bot_too_low',
			anchorRole,
			botTop,
			neededPosition: topNeeded
		};
	}

	return { ok: true, anchorRole, basePosition: anchorRole.position + 1, botTop };
}

export function resolveSupporterAnchor(guild, count = 1) {
	const boosterRole = guild.roles.premiumSubscriberRole;
	if (!boosterRole) {
		return { ok: false, reason: 'no_booster_role' };
	}
	return aboveAnchor(guild, boosterRole, count);
}

export async function resolveStaffRatingAnchor(guild, count = 1) {
	const perms = await PERMISSIONS.getPermissions(guild.id).catch(() => null);
	const staffRoleIds = perms?.STAFF_ROLES?.filter(Boolean) || [];
	if (staffRoleIds.length === 0) {
		return { ok: false, reason: 'no_staff_roles' };
	}

	let anchorRole = null;
	for (const roleId of staffRoleIds) {
		const role = guild.roles.cache.get(roleId);
		if (!role) continue;
		if (!anchorRole || role.position > anchorRole.position) {
			anchorRole = role;
		}
	}

	if (!anchorRole) {
		return { ok: false, reason: 'staff_roles_missing' };
	}

	return aboveAnchor(guild, anchorRole, count);
}

export default { resolveSupporterAnchor, resolveStaffRatingAnchor };
