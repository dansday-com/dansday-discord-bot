import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getEmbedConfig, CUSTOM_SUPPORTER_ROLE, getBotConfig } from '../../../../config.js';
import { logger } from '../../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { resolveSupporterAnchor } from '../roleAnchor.js';
import db from '../../../../../database.js';
import { memberTranslator, translate, errorReason, errorReasonFor, type Translator } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { imageUploadField, uploadedFiles } from './formFields.js';
import type {
	ButtonInteraction,
	Client,
	Guild,
	GuildMember,
	PartialGuildMember,
	Role,
	RoleCreateOptions,
	RoleEditOptions,
	ModalSubmitFields,
	ModalSubmitInteraction,
	MessageActionRowComponentBuilder,
	ModalActionRowComponentBuilder,
	MessageComponentInteraction
} from 'discord.js';
import { HOUR_MS, SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';

const ROLE_ICON_SIZE_PX = 128;
const ROLE_COLOR_MAX = 0xffffff;
const EMPTY_ROLE_DELETE_DELAY_SECONDS = 5;
const STARTUP_SCAN_DELAY_SECONDS = 10;
const CLEANUP_INTERVAL_HOURS = 6;

const supporterRoles = new Map();

async function getOwnedSupporterRoleIds(guild: Guild) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id) {
			return null;
		}
		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
		if (!server) {
			return null;
		}
		const owned = await db.listCustomSupporterRoles(server.id);
		return new Map(owned.map((r) => [r.discord_role_id, r.discord_member_id]));
	} catch (err) {
		return null;
	}
}

type OwnedRoles = Awaited<ReturnType<typeof getOwnedSupporterRoleIds>>;

async function forgetSupporterRole(guild: Guild, discordRoleId: string) {
	try {
		const botConfig = getBotConfig();
		const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
		if (server) {
			await db.clearMemberCustomSupporterRole(server.id, discordRoleId);
		}
	} catch (err) {}
}

async function cleanupInvalidRole(role: Role, ownedRoleIds: OwnedRoles) {
	try {
		if (!ownedRoleIds || !ownedRoleIds.has(role.id)) {
			return;
		}

		await role.guild.members.fetch();
		const memberCount = role.members.size;

		if (memberCount === 0) {
			await role.delete(`Auto-cleanup: Custom role has no members`);
			await forgetSupporterRole(role.guild, role.id);
			await logger.log(`🗑️ Deleted unused custom role: ${role.name} (${role.id}) - no members`);
		} else if (memberCount > 1) {
			const members = Array.from(role.members.values());
			for (const member of members) {
				await member.roles.remove(role, `Auto-cleanup: Custom role has multiple members`);
			}
			await role.delete(`Auto-cleanup: Custom role has ${memberCount} members (should be exactly 1)`);
			await forgetSupporterRole(role.guild, role.id);
			await logger.log(`🗑️ Deleted invalid custom role: ${role.name} (${role.id}) - has ${memberCount} members (should be exactly 1)`);
		}

		for (const [userId, roleId] of supporterRoles.entries()) {
			if (roleId === role.id) {
				supporterRoles.delete(userId);
				break;
			}
		}
	} catch (err) {
		await logger.log(`⚠️ Could not cleanup invalid role ${role.name} (${role.id}): ${(err as Error).message}`);
	}
}

async function hasSupporterRole(member: GuildMember | PartialGuildMember) {
	try {
		if (supporterRoles.has(member.id)) {
			const roleId = supporterRoles.get(member.id);
			const role = member.guild.roles.cache.get(roleId);
			if (role) {
				return { has: true, role };
			}
		}

		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			return { has: false };
		}

		const user = member.user || member;
		const discordMemberId = user?.id || member.id;

		const server = await db.getServerByDiscordId(botConfig.id, member.guild.id);
		if (!server) {
			return { has: false };
		}

		const result = await db.memberHasCustomSupporterRole(discordMemberId, server.id);

		if (result.has && result.role) {
			const roleIdToFind = result.role.discord_role_id;
			const role = roleIdToFind ? member.guild.roles.cache.get(roleIdToFind) : null;
			if (role) {
				supporterRoles.set(member.id, role.id);
				return { has: true, role };
			}
		}

		return { has: false };
	} catch (error) {
		return { has: false };
	}
}

