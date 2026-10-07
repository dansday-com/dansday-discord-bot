import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getEmbedConfig, CUSTOM_SUPPORTER_ROLE, getBotConfig } from '../../../../config.js';
import { logger } from '../../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { resolveSupporterAnchor } from '../roleAnchor.js';
import db from '../../../../../database.js';
import { memberTranslator, translate, errorReason, errorReasonFor } from '../../i18n.js';
import { menuBackButton } from './menuBack.js';
import { imageUploadField, uploadedFiles } from './formFields.js';

const supporterRoles = new Map();

async function getOwnedSupporterRoleIds(guild) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig?.id) return null;
		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
		if (!server) return null;
		const owned = await db.listCustomSupporterRoles(server.id);
		return new Map(owned.map((r) => [r.discord_role_id, r.discord_member_id]));
	} catch (err) {
		return null;
	}
}

async function forgetSupporterRole(guild, discordRoleId) {
	try {
		const botConfig = getBotConfig();
		const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
		if (server) await db.clearMemberCustomSupporterRole(server.id, discordRoleId);
	} catch (err) {}
}

async function cleanupInvalidRole(role, ownedRoleIds) {
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
		await logger.log(`⚠️ Could not cleanup invalid role ${role.name} (${role.id}): ${err.message}`);
	}
}

