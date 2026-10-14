import {
	ModalBuilder,
	TextInputBuilder,
	ActionRowBuilder,
	TextInputStyle,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	RoleSelectMenuBuilder,
	MessageFlags
} from 'discord.js';
import { getEmbedConfig, GIVEAWAY, getServerForCurrentBot } from '../../../../config.js';
import { logger, attempt } from '../../../../../utils/index.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import db from '../../../../../database.js';
import { translate, serverTranslator, memberTranslator, getUserLanguage, type Translator, errorReason } from '../../i18n.js';
import { durationField, durationValue, textField, type DurationPreset } from './formFields.js';
import { menuBackButton } from './menuBack.js';
import type {
	Client,
	Guild,
	GuildTextBasedChannel,
	Message,
	ModalSubmitInteraction,
	Role,
	RoleSelectMenuInteraction,
	MessageComponentInteraction,
	RepliableInteraction,
	MessageActionRowComponentBuilder,
	ButtonInteraction,
	GuildMember,
	User
} from 'discord.js';
import { sendWithNotifiedMentions } from '../notifiedMentions.js';
import { MINUTE_MS, SECONDS_PER_MINUTE, SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';

function giveawayRoleMention(guild: Guild, roleId: string, tr: Translator) {
	const role = guild.roles.cache.get(roleId);
	return role ? `<@&${roleId}>` : tr('giveaway.unknownRole', { roleId });
}

const pendingMultipleEntries = new Map<string, boolean>();

const DURATION_PRESETS: DurationPreset[] = [
	{ amount: 1, unit: 'hour' },
	{ amount: 6, unit: 'hour' },
	{ amount: 12, unit: 'hour' },
	{ amount: 1, unit: 'day' },
	{ amount: 3, unit: 'day' },
	{ amount: 1, unit: 'week' },
	{ amount: 2, unit: 'week' }
];

function pendingKey(interaction: RepliableInteraction<'cached'>) {
	return `${interaction.guild.id}:${interaction.user.id}`;
}

async function giveawaySetupPanel(interaction: RepliableInteraction<'cached'>, isAllowed: boolean) {
	const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const entries = tr('giveaway.announcement.entriesLine', {
		entries: tr(isAllowed ? 'giveaway.announcement.multipleEntries' : 'giveaway.announcement.singleEntry')
	});
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('giveaway.create.title'))
		.setDescription(`${tr('giveaway.create.step1Title')}\n\n${tr('giveaway.create.step1Description')}\n\n${entries}`)
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
	const roleSelect = new RoleSelectMenuBuilder()
		.setCustomId('giveaway_role_select')
		.setPlaceholder(tr('giveaway.create.roleSelectPlaceholder'))
		.setMinValues(0)
		.setMaxValues(DISCORD_LIMITS.SELECT_OPTIONS);
	const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId('giveaway_continue_form').setLabel(tr('giveaway.create.continueButton')).setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId('giveaway_multiple_toggle')
			.setLabel(tr(isAllowed ? 'giveaway.create.limitSingle' : 'giveaway.create.allowMultiple'))
			.setStyle(ButtonStyle.Secondary),
		await menuBackButton(interaction.guild.id, interaction.user.id, 'community')
	);
	return { embeds: [embed], components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(roleSelect), buttonRow] };
}

type FieldSpec = { key: string; style: TextInputStyle; required: boolean; maxLength: number };

async function showGiveawayModal(interaction: MessageComponentInteraction<'cached'>, customId: string) {
	const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
	const field = (id: string, { key, style, required: isRequired, maxLength }: FieldSpec) =>
		textField(
			tr(`giveaway.modal.${key}Label`),
			new TextInputBuilder()
				.setCustomId(id)
				.setStyle(style)
				.setPlaceholder(tr(`giveaway.modal.${key}Placeholder`).slice(0, DISCORD_LIMITS.TEXT_INPUT_PLACEHOLDER))
				.setRequired(isRequired)
				.setMaxLength(maxLength)
		);
	const modal = new ModalBuilder()
		.setCustomId(customId)
		.setTitle(tr('giveaway.create.title').slice(0, DISCORD_LIMITS.MODAL_TITLE))
		.addLabelComponents(
			field('giveaway_title', { key: 'title', style: TextInputStyle.Short, required: true, maxLength: 256 }),
			field('giveaway_prize', { key: 'prize', style: TextInputStyle.Paragraph, required: true, maxLength: 2000 }),
			durationField(tr('giveaway.modal.durationLabel'), 'giveaway_duration', {
				lang: await getUserLanguage(interaction.guild.id, interaction.user.id),
				presets: DURATION_PRESETS
			}),
			field('giveaway_winner_count', { key: 'winnerCount', style: TextInputStyle.Short, required: false, maxLength: 3 }),
			field('giveaway_min_invites', { key: 'invites', style: TextInputStyle.Short, required: false, maxLength: 4 })
		);
	await interaction.showModal(modal);
}