function isValidImageUrl(url: unknown) {
	if (!url || typeof url !== 'string') {
		return false;
	}

	const trimmed = url.trim();

	if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
		return false;
	}

	const lowerUrl = trimmed.toLowerCase();
	const validExtensions = ['.jpg', '.jpeg', '.png'];

	const hasExtension = validExtensions.some((ext) => lowerUrl.endsWith(ext));

	if (!hasExtension) {
		const urlWithoutParams = lowerUrl.split('?')[0].split('#')[0];
		const hasExtensionInPath = validExtensions.some((ext) => urlWithoutParams.endsWith(ext));
		if (hasExtensionInPath) {
			return true;
		}
	} else {
		return true;
	}

	return true;
}

async function uploadedRoleIcon(fields: ModalSubmitFields): Promise<Buffer | string | null> {
	const [file] = uploadedFiles(fields, 'role_icon_upload');
	if (!file) {
		return null;
	}
	try {
		const res = await fetch(file.attachment);
		const sharp = (await import('sharp')).default;
		return await sharp(Buffer.from(await res.arrayBuffer()))
			.resize(ROLE_ICON_SIZE_PX, ROLE_ICON_SIZE_PX, { fit: 'inside', withoutEnlargement: true })
			.png()
			.toBuffer();
	} catch {
		return file.attachment;
	}
}

function parseColor(colorInput: string) {
	const input = String(colorInput ?? '').trim();
	const hex = input.replace(/^#/, '');
	if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
		return parseInt(hex, 16);
	}
	if (/^\d+$/.test(input) && Number(input) <= ROLE_COLOR_MAX) {
		return Number(input);
	}
	return null;
}

class AnchorError extends Error {
	key: string;
	params: Record<string, unknown>;

	constructor(message: string, key: string, params: Record<string, unknown> = {}) {
		super(message);
		this.key = key;
		this.params = params;
	}
}

async function getRolePosition(guild: Guild) {
	const anchor = resolveSupporterAnchor(guild);

	if (!anchor.ok) {
		if (anchor.reason === 'no_booster_role') {
			throw new AnchorError(
				'This server has no Server Booster role yet. It appears once someone boosts the server.',
				'customSupporterRole.anchor.noBoosterRole'
			);
		}
		if (anchor.reason === 'bot_too_low') {
			throw new AnchorError(`The bot's own role must be above ${anchor.anchorRole.name} to create supporter roles.`, 'customSupporterRole.anchor.botTooLow', {
				role: anchor.anchorRole.name
			});
		}
		throw new AnchorError('Could not determine where to place the supporter role.', 'customSupporterRole.anchor.unknown');
	}

	return anchor.basePosition;
}

type RoleFormValues = { name: string; color: string; icon: string };
type RoleModalSpec = { customId: string; titleKey: string };

const ROLE_FORM_FIELDS = [
	{ id: 'role_name', key: 'name', isRequired: true, maxLength: 100 },
	{ id: 'role_color', key: 'color', isRequired: false, maxLength: 20 },
	{ id: 'role_icon', key: 'icon', isRequired: false, maxLength: 500 }
] as const;

function roleFormValues(role: Role): RoleFormValues {
	const icon = role.unicodeEmoji || (role.icon ? role.iconURL({ extension: 'png', size: 256 }) || '' : '');
	return { name: role.name, color: role.color === 0 ? '' : role.hexColor, icon };
}

function supporterRoleModal(tr: Translator, { customId, titleKey }: RoleModalSpec, current: RoleFormValues | null) {
	const rows = ROLE_FORM_FIELDS.map((field) => {
		const input = new TextInputBuilder()
			.setCustomId(field.id)
			.setLabel(tr(`customSupporterRole.create.${field.key}Label`))
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(tr(`customSupporterRole.create.${field.key}Placeholder`))
			.setRequired(field.isRequired)
			.setMaxLength(field.maxLength);
		const value = current?.[field.key];
		if (value) {
			input.setValue(value);
		}
		return new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input);
	});
	const modal = new ModalBuilder().setCustomId(customId).setTitle(tr(titleKey));
	modal.addComponents(...rows);
	modal.addLabelComponents(imageUploadField(tr('customSupporterRole.create.iconUploadLabel'), 'role_icon_upload', 1));
	return modal;
}

