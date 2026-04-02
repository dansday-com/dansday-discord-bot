import { PERMISSIONS } from '../../../config.js';
import { translate } from '../i18n.js';

async function getGuildPermissions(guildId: string) {
	try {
		return await PERMISSIONS.getPermissions(guildId);
	} catch (_) {
		return { ADMIN_ROLES: [], STAFF_ROLES: [], SUPPORTER_ROLES: [], MEMBER_ROLES: [] };
	}
}

async function isAdmin(member: any) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.ADMIN_ROLES);
}

async function isStaff(member: any) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.STAFF_ROLES);
}

async function isMember(member: any) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.MEMBER_ROLES);
}

async function isSupporter(member: any) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.SUPPORTER_ROLES);
}

export async function hasPermission(member: any, action: string) {
	const isAdminMember = await isAdmin(member);
	const isStaffMember = await isStaff(member);
	const isSupporterMember = await isSupporter(member);
	const isMemberRole = await isMember(member);

	if (isAdminMember) return true;
	if (isStaffMember) return action !== 'setup';
	if (action === 'send_message') return isStaffMember || isAdminMember;
	if (action === 'custom_supporter_role') return isSupporterMember || isStaffMember || isAdminMember;
	if (['feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_report', 'notifications'].includes(action)) {
		return isMemberRole || isSupporterMember || isStaffMember || isAdminMember;
	}
	return false;
}

export async function getRequiredRolesForAction(guild: any, action: string) {
	try {
		const perms = await getGuildPermissions(guild.id);
		const roleNames: string[] = [];

		const addRoles = (ids: string[]) => {
			ids?.forEach((roleId: string) => {
				const role = guild.roles.cache.get(roleId);
				if (role) roleNames.push(role.name);
			});
		};

		if (action === 'setup') {
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Admin'];
		}
		if (action === 'send_message') {
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Staff or Admin'];
		}
		if (action === 'custom_supporter_role') {
			addRoles(perms.SUPPORTER_ROLES);
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Supporter, Staff, or Admin'];
		}
		if (['feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_report', 'notifications', 'menu'].includes(action)) {
			addRoles(perms.MEMBER_ROLES);
			addRoles(perms.SUPPORTER_ROLES);
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Member, Supporter, Staff, or Admin'];
		}
		return ['Unknown'];
	} catch (_) {
		return ['Unknown'];
	}
}

export async function getPermissionDeniedMessage(guild: any, action: string, userId: string | null = null) {
	const requiredRoles = await getRequiredRolesForAction(guild, action);
	const roleList = requiredRoles.length > 0 ? requiredRoles.map((role) => `**${role}**`).join(', ') : 'the required role';

	const actionNames: Record<string, string> = {
		send_message: 'Send Message',
		custom_supporter_role: 'Custom Supporter Role',
		feedback: 'Feedback',
		afk: 'AFK',
		leveling: 'Leveling',
		giveaway: 'Giveaway',
		settings: 'Settings',
		staff_report: 'Staff Report',
		notifications: 'Notifications',
		menu: 'Menu',
		setup: 'Setup'
	};

	const actionName = actionNames[action] || action;
	const title = await translate('permissions.denied.title', guild.id, userId ?? '');
	const description = await translate('permissions.denied.description', guild.id, userId ?? '', { action: actionName, roles: roleList });
	const footer = await translate('permissions.denied.footer', guild.id, userId ?? '');

	return `${title}\n\n${description}\n\n${footer}`;
}
