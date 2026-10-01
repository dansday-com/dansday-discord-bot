import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { translate } from '../../i18n.js';
import { performModerationAction, parseDuration } from '../moderation.js';

const MENU_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'clearwarns'];
const TIMED_ACTIONS = ['timeout', 'tempban'];

async function ensureStaff(interaction: any) {
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
	if (member && (await hasPermission(member, 'staff_only'))) return true;
	const content = await getPermissionDeniedMessage(interaction.guild, 'staff_only', interaction.user.id);
	if (interaction.replied || interaction.deferred) await interaction.editReply({ content, embeds: [], components: [] }).catch(() => null);
	else await interaction.reply({ content, flags: 64 }).catch(() => null);
	return false;
}

export async function handleModerationButton(interaction: any) {
	if (!(await ensureStaff(interaction))) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const select = new UserSelectMenuBuilder()
		.setCustomId('moderation_select_user')
		.setPlaceholder(await translate('moderation.selectUserPlaceholder', g, u))
		.setMinValues(1)
		.setMaxValues(1);
	await interaction.reply({
		content: await translate('moderation.selectUser', g, u),
		components: [new ActionRowBuilder().addComponents(select)],
		flags: 64
	});
}

export async function handleModerationUserSelect(interaction: any) {
	if (!(await ensureStaff(interaction))) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const targetId = interaction.values[0];
	const options = [];
	for (const action of MENU_ACTIONS) {
		options.push({ label: await translate(`moderation.actions.${action}`, g, u), value: action });
	}
	const select = new StringSelectMenuBuilder()
		.setCustomId(`moderation_action|${targetId}`)
		.setPlaceholder(await translate('moderation.selectActionPlaceholder', g, u))
		.addOptions(options);
	await interaction.update({
		content: await translate('moderation.selectAction', g, u, { member: `<@${targetId}>` }),
		components: [new ActionRowBuilder().addComponents(select)]
	});
}

export async function handleModerationActionSelect(interaction: any) {
	if (!(await ensureStaff(interaction))) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;
	const targetId = interaction.customId.split('|')[1];
	const action = interaction.values[0];
	if (!MENU_ACTIONS.includes(action) || !targetId) return;

	const modal = new ModalBuilder()
		.setCustomId(`moderation_modal|${action}|${targetId}`)
		.setTitle(String(await translate(`moderation.actions.${action}`, g, u)).slice(0, 45));
	const rows = [
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('reason')
				.setLabel(await translate('moderation.modal.reason', g, u))
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(1000)
				.setRequired(action !== 'clearwarns' && action !== 'untimeout')
		)
	];
	if (TIMED_ACTIONS.includes(action)) {
		rows.push(
			new ActionRowBuilder().addComponents(
				new TextInputBuilder()
					.setCustomId('duration')
					.setLabel(await translate('moderation.modal.duration', g, u))
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('10m, 2h, 7d')
					.setMaxLength(20)
					.setRequired(true)
			)
		);
	}
	modal.addComponents(...rows);
	await interaction.showModal(modal);
}

export async function handleModerationModal(interaction: any) {
	const [, action, targetId] = interaction.customId.split('|');
	await interaction.deferReply({ flags: 64 });
	if (!(await ensureStaff(interaction))) return;
	const g = interaction.guild.id;
	const u = interaction.user.id;

	let durationSeconds: number | null = null;
	if (TIMED_ACTIONS.includes(action)) {
		durationSeconds = parseDuration(interaction.fields.getTextInputValue('duration'));
		if (!durationSeconds) {
			await interaction.editReply({ content: await translate('moderation.invalidDuration', g, u) });
			return;
		}
	}

	const result: any = await performModerationAction(interaction.client, {
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
		? await translate('moderation.done', g, u, {
				action: await translate(`moderation.actions.${action}`, g, u),
				member: `<@${targetId}>`,
				case: result.case_number ?? '?'
			})
		: await translate('moderation.failed', g, u, { error: result.error });
	await interaction.editReply({ content });
}