async function existingRolePanel(interaction: MessageComponentInteraction<'cached'>, role: Role, tr: Translator) {
	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const buttonRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder().setCustomId('custom_supporter_role_edit').setLabel(tr('customSupporterRole.buttons.edit')).setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('custom_supporter_role_delete').setLabel(tr('customSupporterRole.buttons.delete')).setStyle(ButtonStyle.Danger),
		await menuBackButton(interaction.guild.id, interaction.user.id, 'perks')
	);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('customSupporterRole.existing.title'))
		.setDescription(tr('customSupporterRole.existing.description', { roleName: role.name }))
		.addFields({ name: tr('customSupporterRole.existing.currentRole'), value: `<@&${role.id}>`, inline: false })
		.setTimestamp();
	return { embeds: [embed], components: [buttonRow] };
}

export async function handleCustomSupporterRoleButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		await member.fetch().catch(() => null);
		const { has: hasRole, role: existingRole } = await hasSupporterRole(member);
		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);

		if (hasRole && existingRole) {
			await interaction.update(await existingRolePanel(interaction, existingRole, tr));
			await logger.log(`💎 Supporter role options shown to ${member.user.tag} (${member.user.id})`);
			return;
		}

		await interaction.showModal(supporterRoleModal(tr, { customId: 'custom_supporter_role_create', titleKey: 'customSupporterRole.create.title' }, null));
		await logger.log(`💎 Supporter role creation modal shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing supporter role modal: ${(error as Error).message}`);
		const errorMsg = await translate(
			'customSupporterRole.errors.failed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
		);
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
	}
}