export async function handleGiveawayMultipleToggle(interaction: ButtonInteraction<'cached'>) {
	if (!(await hasPermission(interaction.member, 'giveaway'))) {
		const content = await getPermissionDeniedMessage(interaction.guild, 'giveaway', interaction.user.id);
		await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}
	const isAllowed = !pendingMultipleEntries.get(pendingKey(interaction));
	pendingMultipleEntries.set(pendingKey(interaction), isAllowed);
	await interaction.update(await giveawaySetupPanel(interaction, isAllowed));
}

type WinnerList = { winners: readonly unknown[]; winnerMentions: string };

function buildGiveawayWinnersDescription(
	tr: Translator,
	giveaway: { title: string | null; prize: string | null; winner_count: number },
	{ winners, winnerMentions }: WinnerList
) {
	const parts = [
		`**${giveaway.title}**`,
		tr('giveaway.announcement.prizeLine', { prize: giveaway.prize }),
		tr(winners.length > 1 ? 'giveaway.results.winnersLine' : 'giveaway.results.winnerLine', { winners: winnerMentions })
	];
	if (winners.length < giveaway.winner_count) {
		parts.push(
			tr(winners.length > 1 ? 'giveaway.results.limitedEntriesMany' : 'giveaway.results.limitedEntriesOne', {
				count: winners.length,
				requested: giveaway.winner_count
			})
		);
	}
	parts.push(tr('giveaway.results.congrats'));
	return parts.join('\n\n');
}

async function activeGiveawayPanel(interaction: ButtonInteraction<'cached'>, activeGiveaway: Pick<GiveawayRow, 'id' | 'title' | 'prize' | 'ends_at'>) {
	const mtr = await memberTranslator(interaction.guild.id, interaction.user.id);
	const embedConfig = await getEmbedConfig(interaction.guild.id);
	const finishButton = new ButtonBuilder()
		.setCustomId(`giveaway_finish_${activeGiveaway.id}`)
		.setLabel(mtr('giveaway.buttons.finish'))
		.setStyle(ButtonStyle.Danger);
	const backButton = await menuBackButton(interaction.guild.id, interaction.user.id, 'community');
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(mtr('giveaway.active.title'))
		.setDescription(mtr('giveaway.active.description', { title: activeGiveaway.title, prize: activeGiveaway.prize }))
		.addFields([{ name: mtr('giveaway.active.ends'), value: `<t:${Math.floor(giveawayEndsAt(activeGiveaway).getTime() / SECOND_MS)}:R>`, inline: true }])
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
	return { embeds: [embed], components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(finishButton, backButton)] };
}

