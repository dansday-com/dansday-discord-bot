import {
	ActionRowBuilder,
	ButtonBuilder,
	ModalBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	TextInputStyle,
	UserSelectMenuBuilder,
	MessageFlags
} from 'discord.js';
import { durationField, durationValue, textField, type DurationPreset } from './formFields.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { getUserLanguage, translate } from '../../i18n.js';
import { performModerationAction } from '../moderation.js';
import { menuBackButton } from './menuBack.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';
import type {
	ModalSubmitInteraction,
	RepliableInteraction,
	StringSelectMenuInteraction,
	MessageActionRowComponentBuilder,
	ButtonInteraction,
	UserSelectMenuInteraction
} from 'discord.js';
import { MODERATION_REASON_MAX_LENGTH } from '../../../../../moderation-rules.js';

const MENU_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'clearwarns'];
const TIMED_ACTIONS = ['timeout', 'tempban'];
const DURATION_PRESETS: Record<string, DurationPreset[]> = {
	timeout: [
		{ amount: 60, unit: 'second' },
		{ amount: 5, unit: 'minute' },
		{ amount: 10, unit: 'minute' },
		{ amount: 1, unit: 'hour' },
		{ amount: 1, unit: 'day' },
		{ amount: 1, unit: 'week' }
	],
	tempban: [
		{ amount: 1, unit: 'day' },
		{ amount: 3, unit: 'day' },
		{ amount: 1, unit: 'week' },
		{ amount: 2, unit: 'week' },
		{ amount: 30, unit: 'day' }
	]
};

async function backRow(g: string, u: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(await menuBackButton(g, u, 'staff'));
}

async function ensureStaff(interaction: RepliableInteraction<'cached'>) {
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
	if (member && (await hasPermission(member, 'staff_only'))) {
		return true;
	}
	const content = await getPermissionDeniedMessage(interaction.guild, 'staff_only', interaction.user.id);
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content, embeds: [], components: [] }).catch(() => null);
	} else {
		await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
	}
	return false;
}

export async function handleModerationButton(interaction: ButtonInteraction<'cached'>) {
	if (!(await ensureStaff(interaction))) {
		return;
	}
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const select = new UserSelectMenuBuilder()
		.setCustomId('moderation_select_user')
		.setPlaceholder(await translate('moderation.selectUserPlaceholder', { guildId: g, userId: u }))
		.setMinValues(1)
		.setMaxValues(1);
	const payload = {
		content: await translate('moderation.selectUser', { guildId: g, userId: u }),
		embeds: [],
		components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select), await backRow(g, u)]
	};
	await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
}

export async function handleModerationUserSelect(interaction: UserSelectMenuInteraction<'cached'>) {
	if (!(await ensureStaff(interaction))) {
		return;
	}
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const targetId = interaction.values[0];
	const target = interaction.users?.get?.(targetId) ?? (await interaction.client.users.fetch(targetId).catch(() => null));
	if (target?.bot || targetId === interaction.guild.ownerId) {
		await interaction.reply({ content: await translate('moderation.notAllowed', { guildId: g, userId: u }), flags: MessageFlags.Ephemeral });
		return;
	}
	const options = [];
	for (const action of MENU_ACTIONS) {
		options.push({ label: await translate(`moderation.actions.${action}`, { guildId: g, userId: u }), value: action });
	}
	const select = new StringSelectMenuBuilder()
		.setCustomId(`moderation_action|${targetId}`)
		.setPlaceholder(await translate('moderation.selectActionPlaceholder', { guildId: g, userId: u }))
		.addOptions(options);
	await interaction.update({
		content: await translate('moderation.selectAction', { guildId: g, userId: u }, { member: `<@${targetId}>` }),
		components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select), await backRow(g, u)]
	});
}

export async function handleModerationActionSelect(interaction: StringSelectMenuInteraction<'cached'>) {
	if (!(await ensureStaff(interaction))) {
		return;
	}
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const targetId = interaction.customId.split('|')[1];
	const action = interaction.values[0];
	if (!MENU_ACTIONS.includes(action) || !targetId) {
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId(`moderation_modal|${action}|${targetId}`)
		.setTitle(String(await translate(`moderation.actions.${action}`, { guildId: g, userId: u })).slice(0, DISCORD_LIMITS.MODAL_TITLE));
	modal.addLabelComponents(
		textField(
			await translate('moderation.modal.reason', { guildId: g, userId: u }),
			new TextInputBuilder()
				.setCustomId('reason')
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(MODERATION_REASON_MAX_LENGTH)
				.setRequired(action !== 'clearwarns' && action !== 'untimeout')
		)
	);
	if (TIMED_ACTIONS.includes(action)) {
		modal.addLabelComponents(
			durationField(await translate('moderation.modal.duration', { guildId: g, userId: u }), 'duration', {
				lang: await getUserLanguage(g, u),
				presets: DURATION_PRESETS[action]
			})
		);
	}
	await interaction.showModal(modal);
}

export async function handleModerationModal(interaction: ModalSubmitInteraction<'cached'>) {
	const [, action, targetId] = interaction.customId.split('|');
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	if (!(await ensureStaff(interaction))) {
		return;
	}
	const g = interaction.guild.id;
	const u = interaction.user.id;

	let durationSeconds: number | null = null;
	if (TIMED_ACTIONS.includes(action)) {
		durationSeconds = durationValue(interaction.fields, 'duration', DURATION_PRESETS[action]);
		if (!durationSeconds) {
			await interaction.editReply({ content: await translate('moderation.invalidDuration', { guildId: g, userId: u }) });
			return;
		}
	}

	const result: Record<string, unknown> = await performModerationAction(interaction.client, {
		guild_id: g,
		action,
		target_id: targetId,
		staff_id: u,
		staff_name: interaction.member?.displayName || interaction.user.username,
		reason: interaction.fields.getTextInputValue('reason') || null,
		duration_seconds: durationSeconds,
		source: 'menu'
	});

	const content = result.ok
		? await translate(
				'moderation.done',
				{ guildId: g, userId: u },
				{
					action: await translate(`moderation.actions.${action}`, { guildId: g, userId: u }),
					member: `<@${targetId}>`,
					case: result.case_number ?? '?'
				}
			)
		: await translate('moderation.failed', { guildId: g, userId: u }, { error: result.error });
	await interaction.editReply({ content });
}