export async function handleEditCustomSupporterRole(interaction: ButtonInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.update({ content: errorMessage, components: [], embeds: [] })
				.catch(() => interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null));
			return;
		}

		await member.fetch().catch(() => null);
		const { has: hasRole, role: existingRole } = await hasSupporterRole(member);
		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);

		if (!hasRole || !existingRole) {
			await interaction.reply({ content: tr('customSupporterRole.errors.noRole'), flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.showModal(
			supporterRoleModal(tr, { customId: 'custom_supporter_role_edit', titleKey: 'customSupporterRole.create.editTitle' }, roleFormValues(existingRole))
		);
		await logger.log(`💎 Supporter role edit modal shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing edit modal: ${(error as Error).message}`);
		const errorMsg = await translate(
			'customSupporterRole.errors.editFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
		);
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
	}
}

export async function handleDeleteCustomSupporterRole(interaction: MessageComponentInteraction<'cached'> | ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferUpdate();

		const { member } = interaction;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.followUp({
					content: errorMessage,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		try {
			await member.fetch();
		} catch (e) {}

		const { has: hasRole, role: existingRole } = await hasSupporterRole(member);

		if (!hasRole || !existingRole) {
			const errorMsg = await translate('customSupporterRole.errors.noRoleDelete', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.followUp({
				content: errorMsg,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const roleName = existingRole.name;
		const roleId = existingRole.id;

		await member.roles.remove(existingRole, `User deleted their custom supporter role`);

		await existingRole.delete(`Custom supporter role deleted by ${member.user.tag} (${member.user.id})`);

		await forgetSupporterRole(interaction.guild, roleId);
		supporterRoles.delete(member.id);

		const embedConfig = await getEmbedConfig(interaction.guild.id);
		const deletedTitle = await translate('customSupporterRole.deleted.title', { guildId: interaction.guild.id, userId: interaction.user.id });
		const deletedDescription = await translate(
			'customSupporterRole.deleted.description',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ roleName }
		);
		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(deletedTitle)
			.setDescription(deletedDescription)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		await interaction.editReply({
			embeds: [successEmbed],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(await menuBackButton(interaction.guild.id, interaction.user.id, 'perks'))
			]
		});

		await logger.log(`🗑️ Deleted custom supporter role "${roleName}" (${roleId}) for ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error deleting supporter role: ${(error as Error).message}`);
		const errorMsg = await translate(
			'customSupporterRole.errors.deleteFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{
				error: await errorReason(error, interaction.guild.id, interaction.user.id)
			}
		);
		await interaction.followUp({
			content: errorMsg,
			flags: MessageFlags.Ephemeral
		});
	}
}

type IconEdit = { input: string; uploaded: Buffer | string | null; reason: string | undefined };
type IconOutcome = { status: string; error: string | null };

async function setEditedRoleIcon(role: Role, edit: IconEdit, tr: Translator): Promise<IconOutcome> {
	const image = edit.uploaded ?? (edit.input.startsWith('http://') || edit.input.startsWith('https://') ? edit.input : null);
	if (!image) {
		await role.edit({ unicodeEmoji: edit.input, reason: edit.reason });
		await logger.log(`✅ Set role icon to emoji: ${edit.input}`);
		return { status: 'updated', error: null };
	}
	const { premiumTier } = role.guild;
	if (premiumTier < 2) {
		await logger.log(`⚠️ Cannot set custom icon: Server needs Level 2 boost (current: ${premiumTier})`);
		return { status: 'failed', error: tr('customSupporterRole.iconErrors.boost') };
	}
	if (!edit.uploaded && !isValidImageUrl(image)) {
		await logger.log(`⚠️ Invalid image URL format. Must be JPG/PNG image URL (http:// or https://).`);
		return { status: 'invalid', error: tr('customSupporterRole.iconErrors.invalidFormat') };
	}
	await role.setIcon(image, edit.reason);
	await logger.log(`✅ Set role icon to ${edit.uploaded ? 'uploaded image' : `image URL: ${image}`}`);
	return { status: 'updated', error: null };
}

async function applyEditedRoleIcon(role: Role, edit: IconEdit, tr: Translator): Promise<IconOutcome> {
	if (!edit.input && !edit.uploaded) {
		try {
			await role.edit({ icon: null, unicodeEmoji: null, reason: edit.reason });
			return { status: 'cleared', error: null };
		} catch (err) {
			await logger.log(`⚠️ Could not clear role icon: ${(err as Error).message}`);
			return { status: 'unchanged', error: null };
		}
	}
	try {
		return await setEditedRoleIcon(role, edit, tr);
	} catch (err) {
		const { message } = err as Error;
		await logger.log(`⚠️ Could not set role icon: ${message}`);
		return { status: 'failed', error: message?.includes('boost') ? tr('customSupporterRole.iconErrors.boost') : message };
	}
}

type SubmittedRole = { name: string; color: string; icon: string };

function readSubmittedRole(fields: ModalSubmitFields): SubmittedRole | null {
	const name = fields.getTextInputValue('role_name').trim();
	if (!name || name.length > DISCORD_LIMITS.ROLE_NAME) {
		return null;
	}
	return {
		name,
		color: fields.getTextInputValue('role_color')?.trim() || '',
		icon: fields.getTextInputValue('role_icon')?.trim() || ''
	};
}

function capitalize(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

async function updatedRoleEmbed(tr: Translator, { role, submitted, icon }: { role: Role; submitted: SubmittedRole; icon: IconOutcome }) {
	const embedConfig = await getEmbedConfig(role.guild.id);
	let description = tr('customSupporterRole.updated.description', { roleName: submitted.name, iconWarning: '' });
	if (icon.status === 'failed' || icon.status === 'invalid') {
		description += `\n\n${tr('customSupporterRole.updated.iconNote', { message: icon.error || tr('customSupporterRole.updated.iconFailedFallback') })}`;
	}
	const details = tr('customSupporterRole.updated.roleDetailsValue', {
		name: submitted.name,
		color: submitted.color || tr('customSupporterRole.colorDefault'),
		icon: tr(`customSupporterRole.updated.iconStatus${capitalize(icon.status)}`)
	});
	return new EmbedBuilder()
		.setTitle(tr('customSupporterRole.updated.title'))
		.setDescription(description)
		.setColor(embedConfig.COLOR)
		.addFields([
			{ name: tr('customSupporterRole.updated.roleDetails'), value: details, inline: false },
			{ name: tr('customSupporterRole.updated.role'), value: `<@&${role.id}>`, inline: true }
		])
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
}

async function updateSupporterRole(interaction: ModalSubmitInteraction<'cached'>, role: Role, tr: Translator) {
	const { member } = interaction;
	try {
		const submitted = readSubmittedRole(interaction.fields);
		if (!submitted) {
			await interaction.editReply({ content: tr('customSupporterRole.errors.invalidName') });
			return;
		}

		const roleColor = parseColor(submitted.color);
		const updateData: RoleEditOptions = { name: submitted.name, reason: `Custom supporter role updated for ${member.user.tag} (${member.user.id})` };
		if (roleColor !== null) {
			updateData.color = roleColor;
		} else if (submitted.color === '') {
			updateData.color = 0;
		}
		await role.edit(updateData);

		const icon = await applyEditedRoleIcon(
			role,
			{ input: submitted.icon, uploaded: await uploadedRoleIcon(interaction.fields), reason: updateData.reason },
			tr
		);
		await interaction.editReply({ embeds: [await updatedRoleEmbed(tr, { role, submitted, icon })] });
		await logger.log(`✅ Updated custom supporter role "${submitted.name}" (${role.id}) for ${member.user.tag} (${member.user.id})`);
	} catch (err) {
		await logger.log(`❌ Error updating supporter role: ${(err as Error).message}`);
		await logger.log(`❌ Stack: ${(err as Error).stack}`);
		await interaction.editReply({ content: tr('customSupporterRole.errors.updateFailed', { error: errorReasonFor(tr, err) }) }).catch(() => null);
	}
}

export async function handleCustomSupporterRoleEditModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member } = interaction;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const { has: hasExistingRole, role: existingRole } = await hasSupporterRole(member);
		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
		if (!hasExistingRole || !existingRole) {
			await interaction.editReply({ content: tr('customSupporterRole.errors.noRole') });
			return;
		}

		await updateSupporterRole(interaction, existingRole, tr);
	} catch (error) {
		await logger.log(`❌ Error handling custom supporter role edit modal: ${(error as Error).message}`);
	}
}

type CreateIconPlan = { image: Buffer | string | null; emoji: string | null; isUploaded: boolean };
type CreatedIcon = { status: 'none' | 'success' | 'failed' | 'invalid'; warningKey: string | null };

const CREATED_ICON_STATUS_KEYS: Record<CreatedIcon['status'], string> = {
	none: 'customSupporterRole.created.iconStatusNone',
	success: 'customSupporterRole.created.iconStatusSet',
	failed: 'customSupporterRole.created.iconStatusFailed',
	invalid: 'customSupporterRole.created.iconStatusInvalid'
};

function planCreateIcon(input: string, uploaded: Buffer | string | null): CreateIconPlan {
	if (uploaded || input.startsWith('http://') || input.startsWith('https://')) {
		return { image: uploaded ?? input, emoji: null, isUploaded: Boolean(uploaded) };
	}
	return { image: null, emoji: input || null, isUploaded: false };
}

async function recordSupporterRoleOwnership(member: GuildMember, role: Role) {
	try {
		const botConfig = getBotConfig();
		const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, member.guild.id) : null;
		if (server) {
			await db.setMemberCustomSupporterRole(server.id, member.user.id, {
				id: role.id,
				name: role.name,
				position: role.position,
				hexColor: role.hexColor,
				permissions: role.permissions
			});
		}
	} catch (err) {
		await logger.log(`⚠️ Could not record supporter role ownership: ${(err as Error).message}`);
	}
}