export async function handleGiveawayButton(interaction: ButtonInteraction<'cached'>) {
	try {
		const { member } = interaction;
		const { guild } = interaction;
		const { user } = interaction;

		if (!(await hasPermission(member, 'giveaway'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'giveaway', interaction.user.id);
			await interaction
				.reply({
					content: errorMessage,
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		const server = await getServerForCurrentBot(guild.id);

		let dbMember = await db.getMemberByDiscordId(server.id, user.id);
		if (!dbMember) {
			dbMember = await db.upsertMember(server.id, user);
		}

		if (!dbMember || !dbMember.id) {
			const errorMsg = await translate('giveaway.errors.memberNotFound', { guildId: interaction.guild.id, userId: interaction.user.id });
			await interaction.reply({
				content: errorMsg,
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const activeGiveaway = await db.getActiveGiveawayByMember(server.id, dbMember.id);

		if (activeGiveaway) {
			await interaction.update(await activeGiveawayPanel(interaction, activeGiveaway));
			await logger.log(`🎉 Active giveaway options shown to ${member.user.tag} (${member.user.id}) for giveaway ${activeGiveaway.id}`);
			return;
		}

		pendingMultipleEntries.set(pendingKey(interaction), false);
		await interaction.update(await giveawaySetupPanel(interaction, false));

		await logger.log(`🎉 Giveaway role selector shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing giveaway interface: ${(error as Error).message}`);
		const errorMsg = await translate(
			'giveaway.errors.failed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{
				error: await errorReason(error, interaction.guild.id, interaction.user.id)
			}
		);
		await interaction.reply({
			content: errorMsg,
			flags: MessageFlags.Ephemeral
		});
	}
}

export async function handleGiveawayRoleSelect(interaction: RoleSelectMenuInteraction<'cached'>) {
	try {
		if (!(await hasPermission(interaction.member, 'giveaway'))) {
			const content = await getPermissionDeniedMessage(interaction.guild, 'giveaway', interaction.user.id);
			await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const selectedRoles = interaction.values;

		await logger.log(`🔍 Role selection: ${selectedRoles.length} roles selected for giveaway by ${interaction.user.tag}`);

		await showGiveawayModal(interaction, `giveaway_create_${selectedRoles.length > 0 ? selectedRoles.join('_') : 'none'}`);
		await logger.log(
			`🎉 Giveaway modal shown to ${interaction.user.tag} (${interaction.user.id}) with roles: ${selectedRoles.length > 0 ? selectedRoles.join(', ') : 'none'}`
		);
	} catch (error) {
		await logger.log(`❌ Role selection error: ${(error as Error).message}`);
		await logger.log(`❌ Role selection error stack: ${(error as Error).stack}`);
		try {
			if (interaction.deferred || interaction.replied) {
				await interaction.followUp({
					content: await translate(
						'giveaway.errors.roleSelectFailed',
						{ guildId: interaction.guild.id, userId: interaction.user.id },
						{
							error: await errorReason(error, interaction.guild.id, interaction.user.id)
						}
					),
					flags: MessageFlags.Ephemeral
				});
			} else {
				await interaction.reply({
					content: await translate(
						'giveaway.errors.roleSelectFailed',
						{ guildId: interaction.guild.id, userId: interaction.user.id },
						{
							error: await errorReason(error, interaction.guild.id, interaction.user.id)
						}
					),
					flags: MessageFlags.Ephemeral
				});
			}
		} catch (err) {
			await logger.log(`❌ Failed to send error message: ${(err as Error).message}`);
		}
	}
}

export async function handleGiveawaySkipRolesContinue(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showGiveawayModal(interaction, 'giveaway_create_none');
		await logger.log(`🎉 Giveaway modal shown to ${interaction.user.tag} (${interaction.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing giveaway modal: ${(error as Error).message}`);
		await interaction.reply({
			content: await translate(
				'giveaway.errors.failed',
				{ guildId: interaction.guild.id, userId: interaction.user.id },
				{
					error: await errorReason(error, interaction.guild.id, interaction.user.id)
				}
			),
			flags: MessageFlags.Ephemeral
		});
	}
}

type Checked<T> = { value: T } | { errorKey: string; params?: Record<string, unknown> };
type GiveawayForm = { title: string; prize: string; duration: number; winnerCount: number; minInvites: number };
type GiveawayDraft = GiveawayForm & { id: number; hostId: string; allowedRoles: string[] | null; areMultipleEntriesAllowed: boolean };
type EmbedStyle = Awaited<ReturnType<typeof getEmbedConfig>>;

function readGiveawayForm(fields: ModalSubmitInteraction['fields']): Checked<GiveawayForm> {
	const title = fields.getTextInputValue('giveaway_title').trim();
	const prize = fields.getTextInputValue('giveaway_prize').trim();
	const winnerCountStr = fields.getTextInputValue('giveaway_winner_count').trim() || '1';
	if (!title) {
		return { errorKey: 'giveaway.errors.invalidTitle' };
	}
	if (!prize) {
		return { errorKey: 'giveaway.errors.invalidPrize' };
	}
	const duration = (durationValue(fields, 'giveaway_duration', DURATION_PRESETS) ?? 0) / SECONDS_PER_MINUTE;
	if (duration <= 0) {
		return { errorKey: 'giveaway.errors.invalidDuration' };
	}
	const winnerCount = parseInt(winnerCountStr) || 1;
	if (isNaN(winnerCount) || winnerCount <= 0) {
		return { errorKey: 'giveaway.errors.invalidWinnerCount' };
	}
	const invitesStr = fields.getTextInputValue('giveaway_min_invites')?.trim() || '0';
	const minInvites = /^\d+$/.test(invitesStr) ? Number(invitesStr) : NaN;
	if (!Number.isFinite(minInvites)) {
		return { errorKey: 'giveaway.errors.invalidInvites' };
	}
	return { value: { title, prize, duration, winnerCount, minInvites } };
}

function allowedRolesFrom(customId: string): string[] | null {
	if (!customId.startsWith('giveaway_create_')) {
		return null;
	}
	const parts = customId.replace('giveaway_create_', '').split('_');
	if (!parts[0] || parts[0] === 'none') {
		return null;
	}
	return parts.filter((id) => id && id !== 'none');
}

async function findGiveawayChannel(guild: Guild, keyPrefix: 'channel' | 'finishChannel'): Promise<Checked<GuildTextBasedChannel>> {
	const channelIdResult = await attempt(() => GIVEAWAY.getChannel(guild.id));
	if (!channelIdResult.ok) {
		await logger.log(`❌ Error getting giveaway channel: ${(channelIdResult.error as Error).message}`);
		return { errorKey: `giveaway.errors.${keyPrefix}Error` };
	}
	const channelId = channelIdResult.value;
	if (!channelId) {
		await logger.log(`❌ Giveaway channel not configured for server ${guild.id}`);
		return { errorKey: `giveaway.errors.${keyPrefix}NotConfigured` };
	}
	const channel = guild.channels.cache.get(channelId) as GuildTextBasedChannel | undefined;
	if (!channel) {
		await logger.log(`❌ Giveaway channel not found: ${channelId}`);
		return { errorKey: `giveaway.errors.${keyPrefix}NotFound` };
	}
	return { value: channel };
}

function giveawayAnnouncement(guild: Guild, draft: GiveawayDraft, { tr, embedConfig }: { tr: Translator; embedConfig: EmbedStyle }) {
	const roleRestrictionText =
		draft.allowedRoles && draft.allowedRoles.length > 0
			? draft.allowedRoles.map((roleId) => giveawayRoleMention(guild, roleId, tr)).join(', ')
			: tr('giveaway.announcement.noRoleRestrictions');
	const entriesLabel = draft.areMultipleEntriesAllowed ? tr('giveaway.announcement.multipleEntries') : tr('giveaway.announcement.singleEntry');
	const descriptionLines = [
		tr('giveaway.announcement.prizeLine', { prize: draft.prize }),
		tr(draft.winnerCount > 1 ? 'giveaway.announcement.winnersLine' : 'giveaway.announcement.winnerLine', { count: draft.winnerCount }),
		tr('giveaway.announcement.entriesLine', { entries: entriesLabel }),
		tr('giveaway.announcement.rolesLine', { roles: roleRestrictionText })
	];
	if (draft.minInvites > 0) {
		descriptionLines.push(tr('giveaway.announcement.invitesLine', { count: draft.minInvites }));
	}
	const endsAtTimestamp = Math.floor((Date.now() + draft.duration * MINUTE_MS) / SECOND_MS);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(`🎉 ${draft.title}`)
		.setDescription(descriptionLines.join('\n'))
		.addFields([
			{ name: tr('giveaway.announcement.hostedBy'), value: `<@${draft.hostId}>`, inline: true },
			{ name: tr('giveaway.active.ends'), value: `<t:${endsAtTimestamp}:R>`, inline: true }
		])
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
	const enterButton = new ButtonBuilder()
		.setCustomId(`giveaway_enter_${draft.id}`)
		.setLabel(tr('giveaway.announcement.enterButton'))
		.setStyle(ButtonStyle.Success);
	return { embeds: [embed], components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(enterButton)] };
}

async function giveawayHost(serverId: number, user: User) {
	return (await db.getMemberByDiscordId(serverId, user.id)) ?? (await db.upsertMember(serverId, user));
}

export async function handleGiveawayModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { guild, user, member } = interaction;

		if (!(await hasPermission(member, 'giveaway'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'giveaway', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const mtr = await memberTranslator(guild.id, user.id);
		const fail = (key: string) => interaction.editReply({ content: mtr(key) });

		const form = readGiveawayForm(interaction.fields);
		if ('errorKey' in form) {
			await fail(form.errorKey);
			return;
		}
		const channel = await findGiveawayChannel(guild, 'channel');
		if ('errorKey' in channel) {
			await fail(channel.errorKey);
			return;
		}

		const server = await getServerForCurrentBot(guild.id);
		const dbMember = await giveawayHost(server.id, user);
		if (!dbMember?.id) {
			await fail('giveaway.errors.memberNotFound');
			return;
		}
		if (await db.getActiveGiveawayByMember(server.id, dbMember.id)) {
			await fail('giveaway.errors.activeExists');
			return;
		}

		const allowedRoles = allowedRolesFrom(interaction.customId);
		const areMultipleEntriesAllowed = pendingMultipleEntries.get(pendingKey(interaction)) ?? false;
		const giveaway = (await db.createGiveaway({
			member_id: dbMember.id,
			title: form.value.title,
			prize: form.value.prize,
			duration_minutes: form.value.duration,
			allowed_roles: allowedRoles,
			multiple_entries_allowed: areMultipleEntriesAllowed,
			winner_count: form.value.winnerCount,
			min_invites: form.value.minInvites
		}))!;
		pendingMultipleEntries.delete(pendingKey(interaction));

		const embedConfig = await getEmbedConfig(guild.id);
		const draft: GiveawayDraft = { ...form.value, id: giveaway.id, hostId: user.id, allowedRoles, areMultipleEntriesAllowed };
		const message = await sendWithNotifiedMentions(channel.value, giveawayAnnouncement(guild, draft, { tr: await serverTranslator(guild.id), embedConfig }));
		await db.updateGiveawayMessageId(giveaway.id, message.id);

		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(mtr('giveaway.created.title'))
			.setDescription(mtr('giveaway.created.description', { channel: channel.value.toString() }))
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });
		await interaction.editReply({ embeds: [successEmbed], components: [] });

		await logger.log(`✅ Giveaway created by ${user.tag} (${user.id}) - ID: ${giveaway.id}`);
	} catch (error) {
		await logger.log(`❌ Error processing giveaway: ${(error as Error).message}`);
		await logger.log(`❌ Stack: ${(error as Error).stack}`);
		const errorMsg = await translate(
			'giveaway.errors.createFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
		);
		await interaction.editReply({ content: errorMsg });
	}
}

type GiveawayRow = NonNullable<Awaited<ReturnType<typeof db.getGiveawayById>>>;
type GiveawayMember = NonNullable<Awaited<ReturnType<typeof db.getMemberByDiscordId>>>;

function giveawayEndsAt(giveaway: { ends_at: Date | string }) {
	return giveaway.ends_at instanceof Date ? giveaway.ends_at : new Date(`${String(giveaway.ends_at).replace(' ', 'T')}Z`);
}

async function openGiveaway(serverId: number, giveawayId: number): Promise<Checked<GiveawayRow>> {
	if (isNaN(giveawayId)) {
		return { errorKey: 'giveaway.errors.invalidId' };
	}
	const giveaway = await db.getGiveawayById(giveawayId);
	if (!giveaway || giveaway.server_id !== serverId) {
		return { errorKey: 'giveaway.errors.notFound' };
	}
	if (giveaway.status !== 'active' || giveawayEndsAt(giveaway) <= new Date()) {
		return { errorKey: 'giveaway.errors.ended' };
	}
	return { value: giveaway };
}

function missingRoles(member: GuildMember, giveaway: GiveawayRow): string[] | null {
	const roles = giveaway.allowed_roles;
	if (!Array.isArray(roles) || roles.length === 0) {
		return null;
	}
	const memberRoles = member.roles.cache.map((role: Role) => role.id);
	return roles.every((roleId: string) => memberRoles.includes(roleId)) ? null : roles;
}

async function entryRejection(
	member: GuildMember,
	{ giveaway, serverId }: { giveaway: GiveawayRow; serverId: number },
	mtr: Translator
): Promise<Checked<GiveawayMember>> {
	const required = missingRoles(member, giveaway);
	if (required) {
		return {
			errorKey: 'giveaway.errors.roleRestriction',
			params: { roles: required.map((roleId) => giveawayRoleMention(member.guild, roleId, mtr)).join(', ') }
		};
	}

	const dbMember = await db.getMemberByDiscordId(serverId, member.id);
	if (!dbMember) {
		return { errorKey: 'giveaway.errors.memberNotFoundDB' };
	}

	const minInvites = Number(giveaway.min_invites) || 0;
	const have = minInvites > 0 ? ((await db.getMemberInviteStats(Number(dbMember.id)).catch(() => null))?.total ?? 0) : 0;
	if (have < minInvites) {
		return { errorKey: 'giveaway.errors.notEnoughInvites', params: { needed: minInvites, have } };
	}

	if (giveaway.member_id === dbMember.id && !(await GIVEAWAY.getCreatorCanParticipate(member.guild.id))) {
		return { errorKey: 'giveaway.errors.cannotEnterOwn' };
	}

	if (!giveaway.multiple_entries_allowed && (await db.getGiveawayEntries(giveaway.id)).some((e) => e.member_id === dbMember.id)) {
		return { errorKey: 'giveaway.errors.alreadyEntered' };
	}
	return { value: dbMember };
}

export async function handleGiveawayEnterButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { customId } = interaction;
		if (!customId.startsWith('giveaway_enter_')) {
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member, guild, user, message } = interaction;
		const mtr = await memberTranslator(guild.id, user.id);
		const fail = (rejection: { errorKey: string; params?: Record<string, unknown> }) =>
			interaction.editReply({ content: mtr(rejection.errorKey, rejection.params) });

		if (!message || !message.embeds || message.embeds.length === 0) {
			await fail({ errorKey: 'giveaway.errors.invalidMessage' });
			return;
		}

		const server = await getServerForCurrentBot(guild.id);
		const opened = await openGiveaway(server.id, parseInt(customId.replace('giveaway_enter_', '')));
		if ('errorKey' in opened) {
			await fail(opened);
			return;
		}
		const giveaway = opened.value;

		const entrant = await entryRejection(member, { giveaway, serverId: server.id }, mtr);
		if ('errorKey' in entrant) {
			await fail(entrant);
			return;
		}
		const dbMember = entrant.value;

		await (giveaway.multiple_entries_allowed ? db.addGiveawayEntry(giveaway.id, dbMember.id) : db.enterGiveawayOnce(giveaway.id, dbMember.id));

		const embedConfig = await getEmbedConfig(guild.id);
		const enteredTitle = await translate('giveaway.entered.title', { guildId: interaction.guild.id, userId: interaction.user.id });
		const enteredDescription = await translate('giveaway.entered.description', { guildId: interaction.guild.id, userId: interaction.user.id });
		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(enteredTitle)
			.setDescription(enteredDescription)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });

		await interaction.editReply({
			embeds: [successEmbed]
		});

		await logger.log(`✅ ${user.tag} (${user.id}) entered giveaway ${giveaway.id}`);
	} catch (error) {
		await logger.log(`❌ Error processing giveaway entry: ${(error as Error).message}`);
		await interaction
			.editReply({
				content: await translate(
					'giveaway.errors.enterFailed',
					{ guildId: interaction.guild.id, userId: interaction.user.id },
					{
						error: await errorReason(error, interaction.guild.id, interaction.user.id)
					}
				)
			})
			.catch(() => null);
	}
}