async function hasSupporterRole(member) {
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
			const roleIdToFind = result.role.discord_role_id || result.role.role_id;
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

function isValidImageUrl(url) {
	if (!url || typeof url !== 'string') return false;

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

async function uploadedRoleIcon(fields): Promise<Buffer | string | null> {
	const [file] = uploadedFiles(fields, 'role_icon_upload');
	if (!file) return null;
	try {
		const res = await fetch(file.attachment);
		const sharp = (await import('sharp')).default;
		return await sharp(Buffer.from(await res.arrayBuffer()))
			.resize(128, 128, { fit: 'inside', withoutEnlargement: true })
			.png()
			.toBuffer();
	} catch {
		return file.attachment;
	}
}

function parseColor(colorInput) {
	const input = String(colorInput ?? '').trim();
	const hex = input.replace(/^#/, '');
	if (/^[0-9A-Fa-f]{6}$/.test(hex)) return parseInt(hex, 16);
	if (/^\d+$/.test(input) && Number(input) <= 0xffffff) return Number(input);
	return null;
}

class AnchorError extends Error {
	key: string;
	params: Record<string, any>;

	constructor(message: string, key: string, params: Record<string, any> = {}) {
		super(message);
		this.key = key;
		this.params = params;
	}
}

async function getRolePosition(guild) {
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

export async function handleCustomSupporterRoleButton(interaction) {
	try {
		const member = interaction.member;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		try {
			await member.fetch();
		} catch (e) {}

		const { has, role: existingRole } = await hasSupporterRole(member);

		if (has && existingRole) {
			const editLabel = await translate('customSupporterRole.buttons.edit', interaction.guild.id, interaction.user.id);
			const deleteLabel = await translate('customSupporterRole.buttons.delete', interaction.guild.id, interaction.user.id);
			const editButton = new ButtonBuilder().setCustomId('custom_supporter_role_edit').setLabel(editLabel).setStyle(ButtonStyle.Primary);

			const deleteButton = new ButtonBuilder().setCustomId('custom_supporter_role_delete').setLabel(deleteLabel).setStyle(ButtonStyle.Danger);

			const menuButton = await menuBackButton(interaction.guild.id, interaction.user.id, 'perks');

			const buttonRow = new ActionRowBuilder().addComponents(editButton, deleteButton, menuButton);

			const embedConfig = await getEmbedConfig(interaction.guild.id);
			const title = await translate('customSupporterRole.existing.title', interaction.guild.id, interaction.user.id);
			const description = await translate('customSupporterRole.existing.description', interaction.guild.id, interaction.user.id, {
				roleName: existingRole.name
			});
			const currentRoleLabel = await translate('customSupporterRole.existing.currentRole', interaction.guild.id, interaction.user.id);
			const embed = new EmbedBuilder()
				.setColor(embedConfig.COLOR)
				.setTitle(title)
				.setDescription(description)
				.addFields({
					name: currentRoleLabel,
					value: `<@&${existingRole.id}>`,
					inline: false
				})
				.setTimestamp();

			await interaction.update({
				embeds: [embed],
				components: [buttonRow]
			});
			await logger.log(`💎 Supporter role options shown to ${member.user.tag} (${member.user.id})`);
			return;
		}

		const modalTitle = await translate('customSupporterRole.create.title', interaction.guild.id, interaction.user.id);
		const modal = new ModalBuilder().setCustomId('custom_supporter_role_create').setTitle(modalTitle);

		const nameLabel = await translate('customSupporterRole.create.nameLabel', interaction.guild.id, interaction.user.id);
		const namePlaceholder = await translate('customSupporterRole.create.namePlaceholder', interaction.guild.id, interaction.user.id);
		const nameInput = new TextInputBuilder()
			.setCustomId('role_name')
			.setLabel(nameLabel)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(namePlaceholder)
			.setRequired(true)
			.setMaxLength(100);

		const colorLabel = await translate('customSupporterRole.create.colorLabel', interaction.guild.id, interaction.user.id);
		const colorPlaceholder = await translate('customSupporterRole.create.colorPlaceholder', interaction.guild.id, interaction.user.id);
		const colorInput = new TextInputBuilder()
			.setCustomId('role_color')
			.setLabel(colorLabel)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(colorPlaceholder)
			.setRequired(false)
			.setMaxLength(20);

		const iconLabel = await translate('customSupporterRole.create.iconLabel', interaction.guild.id, interaction.user.id);
		const iconPlaceholder = await translate('customSupporterRole.create.iconPlaceholder', interaction.guild.id, interaction.user.id);
		const iconInput = new TextInputBuilder()
			.setCustomId('role_icon')
			.setLabel(iconLabel)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(iconPlaceholder)
			.setRequired(false)
			.setMaxLength(500);

		const nameRow = new ActionRowBuilder().addComponents(nameInput);
		const colorRow = new ActionRowBuilder().addComponents(colorInput);
		const iconRow = new ActionRowBuilder().addComponents(iconInput);

		modal.addComponents(nameRow, colorRow, iconRow);
		modal.addLabelComponents(
			imageUploadField(await translate('customSupporterRole.create.iconUploadLabel', interaction.guild.id, interaction.user.id), 'role_icon_upload', 1)
		);

		await interaction.showModal(modal);
		await logger.log(`💎 Supporter role creation modal shown to ${member.user.tag} (${member.user.id})`);
	} catch (error: any) {
		await logger.log(`❌ Error showing supporter role modal: ${error.message}`);
		const errorMsg = await translate('customSupporterRole.errors.failed', interaction.guild.id, interaction.user.id, {
			error: await errorReason(error, interaction.guild.id, interaction.user.id)
		});
		await interaction.reply({
			content: errorMsg,
			flags: 64
		});
	}
}

export async function handleEditCustomSupporterRole(interaction) {
	try {
		const member = interaction.member;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.update({
					content: errorMessage,
					components: [],
					embeds: [],
					flags: 64
				})
				.catch(() =>
					interaction
						.reply({
							content: errorMessage,
							flags: 64
						})
						.catch(() => null)
				);
			return;
		}

		try {
			await member.fetch();
		} catch (e) {}

		const { has, role: existingRole } = await hasSupporterRole(member);

		if (!has || !existingRole) {
			const errorMsg = await translate('customSupporterRole.errors.noRole', interaction.guild.id, interaction.user.id);
			await interaction.reply({
				content: errorMsg,
				flags: 64
			});
			return;
		}

		const editModalTitle = await translate('customSupporterRole.create.editTitle', interaction.guild.id, interaction.user.id);
		const modal = new ModalBuilder().setCustomId('custom_supporter_role_edit').setTitle(editModalTitle);

		const currentName = existingRole.name;
		const currentColor = existingRole.color === 0 ? '' : existingRole.hexColor;
		let currentIcon = '';
		if (existingRole.unicodeEmoji) {
			currentIcon = existingRole.unicodeEmoji;
		} else if (existingRole.icon) {
			currentIcon = existingRole.iconURL({ extension: 'png', size: 256 }) || '';
		}

		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
		const nameInput = new TextInputBuilder()
			.setCustomId('role_name')
			.setLabel(tr('customSupporterRole.create.nameLabel'))
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(tr('customSupporterRole.create.namePlaceholder'))
			.setRequired(true)
			.setMaxLength(100);

		if (currentName) nameInput.setValue(currentName);

		const colorInput = new TextInputBuilder()
			.setCustomId('role_color')
			.setLabel(tr('customSupporterRole.create.colorLabel'))
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(tr('customSupporterRole.create.colorPlaceholder'))
			.setRequired(false)
			.setMaxLength(20);

		if (currentColor) colorInput.setValue(currentColor);

		const iconInput = new TextInputBuilder()
			.setCustomId('role_icon')
			.setLabel(tr('customSupporterRole.create.iconLabel'))
			.setStyle(TextInputStyle.Short)
			.setPlaceholder(tr('customSupporterRole.create.iconPlaceholder'))
			.setRequired(false)
			.setMaxLength(500);

		if (currentIcon) iconInput.setValue(currentIcon);

		const nameRow = new ActionRowBuilder().addComponents(nameInput);
		const colorRow = new ActionRowBuilder().addComponents(colorInput);
		const iconRow = new ActionRowBuilder().addComponents(iconInput);

		modal.addComponents(nameRow, colorRow, iconRow);
		modal.addLabelComponents(imageUploadField(tr('customSupporterRole.create.iconUploadLabel'), 'role_icon_upload', 1));

		await interaction.showModal(modal);
		await logger.log(`💎 Supporter role edit modal shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing edit modal: ${error.message}`);
		const errorMsg = await translate('customSupporterRole.errors.editFailed', interaction.guild.id, interaction.user.id, {
			error: await errorReason(error, interaction.guild.id, interaction.user.id)
		});
		await interaction.reply({
			content: errorMsg,
			flags: 64
		});
	}
}

export async function handleDeleteCustomSupporterRole(interaction) {
	try {
		await interaction.deferUpdate();

		const member = interaction.member;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.followUp({
					content: errorMessage,
					flags: 64
				})
				.catch(() => null);
			return;
		}

		try {
			await member.fetch();
		} catch (e) {}

		const { has, role: existingRole } = await hasSupporterRole(member);

		if (!has || !existingRole) {
			const errorMsg = await translate('customSupporterRole.errors.noRoleDelete', interaction.guild.id, interaction.user.id);
			await interaction.followUp({
				content: errorMsg,
				flags: 64
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
		const deletedTitle = await translate('customSupporterRole.deleted.title', interaction.guild.id, interaction.user.id);
		const deletedDescription = await translate('customSupporterRole.deleted.description', interaction.guild.id, interaction.user.id, { roleName });
		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(deletedTitle)
			.setDescription(deletedDescription)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		await interaction.editReply({
			embeds: [successEmbed],
			components: [new ActionRowBuilder().addComponents(await menuBackButton(interaction.guild.id, interaction.user.id, 'perks'))]
		});

		await logger.log(`🗑️ Deleted custom supporter role "${roleName}" (${roleId}) for ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error deleting supporter role: ${error.message}`);
		const errorMsg = await translate('customSupporterRole.errors.deleteFailed', interaction.guild.id, interaction.user.id, {
			error: await errorReason(error, interaction.guild.id, interaction.user.id)
		});
		await interaction.followUp({
			content: errorMsg,
			flags: 64
		});
	}
}

export async function handleCustomSupporterRoleEditModal(interaction) {
	try {
		await interaction.deferReply({ flags: 64 });

		const member = interaction.member;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.editReply({
					content: errorMessage
				})
				.catch(() => null);
			return;
		}

		const { has: hasExistingRole, role: existingRole } = await hasSupporterRole(member);

		if (!hasExistingRole || !existingRole) {
			const errorMsg = await translate('customSupporterRole.errors.noRole', interaction.guild.id, interaction.user.id);
			await interaction.editReply({
				content: errorMsg
			});
			return;
		}

		try {
			const roleName = interaction.fields.getTextInputValue('role_name').trim();
			const colorInput = interaction.fields.getTextInputValue('role_color')?.trim() || '';
			const iconInput = interaction.fields.getTextInputValue('role_icon')?.trim() || '';

			if (!roleName || roleName.length < 1 || roleName.length > 100) {
				const errorMsg = await translate('customSupporterRole.errors.invalidName', interaction.guild.id, interaction.user.id);
				await interaction.editReply({
					content: errorMsg
				});
				return;
			}

			const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
			const roleColor = parseColor(colorInput);
			const updateData: any = {
				name: roleName,
				reason: `Custom supporter role updated for ${member.user.tag} (${member.user.id})`
			};

			if (roleColor !== null) {
				updateData.color = roleColor;
			} else if (colorInput === '') {
				updateData.color = 0;
			}

			await existingRole.edit(updateData);

			const trimmedIconInput = iconInput?.trim() || '';
			const uploadedIcon = await uploadedRoleIcon(interaction.fields);
			const iconImage = uploadedIcon ?? (trimmedIconInput.startsWith('http://') || trimmedIconInput.startsWith('https://') ? trimmedIconInput : null);
			let iconStatus = 'unchanged';
			let iconError = null;

			if (trimmedIconInput || iconImage) {
				try {
					if (iconImage) {
						const premiumTier = interaction.guild.premiumTier;
						if (premiumTier < 2) {
							iconStatus = 'failed';
							iconError = tr('customSupporterRole.iconErrors.boost');
							await logger.log(`⚠️ Cannot set custom icon: Server needs Level 2 boost (current: ${premiumTier})`);
						} else if (uploadedIcon || isValidImageUrl(iconImage)) {
							await existingRole.setIcon(iconImage, { reason: updateData.reason });
							await logger.log(`✅ Set role icon to ${uploadedIcon ? 'uploaded image' : `image URL: ${iconImage}`}`);
							iconStatus = 'updated';
						} else {
							await logger.log(`⚠️ Invalid image URL format. Must be JPG/PNG image URL (http:// or https://).`);
							iconStatus = 'invalid';
							iconError = tr('customSupporterRole.iconErrors.invalidFormat');
						}
					} else {
						await existingRole.edit({
							unicodeEmoji: trimmedIconInput,
							reason: updateData.reason
						});
						await logger.log(`✅ Set role icon to emoji: ${trimmedIconInput}`);
						iconStatus = 'updated';
					}
				} catch (err: any) {
					await logger.log(`⚠️ Could not set role icon: ${err.message}`);

					if (err.message && err.message.includes('boost')) {
						iconError = tr('customSupporterRole.iconErrors.boost');
					} else {
						iconError = err.message;
					}
					iconStatus = 'failed';
				}
			} else {
				try {
					await existingRole.edit({
						icon: null,
						unicodeEmoji: null,
						reason: updateData.reason
					});
					iconStatus = 'cleared';
				} catch (err: any) {
					await logger.log(`⚠️ Could not clear role icon: ${err.message}`);
				}
			}

			const embedConfig = await getEmbedConfig(interaction.guild.id);
			const successTitle = await translate('customSupporterRole.updated.title', interaction.guild.id, interaction.user.id);
			let successDesc = await translate('customSupporterRole.updated.description', interaction.guild.id, interaction.user.id, {
				roleName: roleName,
				iconWarning: ''
			});

			if (iconStatus === 'failed' || iconStatus === 'invalid') {
				const warnMsg = iconError || tr('customSupporterRole.updated.iconFailedFallback');
				successDesc += `\n\n${tr('customSupporterRole.updated.iconNote', { message: warnMsg })}`;
			}

			const successEmbed = new EmbedBuilder()
				.setTitle(successTitle)
				.setDescription(successDesc)
				.setColor(embedConfig.COLOR)
				.addFields([
					{
						name: await translate('customSupporterRole.updated.roleDetails', interaction.guild.id, interaction.user.id),
						value: await translate('customSupporterRole.updated.roleDetailsValue', interaction.guild.id, interaction.user.id, {
							name: roleName,
							color: colorInput || tr('customSupporterRole.colorDefault'),
							icon: await translate(
								`customSupporterRole.updated.iconStatus${iconStatus.charAt(0).toUpperCase() + iconStatus.slice(1)}`,
								interaction.guild.id,
								interaction.user.id
							)
						}),
						inline: false
					}
				]);

			successEmbed
				.addFields([
					{
						name: await translate('customSupporterRole.updated.role', interaction.guild.id, interaction.user.id),
						value: `<@&${existingRole.id}>`,
						inline: true
					}
				])
				.setTimestamp()
				.setFooter({ text: embedConfig.FOOTER });

			await interaction.editReply({
				embeds: [successEmbed]
			});

			await logger.log(`✅ Updated custom supporter role "${roleName}" (${existingRole.id}) for ${member.user.tag} (${member.user.id})`);
			return;
		} catch (err: any) {
			await logger.log(`❌ Error updating supporter role: ${err.message}`);
			await logger.log(`❌ Stack: ${err.stack}`);

			try {
				const errorMsg = await translate('customSupporterRole.errors.updateFailed', interaction.guild.id, interaction.user.id, {
					error: await errorReason(err, interaction.guild.id, interaction.user.id)
				});
				await interaction.editReply({
					content: errorMsg
				});
			} catch (editErr) {}
			return;
		}
	} catch (error: any) {
		await logger.log(`❌ Error handling custom supporter role edit modal: ${error.message}`);
	}
}

export async function handleCustomSupporterRoleModal(interaction) {
	try {
		await interaction.deferReply({ flags: 64 });

		const member = interaction.member;
		const guild = interaction.guild;

		if (!(await hasPermission(member, 'custom_supporter_role'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'custom_supporter_role', interaction.user.id);
			await interaction
				.editReply({
					content: errorMessage
				})
				.catch(() => null);
			return;
		}

		const { has: hasExistingRole, role: existingRole } = await hasSupporterRole(member);

		if (hasExistingRole && existingRole) {
			const errorMsg = await translate('customSupporterRole.errors.alreadyHasRole', interaction.guild.id, interaction.user.id);
			await interaction.editReply({
				content: errorMsg
			});
			return;
		}

		const roleName = interaction.fields.getTextInputValue('role_name').trim();
		const colorInput = interaction.fields.getTextInputValue('role_color')?.trim() || '';
		const iconInput = interaction.fields.getTextInputValue('role_icon')?.trim() || '';

		if (!roleName || roleName.length < 1 || roleName.length > 100) {
			const errorMsg = await translate('customSupporterRole.errors.invalidName', interaction.guild.id, interaction.user.id);
			await interaction.editReply({
				content: errorMsg
			});
			return;
		}

		const roleColor = parseColor(colorInput);

		const trimmedIconInput = iconInput?.trim() || '';
		const uploadedIcon = await uploadedRoleIcon(interaction.fields);
		let iconStatus = 'none';
		let iconError = null;
		let iconToSet = null;
		let isEmojiIcon = false;

		if (trimmedIconInput || uploadedIcon) {
			if (uploadedIcon || trimmedIconInput.startsWith('http://') || trimmedIconInput.startsWith('https://')) {
				const premiumTier = guild.premiumTier;
				if (premiumTier < 2) {
					const errorMsg = await translate('customSupporterRole.errors.boostRequired', interaction.guild.id, interaction.user.id);
					await interaction.editReply({
						content: errorMsg
					});
					return;
				}

				iconToSet = uploadedIcon ?? trimmedIconInput;
				isEmojiIcon = false;
			} else {
				iconToSet = trimmedIconInput;
				isEmojiIcon = true;
			}
		}

		const roleData: any = {
			name: roleName,
			mentionable: false,
			hoist: true,
			reason: `Custom supporter role for ${member.user.tag} (${member.user.id})`
		};

		if (roleColor !== null) {
			roleData.color = roleColor;
		}

		if (isEmojiIcon && iconToSet) {
			roleData.unicodeEmoji = iconToSet;
		}

		const position = await getRolePosition(guild);

		const newRole = await guild.roles.create(roleData);

		try {
			await newRole.setPosition(position, { reason: roleData.reason });
		} catch (err) {
			await logger.log(`⚠️ Could not set role position: ${err.message}`);
		}

		try {
			const botConfig = getBotConfig();
			const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
			if (server) {
				await db.setMemberCustomSupporterRole(server.id, member.user.id, {
					id: newRole.id,
					name: newRole.name,
					position: newRole.position,
					hexColor: newRole.hexColor,
					permissions: newRole.permissions
				});
			}
		} catch (err) {
			await logger.log(`⚠️ Could not record supporter role ownership: ${err.message}`);
		}

		if (iconToSet && !isEmojiIcon) {
			try {
				if (uploadedIcon || isValidImageUrl(iconToSet)) {
					await newRole.setIcon(iconToSet, { reason: roleData.reason });
					await logger.log(`✅ Set role icon to ${uploadedIcon ? 'uploaded image' : `image URL: ${iconToSet}`}`);
					iconStatus = 'success';
				} else {
					await logger.log(`⚠️ Invalid image URL format. Must be JPG/PNG image URL (http:// or https://). Role created without icon.`);
					iconStatus = 'invalid';
					iconError = 'Invalid URL format or file type';
				}
			} catch (err) {
				await logger.log(`⚠️ Could not set role icon: ${err.message}`);

				if (err.message && err.message.includes('boost')) {
					iconError = 'This server needs Level 2 Server Boost to use custom role icons. You can use an emoji instead!';
				} else {
					iconError = err.message;
				}
				await logger.log(`⚠️ Note: Role created successfully without icon. Icon requires server boost level 2+ and accessible JPG/PNG image.`);
				iconStatus = 'failed';
			}
		} else if (isEmojiIcon && iconToSet) {
			iconStatus = 'success';
			await logger.log(`✅ Set role icon to emoji during creation: ${iconToSet}`);
		}

		await member.roles.add(newRole, roleData.reason);

		supporterRoles.set(member.id, newRole.id);

		let iconStatusKey = 'customSupporterRole.created.iconStatusNone';
		if (iconStatus === 'success') iconStatusKey = 'customSupporterRole.created.iconStatusSet';
		else if (iconStatus === 'failed') iconStatusKey = 'customSupporterRole.created.iconStatusFailed';
		else if (iconStatus === 'invalid') iconStatusKey = 'customSupporterRole.created.iconStatusInvalid';
		const iconStatusText = await translate(iconStatusKey, interaction.guild.id, interaction.user.id);

		let iconWarningText = '';
		if (iconError) {
			if (iconError.includes('boost')) {
				iconWarningText = await translate('customSupporterRole.created.iconWarningBoost', interaction.guild.id, interaction.user.id);
			} else {
				iconWarningText = await translate('customSupporterRole.created.iconWarningGeneric', interaction.guild.id, interaction.user.id);
			}
		}

		const embedConfigForCreate = await getEmbedConfig(interaction.guild.id);
		const successTitle = await translate('customSupporterRole.created.title', interaction.guild.id, interaction.user.id);
		const description = await translate('customSupporterRole.created.description', interaction.guild.id, interaction.user.id, {
			roleName,
			iconWarning: iconWarningText
		});
		const roleDetailsLabel = await translate('customSupporterRole.created.roleDetails', interaction.guild.id, interaction.user.id);
		const roleDetailsValue = await translate('customSupporterRole.created.roleDetailsValue', interaction.guild.id, interaction.user.id, {
			name: roleName,
			color: colorInput || (await translate('customSupporterRole.colorDefault', interaction.guild.id, interaction.user.id)),
			icon: iconStatusText
		});
		const roleLabel = await translate('customSupporterRole.created.role', interaction.guild.id, interaction.user.id);

		const successEmbed = new EmbedBuilder()
			.setColor(embedConfigForCreate.COLOR)
			.setTitle(successTitle)
			.setDescription(description)
			.addFields([
				{
					name: roleDetailsLabel,
					value: roleDetailsValue,
					inline: false
				},
				{
					name: roleLabel,
					value: `<@&${newRole.id}>`,
					inline: true
				}
			])
			.setTimestamp()
			.setFooter({ text: embedConfigForCreate.FOOTER });

		await interaction.editReply({
			embeds: [successEmbed]
		});

		await logger.log(`✅ Created custom supporter role "${roleName}" (${newRole.id}) for ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error creating supporter role: ${error.message}`);
		await logger.log(`❌ Stack: ${error.stack}`);

		try {
			const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
			let errorMessage = '';

			if (error instanceof AnchorError) {
				errorMessage = tr('customSupporterRole.errors.createFailedReason', { reason: tr(error.key, error.params) });
			} else if (error.message && (error.message.includes('boost') || error.message.includes('Boost') || error.message.includes('more boosts'))) {
				errorMessage = tr('customSupporterRole.errors.boostRequiredCreate');
			} else {
				errorMessage = tr('customSupporterRole.errors.createFailed', { error: errorReasonFor(tr, error) });
			}

			await interaction.editReply({
				content: errorMessage
			});
		} catch (err) {
			await logger.log(`❌ Failed to send error response: ${err.message}`);
		}
	}
}

async function removeCustomRoleIfNoPermission(member) {
	const { has, role } = await hasSupporterRole(member);
	if (!has || !role) {
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
		await logger.log(`⚠️ Could not remove custom role for ${member.user.tag}: ${err.message}`);
	}
}

async function cleanupCustomRoles(client) {
	try {
		await logger.log(`🧹 Checking for custom roles to clean up...`);

		let cleanedCount = 0;

		for (const guild of client.guilds.cache.values()) {
			try {
				const ownedRoleIds = await getOwnedSupporterRoleIds(guild);

				if (!ownedRoleIds || ownedRoleIds.size === 0) {
					continue;
				}

				await guild.members.fetch();

				for (const [roleId, ownerMemberId] of ownedRoleIds.entries()) {
					try {
						const role = guild.roles.cache.get(roleId);
						if (!role) {
							await forgetSupporterRole(guild, roleId);
							continue;
						}

						const memberCount = role.members.size;

						if (memberCount !== 1) {
							await cleanupInvalidRole(role, ownedRoleIds);
							if (memberCount === 0 || memberCount > 1) {
								cleanedCount++;
							}
							continue;
						}

						const ownerId = role.members.first()?.id || ownerMemberId || null;
						if (ownerId) {
							supporterRoles.set(ownerId, role.id);
						}

						if (ownerId) {
							const owner = guild.members.cache.get(ownerId);
							if (!owner) {
								await cleanupInvalidRole(role, ownedRoleIds);
								cleanedCount++;
								continue;
							}

							if (!(await hasPermission(owner, 'custom_supporter_role'))) {
								try {
									await owner.roles.remove(role, `User lost permission for custom role`);
									await role.delete(`Auto-cleanup: Owner no longer has permission`);
									await forgetSupporterRole(guild, role.id);
									await logger.log(`🗑️ Deleted custom role: ${role.name} (${role.id}) - owner ${owner.user.tag} (${ownerId}) no longer has permission`);
									supporterRoles.delete(ownerId);
									cleanedCount++;
								} catch (err) {
									await logger.log(`⚠️ Could not delete role ${role.name} (${role.id}): ${err.message}`);
								}
							}
						}
					} catch (err) {
						await logger.log(`⚠️ Error checking role ${roleId}: ${err.message}`);
					}
				}
			} catch (err) {
				await logger.log(`⚠️ Error checking guild ${guild.name} for cleanup: ${err.message}`);
			}
		}

		if (cleanedCount > 0) {
			await logger.log(`✅ Cleanup complete: Removed ${cleanedCount} custom role(s)`);
		} else {
			await logger.log(`✅ Cleanup complete: No roles to remove`);
		}
	} catch (err) {
		await logger.log(`❌ Error during custom role cleanup: ${err.message}`);
	}
}

async function adoptLegacyCustomRoles(guild) {
	let adopted = 0;

	let constraints;
	try {
		constraints = await CUSTOM_SUPPORTER_ROLE.getStoredRoleConstraints(guild.id);
	} catch (error) {
		return adopted;
	}

	if (!constraints?.ROLE_START || !constraints?.ROLE_END) return adopted;

	const startRole = guild.roles.cache.get(constraints.ROLE_START);
	const endRole = guild.roles.cache.get(constraints.ROLE_END);
	if (!startRole || !endRole) return adopted;

	const botConfig = getBotConfig();
	const server = botConfig?.id ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
	if (!server) return adopted;

	const legacyRoles = guild.roles.cache.filter((role) => role.position < startRole.position && role.position > endRole.position && !role.managed);

	for (const role of legacyRoles.values()) {
		if (role.members.size !== 1) {
			await logger.log(`⏭️ Legacy custom role ${role.name} (${role.id}) has ${role.members.size} members - left untouched`);
			continue;
		}

		const owner = role.members.first();
		if (!owner) continue;

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
			await logger.log(`⚠️ Could not adopt legacy custom role ${role.name} (${role.id}): ${err.message}`);
		}
	}

	return adopted;
}

async function scanAndValidateCustomRoles(client) {
	try {
		await logger.log(`🔍 Scanning for existing custom roles...`);

		let validatedCount = 0;
		let adoptedCount = 0;

		for (const guild of client.guilds.cache.values()) {
			try {
				await guild.members.fetch();

				adoptedCount += await adoptLegacyCustomRoles(guild);

				const ownedRoleIds = await getOwnedSupporterRoleIds(guild);
				if (!ownedRoleIds || ownedRoleIds.size === 0) continue;

				for (const [roleId, ownerMemberId] of ownedRoleIds.entries()) {
					try {
						const role = guild.roles.cache.get(roleId);
						if (!role) {
							await forgetSupporterRole(guild, roleId);
							continue;
						}

						if (role.members.size === 1) {
							const member = role.members.first();
							if (member) {
								supporterRoles.set(member.id, role.id);
								validatedCount++;
							}
						} else if (ownerMemberId) {
							await cleanupInvalidRole(role, ownedRoleIds);
						}
					} catch (err) {
						await logger.log(`⚠️ Error validating role ${roleId}: ${err.message}`);
					}
				}
			} catch (err) {
				await logger.log(`⚠️ Error scanning guild ${guild.name}: ${err.message}`);
			}
		}

		await logger.log(`✅ Scan complete: Validated ${validatedCount} custom role(s), adopted ${adoptedCount} legacy role(s)`);
	} catch (err) {
		await logger.log(`❌ Error scanning custom roles: ${err.message}`);
	}
}

export function init(client) {
	client.on('guildMemberUpdate', async (oldMember, newMember) => {
		try {
			const oldRoles = oldMember.roles.cache;
			const newRoles = newMember.roles.cache;
			const rolesUnchanged = oldRoles.size === newRoles.size && oldRoles.every((r) => newRoles.has(r.id));
			const boostUnchanged = (oldMember.premiumSince?.getTime() ?? null) === (newMember.premiumSince?.getTime() ?? null);

			if (rolesUnchanged && boostUnchanged) {
				return;
			}

			await removeCustomRoleIfNoPermission(newMember);
		} catch (err) {
			await logger.log(`❌ Error checking custom role permissions on member update: ${err.message}`);
		}
	});

	client.on('guildMemberRemove', async (member) => {
		try {
			const { has, role } = await hasSupporterRole(member);
			if (has && role) {
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
				}, 5000);
			}
		} catch (err) {
			await logger.log(`❌ Error checking custom role on member leave: ${err.message}`);
		}
	});

	setTimeout(async () => {
		await scanAndValidateCustomRoles(client);
	}, 10000);

	setInterval(
		async () => {
			await cleanupCustomRoles(client);
		},
		6 * 60 * 60 * 1000
	);
}

export default { init };