async function setCreatedRoleIcon(role: Role, plan: CreateIconPlan, reason: string | undefined): Promise<CreatedIcon> {
	if (plan.emoji) {
		await logger.log(`✅ Set role icon to emoji during creation: ${plan.emoji}`);
		return { status: 'success', warningKey: null };
	}
	if (!plan.image) {
		return { status: 'none', warningKey: null };
	}
	try {
		if (!plan.isUploaded && !isValidImageUrl(plan.image)) {
			await logger.log(`⚠️ Invalid image URL format. Must be JPG/PNG image URL (http:// or https://). Role created without icon.`);
			return { status: 'invalid', warningKey: 'customSupporterRole.created.iconWarningGeneric' };
		}
		await role.setIcon(plan.image, reason);
		await logger.log(`✅ Set role icon to ${plan.isUploaded ? 'uploaded image' : `image URL: ${plan.image}`}`);
		return { status: 'success', warningKey: null };
	} catch (err) {
		const { message } = err as Error;
		await logger.log(`⚠️ Could not set role icon: ${message}`);
		await logger.log(`⚠️ Note: Role created successfully without icon. Icon requires server boost level 2+ and accessible JPG/PNG image.`);
		return {
			status: 'failed',
			warningKey: message?.includes('boost') ? 'customSupporterRole.created.iconWarningBoost' : 'customSupporterRole.created.iconWarningGeneric'
		};
	}
}

async function createdRoleEmbed(tr: Translator, { role, submitted, icon }: { role: Role; submitted: SubmittedRole; icon: CreatedIcon }) {
	const embedConfig = await getEmbedConfig(role.guild.id);
	const details = tr('customSupporterRole.created.roleDetailsValue', {
		name: submitted.name,
		color: submitted.color || tr('customSupporterRole.colorDefault'),
		icon: tr(CREATED_ICON_STATUS_KEYS[icon.status])
	});
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('customSupporterRole.created.title'))
		.setDescription(tr('customSupporterRole.created.description', { roleName: submitted.name, iconWarning: icon.warningKey ? tr(icon.warningKey) : '' }))
		.addFields([
			{ name: tr('customSupporterRole.created.roleDetails'), value: details, inline: false },
			{ name: tr('customSupporterRole.created.role'), value: `<@&${role.id}>`, inline: true }
		])
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
}