type GiveawayResult = { kind: 'noEntries' | 'noWinners' | 'winners'; title: string; description: string; winnerMentions: string; winnerIds: string[] };
type DrawableGiveaway = { id: number; title: string | null; prize: string | null; winner_count: number };
type FinishableGiveaway = NonNullable<Awaited<ReturnType<typeof db.getGiveawayById>>>;

async function drawGiveawayResult(giveaway: DrawableGiveaway, tr: Translator): Promise<GiveawayResult> {
	const entries = await db.getGiveawayEntries(giveaway.id);
	if (entries.length === 0) {
		return {
			kind: 'noEntries',
			title: tr('giveaway.results.endedTitle'),
			description: tr('giveaway.results.noEntries', { title: giveaway.title }),
			winnerMentions: '',
			winnerIds: []
		};
	}

	const winners = await db.getRandomGiveawayWinners(giveaway.id, giveaway.winner_count);
	if (winners.length === 0) {
		return {
			kind: 'noWinners',
			title: tr('giveaway.results.endedTitle'),
			description: tr('giveaway.results.noWinners', { title: giveaway.title }),
			winnerMentions: '',
			winnerIds: []
		};
	}

	const winnerMentions = winners.map((w) => `<@${w.discord_member_id}>`).join(', ');
	await db.markGiveawayWinners(
		giveaway.id,
		winners.map((w) => w.member_id)
	);
	return {
		kind: 'winners',
		title: tr('giveaway.results.endedWinnersTitle'),
		description: buildGiveawayWinnersDescription(tr, giveaway, { winners, winnerMentions }),
		winnerMentions,
		winnerIds: winners.map((w) => w.discord_member_id)
	};
}

