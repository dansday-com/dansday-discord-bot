import { PERMISSIONS, getServerForCurrentBot } from '../../../config.js';
import { translate } from '../i18n.js';
import db from '../../../../database.js';

async function getGuildPermissions(guildId: string) {
	try {
		return await PERMISSIONS.getPermissions(guildId);
	} catch (_) {
		return { ADMIN_ROLES: [], STAFF_ROLES: [], SUPPORTER_ROLES: [], MEMBER_ROLES: [], CONTENT_CREATOR_ROLES: [] };
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

async function isContentCreator(member: any) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.CONTENT_CREATOR_ROLES);
}

export async function hasPermission(member: any, action: string) {
	const isAdminMember = await isAdmin(member);
	const isStaffMember = await isStaff(member);
	const isSupporterMember = await isSupporter(member);
	const isMemberRole = await isMember(member);
	const isContentCreatorRole = await isContentCreator(member);
	const isEffectiveSupporter = isSupporterMember || isContentCreatorRole;

	if (isAdminMember) return true;
	if (isStaffMember) return action !== 'setup';
	if (action === 'staff_only') return isStaffMember || isAdminMember;
	if (action === 'custom_supporter_role') return isEffectiveSupporter || isStaffMember || isAdminMember;
	if (action === 'content_creator') return isMemberRole || isEffectiveSupporter || isStaffMember || isAdminMember;
	if (['feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_rating', 'notifications', 'menu', 'quest_enroll'].includes(action)) {
		return isMemberRole || isEffectiveSupporter || isStaffMember || isAdminMember;
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
		if (action === 'staff_only') {
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Staff or Admin'];
		}
		if (action === 'custom_supporter_role') {
			addRoles(perms.CONTENT_CREATOR_ROLES);
			addRoles(perms.SUPPORTER_ROLES);
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Content Creator, Supporter, Staff, or Admin'];
		}
		if (['feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_rating', 'notifications', 'menu', 'content_creator', 'quest_enroll'].includes(action)) {
			addRoles(perms.MEMBER_ROLES);
			addRoles(perms.CONTENT_CREATOR_ROLES);
			addRoles(perms.SUPPORTER_ROLES);
			addRoles(perms.STAFF_ROLES);
			addRoles(perms.ADMIN_ROLES);
			return roleNames.length > 0 ? roleNames : ['Member, Content Creator, Supporter, Staff, or Admin'];
		}
		return ['Unknown'];
	} catch (_) {
		return ['Unknown'];
	}
}

export async function getPermissionDeniedMessage(guild: any, action: string, userId: string | null = null) {
	const actionNames: Record<string, string> = {
		staff_only: 'Staff Only',
		custom_supporter_role: 'Custom Supporter Role',
		feedback: 'Feedback',
		afk: 'AFK',
		leveling: 'Leveling',
		giveaway: 'Giveaway',
		settings: 'Settings',
		staff_rating: 'Staff rating',
		content_creator: 'Content Creator',
		notifications: 'Notifications',
		menu: 'Menu',
		setup: 'Setup',
		quest_enroll: 'Quest Enroll'
	};

	const actionName = actionNames[action] || action;

	try {
		const server = await getServerForCurrentBot(guild.id);
		const accounts = await db.getServerAccountsByServer(server.id);
		const hasOwner = accounts.some((a: any) => a.account_type === 'owner');

		if (!hasOwner) {
			const title = await translate('permissions.ownerRequired.title', guild.id, userId ?? '');
			const desc = await translate('permissions.ownerRequired.description', guild.id, userId ?? '', { action: actionName });
			return `${title}\n\n${desc}`;
		}

		const perms = await getGuildPermissions(guild.id);
		const allRoles = [...perms.ADMIN_ROLES, ...perms.STAFF_ROLES, ...perms.SUPPORTER_ROLES, ...perms.MEMBER_ROLES, ...perms.CONTENT_CREATOR_ROLES];
		if (allRoles.length === 0) {
			const title = await translate('permissions.notConfigured.title', guild.id, userId ?? '');
			const desc = await translate('permissions.notConfigured.description', guild.id, userId ?? '', { action: actionName });
			return `${title}\n\n${desc}`;
		}
	} catch (e) {
		// Fallback to standard error if database query fails
	}

	const requiredRoles = await getRequiredRolesForAction(guild, action);
	const roleList = requiredRoles.length > 0 ? requiredRoles.map((role) => `**${role}**`).join(', ') : 'the required role';

	const title = await translate('permissions.denied.title', guild.id, userId ?? '');
	const description = await translate('permissions.denied.description', guild.id, userId ?? '', { action: actionName, roles: roleList });
	const footer = await translate('permissions.denied.footer', guild.id, userId ?? '');

	return `${title}\n\n${description}\n\n${footer}`;
}