function createFailureMessage(tr: Translator, error: unknown) {
	if (error instanceof AnchorError) {
		return tr('customSupporterRole.errors.createFailedReason', { reason: tr(error.key, error.params) });
	}
	const message = (error as Error).message ?? '';
	if (message.includes('boost') || message.includes('Boost') || message.includes('more boosts')) {
		return tr('customSupporterRole.errors.boostRequiredCreate');
	}
	return tr('customSupporterRole.errors.createFailed', { error: errorReasonFor(tr, error) });
}

async function createSupporterRole(member: GuildMember, { submitted, plan }: { submitted: SubmittedRole; plan: CreateIconPlan }) {
	const { guild } = member;
	const roleColor = parseColor(submitted.color);
	const roleData: RoleCreateOptions = {
		name: submitted.name,
		mentionable: false,
		hoist: true,
		reason: `Custom supporter role for ${member.user.tag} (${member.user.id})`,
		...(roleColor !== null ? { color: roleColor } : {}),
		...(plan.emoji ? { unicodeEmoji: plan.emoji } : {})
	};

	const position = await getRolePosition(guild);
	const newRole = await guild.roles.create(roleData);
	await newRole.setPosition(position, { reason: roleData.reason }).catch((err) => logger.log(`⚠️ Could not set role position: ${(err as Error).message}`));
	await recordSupporterRoleOwnership(member, newRole);

	const icon = await setCreatedRoleIcon(newRole, plan, roleData.reason);
	await member.roles.add(newRole, roleData.reason);
	supporterRoles.set(member.id, newRole.id);
	return { role: newRole, icon };
}

export async function handleCustomSupporterRoleModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member, guild } = interaction;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const tr = await memberTranslator(guild.id, interaction.user.id);
		const { has: hasExistingRole, role: existingRole } = await hasSupporterRole(member);
		if (hasExistingRole && existingRole) {
			await interaction.editReply({ content: tr('customSupporterRole.errors.alreadyHasRole') });
			return;
		}

		const submitted = readSubmittedRole(interaction.fields);
		if (!submitted) {
			await interaction.editReply({ content: tr('customSupporterRole.errors.invalidName') });
			return;
		}

		const plan = planCreateIcon(submitted.icon, await uploadedRoleIcon(interaction.fields));
		if (plan.image && guild.premiumTier < 2) {
			await interaction.editReply({ content: tr('customSupporterRole.errors.boostRequired') });
			return;
		}

		const { role, icon } = await createSupporterRole(member, { submitted, plan });
		await interaction.editReply({ embeds: [await createdRoleEmbed(tr, { role, submitted, icon })] });
		await logger.log(`✅ Created custom supporter role "${submitted.name}" (${role.id}) for ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error creating supporter role: ${(error as Error).message}`);
		await logger.log(`❌ Stack: ${(error as Error).stack}`);
		try {
			const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
			await interaction.editReply({ content: createFailureMessage(tr, error) });
		} catch (err) {
			await logger.log(`❌ Failed to send error response: ${(err as Error).message}`);
		}
	}
}

async function removeCustomRoleIfNoPermission(member: GuildMember) {
	const { has: hasRole, role } = await hasSupporterRole(member);
	if (!hasRole || !role) {
		return;
	}

	if (await hasPermission(member, 'custom_supporter_role')) {
		return;
	}

	try {
		await member.roles.remove(role, `User lost permission for custom role`);

		await role.delete(`User ${member.user.tag} (${member.user.id}) lost permission for custom role`);

		await forgetSupporterRole(member.guild, role.id);
		supporterRoles.delete(member.id);

		await logger.log(`🗑️ Removed custom role ${role.name} (${role.id}) from ${member.user.tag} (${member.user.id}) - no longer has permission`);
	} catch (err) {
		await logger.log(`⚠️ Could not remove custom role for ${member.user.tag}: ${(err as Error).message}`);
	}
}