function resultEmbed(embedConfig: EmbedStyle, result: GiveawayResult) {
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(result.title)
		.setDescription(result.description)
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
}

const FINISH_REPLY_KEYS: Record<GiveawayResult['kind'], string> = {
	noEntries: 'giveaway.finished.noEntries',
	noWinners: 'giveaway.finished.noWinners',
	winners: 'giveaway.finished.winners'
};

const FINISH_LOG_SUFFIX: Record<GiveawayResult['kind'], (result: GiveawayResult) => string> = {
	noEntries: () => 'No entries',
	noWinners: () => 'No winners selected',
	winners: (result) => `Winners: ${result.winnerIds.join(', ')}`
};

async function finishableGiveaway(interaction: ButtonInteraction<'cached'>, giveawayId: number): Promise<Checked<FinishableGiveaway>> {
	if (isNaN(giveawayId)) {
		return { errorKey: 'giveaway.errors.invalidId' };
	}
	const server = await getServerForCurrentBot(interaction.guild.id);
	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id);
	if (!dbMember) {
		return { errorKey: 'giveaway.errors.memberNotFoundDB' };
	}
	const giveaway = await db.getGiveawayById(giveawayId);
	if (!giveaway) {
		return { errorKey: 'giveaway.errors.notFound' };
	}
	if (giveaway.member_id !== dbMember.id) {
		return { errorKey: 'giveaway.errors.finishOwnOnly' };
	}
	if (giveaway.status !== 'active') {
		return { errorKey: 'giveaway.errors.finishNotActive' };
	}
	return { value: giveaway };
}

