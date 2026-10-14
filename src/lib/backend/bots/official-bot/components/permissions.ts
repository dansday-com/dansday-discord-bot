import { PermissionFlagsBits } from 'discord.js';
import { PERMISSIONS, getServerForCurrentBot } from '../../../config.js';
import { translate } from '../i18n.js';
import db from '../../../../database.js';
import type { Guild, GuildMember, Role } from 'discord.js';

const OPEN_ACTIONS = ['menu', 'feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_rating', 'notifications', 'quest_enroll', 'content_creator'];

async function getGuildPermissions(guildId: string) {
	try {
		return await PERMISSIONS.getPermissions(guildId);
	} catch (_) {
		return { STAFF_ROLES: [], CONTENT_CREATOR_ROLES: [] };
	}
}

async function isAdmin(member: GuildMember) {
	return member?.permissions?.has?.(PermissionFlagsBits.Administrator) === true;
}

async function isStaff(member: GuildMember) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.STAFF_ROLES);
}

async function isSupporter(member: GuildMember) {
	return (member?.premiumSince ?? null) !== null;
}

async function isContentCreator(member: GuildMember) {
	const perms = await getGuildPermissions(member.guild.id);
	return await PERMISSIONS.hasAnyRole(member, perms.CONTENT_CREATOR_ROLES);
}

export async function hasPermission(member: GuildMember | null, action: string) {
	if (member?.user.bot) {
		return false;
	}
	if (OPEN_ACTIONS.includes(action)) {
		return true;
	}
	if (!member) {
		return false;
	}

	if (await isAdmin(member)) {
		return true;
	}
	if (await isStaff(member)) {
		return action !== 'setup';
	}
	if (action === 'custom_supporter_role') {
		return (await isSupporter(member)) || (await isContentCreator(member));
	}
	return false;
}

export async function getRequiredRolesForAction(guild: Guild, action: string) {
	try {
		const perms = await getGuildPermissions(guild.id);
		const roleNames: string[] = [];

		const isBotOnlyRole = (role: Role) => role.members.size > 0 && role.members.every((m) => m.user.bot);

		const addRoles = (ids: string[]) => {
			ids?.forEach((roleId: string) => {
				const role = guild.roles.cache.get(roleId);
				if (role && !isBotOnlyRole(role)) {
					roleNames.push(role.name);
				}
			});
		};

		const addAdminRoles = () => {
			for (const role of guild.roles.cache.values()) {
				if (role.id === guild.id || role.managed || isBotOnlyRole(role)) {
					continue;
				}
				if (role.permissions?.has?.(PermissionFlagsBits.Administrator)) {
					roleNames.push(role.name);
				}
			}
		};

		if (action === 'setup') {
			addAdminRoles();
			return roleNames.length > 0 ? roleNames : ['Admin'];
		}
		if (action === 'staff_only') {
			addRoles(perms.STAFF_ROLES);
			addAdminRoles();
			return roleNames.length > 0 ? roleNames : ['Staff or Admin'];
		}
		if (action === 'custom_supporter_role') {
			addRoles(perms.CONTENT_CREATOR_ROLES);
			addRoles(perms.STAFF_ROLES);
			addAdminRoles();
			return roleNames.length > 0 ? roleNames : ['Content Creator, Staff, or Admin'];
		}
		if (['feedback', 'afk', 'leveling', 'giveaway', 'settings', 'staff_rating', 'notifications', 'menu', 'content_creator', 'quest_enroll'].includes(action)) {
			addRoles(perms.CONTENT_CREATOR_ROLES);
			addRoles(perms.STAFF_ROLES);
			addAdminRoles();
			return roleNames.length > 0 ? roleNames : ['Content Creator, Staff, or Admin'];
		}
		return ['Unknown'];
	} catch (_) {
		return ['Unknown'];
	}
}

export async function getPermissionDeniedMessage(guild: Guild, action: string, userId: string | null = null) {
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
		const hasOwner = accounts.some((a) => a.account_type === 'owner');

		if (!hasOwner) {
			const title = await translate('permissions.ownerRequired.title', { guildId: guild.id, userId: userId ?? '' });
			const desc = await translate('permissions.ownerRequired.description', { guildId: guild.id, userId: userId ?? '' }, { action: actionName });
			return `${title}\n\n${desc}`;
		}

		const perms = await getGuildPermissions(guild.id);
		const allRoles = [...perms.STAFF_ROLES, ...perms.CONTENT_CREATOR_ROLES];
		if (allRoles.length === 0) {
			const title = await translate('permissions.notConfigured.title', { guildId: guild.id, userId: userId ?? '' });
			const desc = await translate('permissions.notConfigured.description', { guildId: guild.id, userId: userId ?? '' }, { action: actionName });
			return `${title}\n\n${desc}`;
		}
	} catch (e) {}

	const requiredRoles = await getRequiredRolesForAction(guild, action);
	const roleList =
		requiredRoles.length > 0
			? requiredRoles.map((role) => `**${role}**`).join(', ')
			: await translate('permissions.requiredRoleFallback', { guildId: guild.id, userId: userId ?? '' });

	const scope = action === 'custom_supporter_role' ? 'permissions.supporterRoleDenied' : 'permissions.denied';
	const title = await translate(`${scope}.title`, { guildId: guild.id, userId: userId ?? '' });
	const description = await translate(`${scope}.description`, { guildId: guild.id, userId: userId ?? '' }, { action: actionName, roles: roleList });
	const footer = await translate(`${scope}.footer`, { guildId: guild.id, userId: userId ?? '' });

	return `${title}\n\n${description}\n\n${footer}`;
}