async function revokeUnpermittedRole(owner: GuildMember, role: Role): Promise<boolean> {
	if (await hasPermission(owner, 'custom_supporter_role')) {
		return false;
	}
	try {
		await owner.roles.remove(role, `User lost permission for custom role`);
		await role.delete(`Auto-cleanup: Owner no longer has permission`);
		await forgetSupporterRole(owner.guild, role.id);
		await logger.log(`🗑️ Deleted custom role: ${role.name} (${role.id}) - owner ${owner.user.tag} (${owner.id}) no longer has permission`);
		supporterRoles.delete(owner.id);
		return true;
	} catch (err) {
		await logger.log(`⚠️ Could not delete role ${role.name} (${role.id}): ${(err as Error).message}`);
		return false;
	}
}

async function cleanupOwnedRole(guild: Guild, [roleId, ownerMemberId]: [string, string], ownedRoleIds: OwnedRoles): Promise<boolean> {
	const role = guild.roles.cache.get(roleId);
	if (!role) {
		await forgetSupporterRole(guild, roleId);
		return false;
	}

	if (role.members.size !== 1) {
		await cleanupInvalidRole(role, ownedRoleIds);
		return true;
	}

	const ownerId = role.members.first()?.id || ownerMemberId || null;
	if (!ownerId) {
		return false;
	}
	supporterRoles.set(ownerId, role.id);

	const owner = guild.members.cache.get(ownerId);
	if (!owner) {
		await cleanupInvalidRole(role, ownedRoleIds);
		return true;
	}

	return revokeUnpermittedRole(owner, role);
}

async function cleanupGuildCustomRoles(guild: Guild): Promise<number> {
	const ownedRoleIds = await getOwnedSupporterRoleIds(guild);
	if (!ownedRoleIds || ownedRoleIds.size === 0) {
		return 0;
	}

	await guild.members.fetch();

	let cleanedCount = 0;
	for (const entry of ownedRoleIds.entries()) {
		try {
			if (await cleanupOwnedRole(guild, entry, ownedRoleIds)) {
				cleanedCount++;
			}
		} catch (err) {
			await logger.log(`⚠️ Error checking role ${entry[0]}: ${(err as Error).message}`);
		}
	}
	return cleanedCount;
}

async function cleanupCustomRoles(client: Client) {
	try {
		await logger.log(`🧹 Checking for custom roles to clean up...`);

		let cleanedCount = 0;

		for (const guild of client.guilds.cache.values()) {
			try {
				cleanedCount += await cleanupGuildCustomRoles(guild);
			} catch (err) {
				await logger.log(`⚠️ Error checking guild ${guild.name} for cleanup: ${(err as Error).message}`);
			}
		}

		if (cleanedCount > 0) {
			await logger.log(`✅ Cleanup complete: Removed ${cleanedCount} custom role(s)`);
		} else {
			await logger.log(`✅ Cleanup complete: No roles to remove`);
		}
	} catch (err) {
		await logger.log(`❌ Error during custom role cleanup: ${(err as Error).message}`);
	}
}

async function adoptLegacyCustomRoles(guild: Guild) {
	let adopted = 0;

	const constraints = await CUSTOM_SUPPORTER_ROLE.getStoredRoleConstraints(guild.id).catch(() => null);
	if (!constraints) {
		return adopted;
	}

	if (!constraints?.ROLE_START || !constraints?.ROLE_END) {
		return adopted;
	}

	const startRole = guild.roles.cache.get(constraints.ROLE_START);
	const endRole = guild.roles.cache.get(constraints.ROLE_END);
	if (!startRole || !endRole) {
		return adopted;
	}

	const botConfig = getBotConfig();
	const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
	if (!server) {
		return adopted;
	}

	const legacyRoles = guild.roles.cache.filter((role: Role) => role.position < startRole.position && role.position > endRole.position && !role.managed);

	for (const role of legacyRoles.values()) {
		if (role.members.size !== 1) {
			await logger.log(`⏭️ Legacy custom role ${role.name} (${role.id}) has ${role.members.size} members - left untouched`);
			continue;
		}

		const owner = role.members.first();
		if (!owner) {
			continue;
		}

		try {
			await db.setMemberCustomSupporterRole(server.id, owner.id, {
				id: role.id,
				name: role.name,
				position: role.position,
				hexColor: role.hexColor,
				permissions: role.permissions
			});
			supporterRoles.set(owner.id, role.id);
			adopted++;

			const anchor = resolveSupporterAnchor(guild);
			if (anchor.ok && role.position !== anchor.basePosition) {
				await role.setPosition(anchor.basePosition, { reason: 'Re-anchored above Server Booster role' }).catch(async (err) => {
					await logger.log(`⚠️ Could not re-anchor ${role.name} (${role.id}): ${err.message}`);
				});
			}

			await logger.log(`✅ Adopted legacy custom role: ${role.name} (${role.id}) for ${owner.user.tag} (${owner.id})`);
		} catch (err) {
			await logger.log(`⚠️ Could not adopt legacy custom role ${role.name} (${role.id}): ${(err as Error).message}`);
		}
	}

	return adopted;
}