export async function handleGiveawayFinish(interaction: ButtonInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member, guild, user } = interaction;

		if (!(await hasPermission(member, 'giveaway'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'giveaway', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const mtr = await memberTranslator(guild.id, user.id);
		const giveawayId = parseInt(interaction.customId.replace('giveaway_finish_', ''));
		const giveaway = await finishableGiveaway(interaction, giveawayId);
		if ('errorKey' in giveaway) {
			await interaction.editReply({ content: mtr(giveaway.errorKey) });
			return;
		}

		await db.markGiveawayEndedForce(giveawayId);

		const channel = await findGiveawayChannel(guild, 'finishChannel');
		if ('errorKey' in channel) {
			await interaction.editReply({ content: mtr(channel.errorKey) });
			return;
		}

		const message = giveaway.value.discord_message_id ? await channel.value.messages.fetch(giveaway.value.discord_message_id).catch(() => null) : null;
		const embedConfig = await getEmbedConfig(guild.id);
		const result = await drawGiveawayResult(giveaway.value, await serverTranslator(guild.id));
		await closeGiveawayPost({ channel: channel.value, message }, resultEmbed(embedConfig, result));

		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(mtr('giveaway.finished.title'))
			.setDescription(mtr(FINISH_REPLY_KEYS[result.kind], { title: giveaway.value.title, winners: result.winnerMentions }))
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });
		await interaction.editReply({ embeds: [successEmbed] }).catch(() => null);

		await logger.log(`✅ Giveaway ${giveawayId} finished early by ${user.tag} (${user.id}) - ${FINISH_LOG_SUFFIX[result.kind](result)}`);
	} catch (error) {
		await logger.log(`❌ Error finishing giveaway: ${(error as Error).message}`);
		await interaction
			.editReply({
				content: await translate(
					'giveaway.errors.finishFailed',
					{ guildId: interaction.guild.id, userId: interaction.user.id },
					{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
				)
			})
			.catch(() => null);
	}
}

type EndedGiveaway = Awaited<ReturnType<typeof db.getEndedGiveaways>>[number];
type GiveawayPost = { channel: GuildTextBasedChannel | null; message: Message | null };

async function resolveGiveawayPost(guild: Guild, giveaway: EndedGiveaway): Promise<GiveawayPost> {
	const channelIdResult = await attempt(() => GIVEAWAY.getChannelForFinalizingEndedGiveaway(guild.id));
	if (!channelIdResult.ok) {
		await logger.log(
			`❌ Error resolving giveaway channel for server ${giveaway.server_id}: ${(channelIdResult.error as Error)?.message || channelIdResult.error}`
		);
	}
	const giveawayChannelId = channelIdResult.ok ? channelIdResult.value : null;
	if (!giveawayChannelId) {
		return { channel: null, message: null };
	}

	const found = guild.channels.cache.get(giveawayChannelId) || (await guild.channels.fetch(giveawayChannelId).catch(() => null));
	const channel = found?.isTextBased() ? found : null;
	const message = channel && giveaway.discord_message_id ? await channel.messages.fetch(giveaway.discord_message_id).catch(() => null) : null;
	return { channel, message };
}

async function closeGiveawayPost(post: GiveawayPost, embed: EmbedBuilder): Promise<boolean> {
	if (post.message) {
		await post.message.edit({ components: [] }).catch(() => null);
	}
	if (!post.channel) {
		return false;
	}
	await sendWithNotifiedMentions(post.channel, { embeds: [embed] }).catch(() => null);
	return true;
}