async function validateOwnedRole(guild: Guild, [roleId, ownerMemberId]: [string, string], ownedRoleIds: OwnedRoles): Promise<boolean> {
	const role = guild.roles.cache.get(roleId);
	if (!role) {
		await forgetSupporterRole(guild, roleId);
		return false;
	}

	if (role.members.size !== 1) {
		if (ownerMemberId) {
			await cleanupInvalidRole(role, ownedRoleIds);
		}
		return false;
	}

	const member = role.members.first();
	if (!member) {
		return false;
	}
	supporterRoles.set(member.id, role.id);
	return true;
}

async function validateGuildCustomRoles(guild: Guild): Promise<number> {
	const ownedRoleIds = await getOwnedSupporterRoleIds(guild);
	if (!ownedRoleIds || ownedRoleIds.size === 0) {
		return 0;
	}

	let validatedCount = 0;
	for (const entry of ownedRoleIds.entries()) {
		try {
			if (await validateOwnedRole(guild, entry, ownedRoleIds)) {
				validatedCount++;
			}
		} catch (err) {
			await logger.log(`⚠️ Error validating role ${entry[0]}: ${(err as Error).message}`);
		}
	}
	return validatedCount;
}

async function scanAndValidateCustomRoles(client: Client) {
	try {
		await logger.log(`🔍 Scanning for existing custom roles...`);

		let validatedCount = 0;
		let adoptedCount = 0;

		for (const guild of client.guilds.cache.values()) {
			try {
				await guild.members.fetch();
				adoptedCount += await adoptLegacyCustomRoles(guild);
				validatedCount += await validateGuildCustomRoles(guild);
			} catch (err) {
				await logger.log(`⚠️ Error scanning guild ${guild.name}: ${(err as Error).message}`);
			}
		}

		await logger.log(`✅ Scan complete: Validated ${validatedCount} custom role(s), adopted ${adoptedCount} legacy role(s)`);
	} catch (err) {
		await logger.log(`❌ Error scanning custom roles: ${(err as Error).message}`);
	}
}

export function init(client: Client) {
	client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
		try {
			const oldRoles = oldMember.roles.cache;
			const newRoles = newMember.roles.cache;
			const areRolesUnchanged = oldRoles.size === newRoles.size && oldRoles.every((r) => newRoles.has(r.id));
			const isBoostUnchanged = (oldMember.premiumSince?.getTime() ?? null) === (newMember.premiumSince?.getTime() ?? null);

			if (areRolesUnchanged && isBoostUnchanged) {
				return;
			}

			await removeCustomRoleIfNoPermission(newMember);
		} catch (err) {
			await logger.log(`❌ Error checking custom role permissions on member update: ${(err as Error).message}`);
		}
	});

	client.on('guildMemberRemove', async (member: GuildMember | PartialGuildMember) => {
		try {
			const { has: hasRole, role } = await hasSupporterRole(member);
			if (hasRole && role) {
				setTimeout(async () => {
					try {
						const updatedRole = member.guild.roles.cache.get(role.id);
						if (updatedRole && updatedRole.members.size === 0) {
							await updatedRole.delete(`Auto-cleanup: Member left server and role has no members`);
							await forgetSupporterRole(member.guild, role.id);
							await logger.log(`🗑️ Deleted custom role ${role.name} (${role.id}) - member left and role unused`);
							supporterRoles.delete(member.id);
						}
					} catch (err) {}
				}, EMPTY_ROLE_DELETE_DELAY_SECONDS * SECOND_MS);
			}
		} catch (err) {
			await logger.log(`❌ Error checking custom role on member leave: ${(err as Error).message}`);
		}
	});

	setTimeout(async () => {
		await scanAndValidateCustomRoles(client);
	}, STARTUP_SCAN_DELAY_SECONDS * SECOND_MS);

	setInterval(async () => {
		await cleanupCustomRoles(client);
	}, CLEANUP_INTERVAL_HOURS * HOUR_MS);
}

export default { init };