const ENDED_LOGS: Record<GiveawayResult['kind'], { unposted: string; done: (result: GiveawayResult) => string }> = {
	noEntries: { unposted: 'ended with no entries (no Discord channel/message — DB finalized only)', done: () => 'ended with no entries' },
	noWinners: {
		unposted: 'ended with no winners selectable (no Discord channel/message — DB finalized only)',
		done: () => 'ended but no winners could be selected'
	},
	winners: { unposted: 'winners recorded in DB but no channel to announce', done: (result) => `ended - Winners: ${result.winnerIds.join(', ')}` }
};

async function finalizeEndedGiveaway(client: Client, giveaway: EndedGiveaway) {
	const server = await db.getServer(giveaway.server_id);
	if (!server) {
		return;
	}

	const guild = client.guilds.cache.get(server.discord_server_id);
	if (!guild) {
		return;
	}
	const post = await resolveGiveawayPost(guild, giveaway);
	const embedConfig = await getEmbedConfig(guild.id);
	const result = await drawGiveawayResult(giveaway, await serverTranslator(guild.id));
	const logs = ENDED_LOGS[result.kind];

	if (!(await closeGiveawayPost(post, resultEmbed(embedConfig, result)))) {
		await logger.log(`⚠️ Giveaway ${giveaway.id} ${logs.unposted} (guild ${guild.id})`);
	}
	await db.markGiveawayEnded(giveaway.id);
	await logger.log(`✅ Giveaway ${giveaway.id} ${logs.done(result)}`);
}

async function processEndedGiveaways(client: Client) {
	try {
		const endedGiveaways = await db.getEndedGiveaways();

		for (const giveaway of endedGiveaways) {
			try {
				await finalizeEndedGiveaway(client, giveaway);
			} catch (err) {
				await logger.log(`❌ Error ending giveaway ${giveaway.id}: ${(err as Error)?.message || err}`);
			}
		}
	} catch (error) {
		await logger.log(`❌ Error checking ended giveaways: ${(error as Error)?.message || error}`);
	}
}

export function init(client: Client) {
	processEndedGiveaways(client).catch((err) => {
		logger.log(`❌ Error processing ended giveaways on startup: ${err.message}`);
	});

	setInterval(() => {
		processEndedGiveaways(client);
	}, MINUTE_MS);
}

export default { init };
