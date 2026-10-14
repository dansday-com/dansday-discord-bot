import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	type ModalActionRowComponentBuilder,
	MessageFlags
} from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import db from '../../../../database.js';
import {
	extractDiscordQuestSummaries,
	fetchQuestsMe,
	getBotConfig,
	getEmbedConfig,
	getServerForCurrentBot,
	precheckQuestPayloadForEnrollment,
	serverSettingsComponent,
	type DiscordQuestSummary
} from '../../../config.js';
import { attempt, logger } from '../../../../utils/index.js';
import { memberTranslator, translate } from '../i18n.js';
import { hasPermission, getPermissionDeniedMessage } from './permissions.js';
import { queueQuestEnrollJob, queueQuestClaimAllJob, isUserEnrollRunning } from './questEnrollWorker.js';
import { menuBackButton } from './interface/menuBack.js';
import { SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';

export const QUEST_ENROLL_BUTTON_PREFIX = 'quest_enroll:';
export const LEGACY_ENROLL_BUTTON_PREFIX = '\u006f\u0072\u0062_enroll:';

export const QUEST_ENROLL_MODAL_PREFIX = 'quest_enroll_submit:';
export const LEGACY_ENROLL_MODAL_PREFIX = '\u006f\u0072\u0062_enroll_submit:';

export const DISCORD_QUEST_BUTTON_ID = 'bot_discord_quest';
export const QUEST_CLAIM_ALL_BUTTON_ID = 'quest_claim_all';
export const QUEST_CLAIM_ALL_MODAL_ID = 'quest_claim_all_submit';

const TOKEN_FIELD_ID = 'quest_enroll_token';
const LEGACY_TOKEN_FIELD_ID = '\u006f\u0072\u0062_enroll_token';
const TOKEN_MIN_LENGTH = 20;
const TOKEN_MAX_LENGTH = 4000;
const REWARD_PREVIEW_MAX_LENGTH = 120;
const QUEST_LIST_MAX_LENGTH = 4000;
const ERROR_DETAIL_MAX_LENGTH = 500;
const SKIPPED_BLOCK_MAX_LENGTH = 2000;

export function isQuestEnrollButtonId(customId: string): boolean {
	return customId.startsWith(QUEST_ENROLL_BUTTON_PREFIX) || customId.startsWith(LEGACY_ENROLL_BUTTON_PREFIX);
}

export function isQuestEnrollModalId(customId: string): boolean {
	return customId.startsWith(QUEST_ENROLL_MODAL_PREFIX) || customId.startsWith(LEGACY_ENROLL_MODAL_PREFIX);
}

function questIdFromButtonCustomId(customId: string): string | null {
	if (customId.startsWith(QUEST_ENROLL_BUTTON_PREFIX)) {
		const id = customId.slice(QUEST_ENROLL_BUTTON_PREFIX.length).trim();
		return id || null;
	}
	if (customId.startsWith(LEGACY_ENROLL_BUTTON_PREFIX)) {
		const id = customId.slice(LEGACY_ENROLL_BUTTON_PREFIX.length).trim();
		return id || null;
	}
	return null;
}

function questIdFromModalCustomId(customId: string): string {
	if (customId.startsWith(QUEST_ENROLL_MODAL_PREFIX)) {
		return customId.slice(QUEST_ENROLL_MODAL_PREFIX.length).trim();
	}
	if (customId.startsWith(LEGACY_ENROLL_MODAL_PREFIX)) {
		return customId.slice(LEGACY_ENROLL_MODAL_PREFIX.length).trim();
	}
	return '';
}

function tokenFromModal(interaction: ModalSubmitInteraction): string {
	return interaction.fields.getTextInputValue(TOKEN_FIELD_ID)?.trim() || interaction.fields.getTextInputValue(LEGACY_TOKEN_FIELD_ID)?.trim() || '';
}

async function isAutoQuestEnrollmentEnabled(serverId: number): Promise<boolean> {
	const panelId = await db.getServerPanelId(serverId).catch(() => null);
	if (!panelId) {
		return false;
	}
	const row = await db.getPanelSettings(panelId, serverSettingsComponent.discord_quest_notifier).catch(() => null);
	const raw = row?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return s.auto_quest === true;
}

async function readQuestNotifierSettings(serverId: number): Promise<{ autoQuest: boolean; channelId: string | null }> {
	const row = await db.getServerSettings(serverId, serverSettingsComponent.discord_quest_notifier).catch(() => null);
	const rawSettings = row && !Array.isArray(row) ? row.settings : null;
	const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
	return {
		autoQuest: await isAutoQuestEnrollmentEnabled(serverId),
		channelId: typeof s.channel_id === 'string' && s.channel_id.trim() ? s.channel_id.trim() : null
	};
}

async function announceTargetLine(guildId: string, userId: string, channelId: string | null): Promise<string> {
	if (!channelId) {
		return translate('questEnroll.announceDisabled', { guildId, userId });
	}
	return translate('questEnroll.announceInChannel', { guildId, userId }, { channel: `<#${channelId}>` });
}

type MemberScope = { guildId: string; userId: string };

async function buildTokenModal(customId: string, titleKey: string, { guildId, userId }: MemberScope): Promise<ModalBuilder> {
	const tr = await memberTranslator(guildId, userId);
	const modal = new ModalBuilder().setCustomId(customId.slice(0, DISCORD_LIMITS.CUSTOM_ID)).setTitle(tr(titleKey).slice(0, DISCORD_LIMITS.MODAL_TITLE));

	const tokenInput = new TextInputBuilder()
		.setCustomId(TOKEN_FIELD_ID)
		.setLabel(tr('questEnroll.tokenModal.label').slice(0, DISCORD_LIMITS.LABEL))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(tr('questEnroll.tokenModal.placeholder').slice(0, DISCORD_LIMITS.TEXT_INPUT_PLACEHOLDER))
		.setRequired(true)
		.setMinLength(TOKEN_MIN_LENGTH)
		.setMaxLength(TOKEN_MAX_LENGTH);

	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(tokenInput));
	return modal;
}

async function autoQuestDisabledReply(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
	const message = await translate('questEnroll.autoQuestDisabled', { guildId: interaction.guild!.id, userId: interaction.user.id });
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content: message, embeds: [], components: [] }).catch(() => null);
	} else {
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
	}
}

function questExpiresLine(quest: DiscordQuestSummary): string {
	const t = quest.expiresAt ? Date.parse(quest.expiresAt) : NaN;
	if (!Number.isFinite(t)) {
		return '';
	}
	return `<t:${Math.floor(t / SECOND_MS)}:R>`;
}

function sortQuestsByExpiry(quests: DiscordQuestSummary[]): DiscordQuestSummary[] {
	return [...quests].sort((a, b) => {
		const ta = Date.parse(a.expiresAt || '');
		const tb = Date.parse(b.expiresAt || '');
		return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER);
	});
}

async function harvestQuestsFromMemberPayload(serverId: number, questsPayload: unknown): Promise<void> {
	const botConfig = getBotConfig();
	if (!botConfig) {
		return;
	}
	const discovered = extractDiscordQuestSummaries(questsPayload);
	if (discovered.length === 0) {
		return;
	}
	const added = await db.addMissingBotDiscordQuests(botConfig.id, discovered).catch(() => [] as DiscordQuestSummary[]);
	if (added.length === 0) {
		return;
	}
	await db
		.linkServerToBotDiscordQuests(
			serverId,
			added.map((q) => q.id)
		)
		.catch(() => null);
	await logger.log(
		`🔮 Quest enroll: discovered ${added.length} new quest(s) from a member token for bot ${botConfig.id} — ${added.map((q) => q.questName).join(', ')}`
	);
}

async function listActiveQuestsForMember(serverId: number, memberId: number): Promise<{ quest: DiscordQuestSummary; claimed: boolean }[]> {
	const botConfig = getBotConfig();
	const quests = await db.listActiveBotDiscordQuests(botConfig!.id).catch(() => [] as DiscordQuestSummary[]);
	const sorted = sortQuestsByExpiry(quests);
	const rows: { quest: DiscordQuestSummary; claimed: boolean }[] = [];
	for (const quest of sorted) {
		const isClaimed = memberId ? await db.hasServerMemberClaimedDiscordQuest(serverId, memberId, quest.id).catch(() => false) : false;
		rows.push({ quest, claimed: isClaimed });
	}
	return rows;
}

export async function handleDiscordQuestButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild!.id;
	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(guildId);
	const settings = await readQuestNotifierSettings(server.id);
	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	const rows = await listActiveQuestsForMember(server.id, dbMember?.id ?? 0);

	const embedConfig = await getEmbedConfig(guildId);
	const unclaimed = rows.filter((r) => !r.claimed);
	const lines = unclaimed.map(({ quest }, index) => {
		const expires = questExpiresLine(quest);
		const parts = [`[${quest.questName}](${quest.questUrl})`];
		if (quest.reward?.trim()) {
			parts.push(quest.reward.trim().replace(/\s+/g, ' ').slice(0, REWARD_PREVIEW_MAX_LENGTH));
		}
		if (expires) {
			parts.push(expires);
		}
		return `**${index + 1}.** ${parts.join(' · ')}`;
	});

	const emptyKey = rows.length > 0 ? 'questEnroll.listAllClaimed' : 'questEnroll.listEmpty';
	const description = lines.length > 0 ? lines.join('\n').slice(0, QUEST_LIST_MAX_LENGTH) : await translate(emptyKey, { guildId, userId: interaction.user.id });

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('questEnroll.listTitle', { guildId, userId: interaction.user.id }))
		.setDescription(description)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const buttons: ButtonBuilder[] = [];
	if (settings.autoQuest && unclaimed.length > 0) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(QUEST_CLAIM_ALL_BUTTON_ID)
				.setLabel(await translate('questEnroll.claimAllButton', { guildId, userId: interaction.user.id }))
				.setStyle(ButtonStyle.Primary)
				.setEmoji('⚠️')
		);
	}
	buttons.push(await menuBackButton(guildId, interaction.user.id, 'me'));

	const payload = { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)] };
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
	} else {
		await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
	}
}

export async function handleQuestClaimAllButton(interaction: ButtonInteraction): Promise<void> {
	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(interaction.guild!.id);
	const settings = await readQuestNotifierSettings(server.id);
	if (!settings.autoQuest) {
		await autoQuestDisabledReply(interaction);
		return;
	}

	if (isUserEnrollRunning(interaction.user.id)) {
		await interaction
			.reply({
				content: await translate('questEnroll.alreadyRunning', { guildId: interaction.guild!.id, userId: interaction.user.id }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}

	await interaction.showModal(
		await buildTokenModal(QUEST_CLAIM_ALL_MODAL_ID, 'questEnroll.tokenModal.claimAllTitle', { guildId: interaction.guild!.id, userId: interaction.user.id })
	);
}

type Notice = { title: string; description: string };
type QuestRow = Awaited<ReturnType<typeof listActiveQuestsForMember>>[number];
type Precheck = ReturnType<typeof precheckQuestPayloadForEnrollment>;
const PRECHECK_KEYS: Record<string, string> = {
	not_found: 'precheckNotFound',
	expired: 'precheckExpired',
	reward_claimed: 'precheckRewardClaimed'
};

function precheckKey(pre: Extract<Precheck, { ok: false }>) {
	return PRECHECK_KEYS[pre.code] ?? 'precheckCompleted';
}

async function noticeEmbed(guildId: string, { title, description }: Notice) {
	const embedConfig = await getEmbedConfig(guildId);
	return new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(title).setDescription(description).setFooter({ text: embedConfig.FOOTER }).setTimestamp();
}

async function enrollmentGate(interaction: ModalSubmitInteraction) {
	const guildId = interaction.guild!.id;
	const server = await getServerForCurrentBot(guildId);
	const settings = await readQuestNotifierSettings(server.id);
	if (!settings.autoQuest) {
		await autoQuestDisabledReply(interaction);
		return null;
	}
	if (isUserEnrollRunning(interaction.user.id)) {
		await interaction
			.reply({ content: await translate('questEnroll.alreadyRunning', { guildId, userId: interaction.user.id }), flags: MessageFlags.Ephemeral })
			.catch(() => null);
		return null;
	}
	return { server, settings };
}

async function memberQuestsPayload(interaction: ModalSubmitInteraction, token: string): Promise<{ payload: unknown } | null> {
	const questsResult = await attempt(() => fetchQuestsMe(token));
	if (questsResult.ok) {
		return { payload: questsResult.value };
	}
	const scope = { guildId: interaction.guild!.id, userId: interaction.user.id };
	const msg = questsResult.error instanceof Error ? questsResult.error.message : String(questsResult.error);
	const invalidEmbed = await noticeEmbed(scope.guildId, {
		title: await translate('questEnroll.invalidTokenTitle', scope),
		description: await translate('questEnroll.invalidTokenDescription', scope, { error: msg.slice(0, ERROR_DETAIL_MAX_LENGTH) })
	});
	await interaction.editReply({ embeds: [invalidEmbed] }).catch(() => null);
	return null;
}

async function sortClaimableQuests(rows: QuestRow[], { payload, scope }: { payload: unknown; scope: MemberScope }) {
	const queued: DiscordQuestSummary[] = [];
	const skipped: { quest: DiscordQuestSummary; reason: string }[] = [];
	for (const { quest, claimed: isClaimed } of rows) {
		const pre = isClaimed ? null : precheckQuestPayloadForEnrollment(payload, quest.id);
		if (isClaimed) {
			skipped.push({ quest, reason: await translate('questEnroll.listClaimedTag', scope) });
		} else if (pre && !pre.ok) {
			skipped.push({ quest, reason: await translate(`questEnroll.${precheckKey(pre)}Title`, scope) });
		} else {
			queued.push(quest);
		}
	}
	return { queued, skipped };
}

export async function handleQuestClaimAllModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const guildId = interaction.guild!.id;
	const scope = { guildId, userId: interaction.user.id };
	const token = tokenFromModal(interaction);
	if (token.length < TOKEN_MIN_LENGTH) {
		await interaction.reply({ content: await translate('questEnroll.tokenTooShort', scope), flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const gate = await enrollmentGate(interaction);
	if (!gate) {
		return;
	}
	const { server, settings } = gate;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const quests = await memberQuestsPayload(interaction, token);
	if (!quests) {
		return;
	}
	await harvestQuestsFromMemberPayload(server.id, quests.payload);

	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	const { queued, skipped } = await sortClaimableQuests(await listActiveQuestsForMember(server.id, dbMember?.id ?? 0), { payload: quests.payload, scope });
	const skippedBlock =
		skipped.length > 0 ? `\n\n${skipped.map(({ quest, reason }) => `• ${quest.questName} — ${reason}`).join('\n')}`.slice(0, SKIPPED_BLOCK_MAX_LENGTH) : '';

	if (queued.length === 0) {
		const nothingEmbed = await noticeEmbed(guildId, {
			title: await translate('questEnroll.claimAllNothingTitle', scope),
			description: `${await translate('questEnroll.claimAllNothingDescription', scope)}${skippedBlock}`
		});
		await interaction.editReply({ embeds: [nothingEmbed] }).catch(() => null);
		return;
	}

	const pendingEmbed = await noticeEmbed(guildId, {
		title: await translate('questEnroll.claimAllPendingTitle', scope),
		description: `${await announceTargetLine(guildId, interaction.user.id, settings.channelId)}\n\n${await translate('questEnroll.claimAllPendingDescription', scope, { count: queued.length })}${skippedBlock}`
	});
	await interaction.editReply({ embeds: [pendingEmbed] });

	queueQuestClaimAllJob({
		client: interaction.client,
		channelId: settings.channelId,
		guildId,
		questIds: queued.map((q) => q.id),
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		serverId: server.id,
		memberId: dbMember?.id ?? 0
	});
}

export async function handleQuestEnrollButton(interaction: ButtonInteraction): Promise<void> {
	const questId = questIdFromButtonCustomId(interaction.customId);
	if (!questId) {
		await interaction
			.reply({
				content: await translate('questEnroll.invalidQuestId', { guildId: interaction.guild!.id, userId: interaction.user.id }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}

	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(interaction.guild!.id);
	const settings = await readQuestNotifierSettings(server.id);

	if (!settings.autoQuest) {
		await autoQuestDisabledReply(interaction);
		return;
	}

	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	if (dbMember) {
		const isAlreadyClaimed = await db.hasServerMemberClaimedDiscordQuest(server.id, dbMember.id, questId).catch(() => false);
		if (isAlreadyClaimed) {
			const embedConfig = await getEmbedConfig(interaction.guild!.id);
			const botDiscordQuest = await db.getBotDiscordQuestByQuestId(questId).catch(() => null);
			const questName = botDiscordQuest?.quest_name || questId;
			const embed = new EmbedBuilder()
				.setColor(embedConfig.COLOR)
				.setTitle(`🔮 ${await translate('questEnroll.alreadyClaimed', { guildId: interaction.guild!.id, userId: interaction.user.id })}`)
				.setDescription(
					await translate('questEnroll.alreadyClaimedDescription', { guildId: interaction.guild!.id, userId: interaction.user.id }, { questName })
				)
				.setFooter({ text: embedConfig.FOOTER })
				.setTimestamp();
			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}
	}

	await interaction.showModal(
		await buildTokenModal(`${QUEST_ENROLL_MODAL_PREFIX}${questId}`, 'questEnroll.tokenModal.enrollTitle', {
			guildId: interaction.guild!.id,
			userId: interaction.user.id
		})
	);
}

export async function handleQuestEnrollModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const guildId = interaction.guild!.id;
	const scope = { guildId, userId: interaction.user.id };
	const questId = questIdFromModalCustomId(interaction.customId);
	const token = tokenFromModal(interaction);
	if (!questId || token.length < TOKEN_MIN_LENGTH) {
		await interaction.reply({ content: await translate('questEnroll.missingQuestOrToken', scope), flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const gate = await enrollmentGate(interaction);
	if (!gate) {
		return;
	}
	const { server, settings } = gate;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const quests = await memberQuestsPayload(interaction, token);
	if (!quests) {
		return;
	}
	await harvestQuestsFromMemberPayload(server.id, quests.payload);

	const pre = precheckQuestPayloadForEnrollment(quests.payload, questId);
	if (!pre.ok) {
		const keyBase = precheckKey(pre);
		const blockEmbed = await noticeEmbed(guildId, {
			title: await translate(`questEnroll.${keyBase}Title`, scope),
			description: await translate(`questEnroll.${keyBase}Description`, scope)
		});
		await interaction.editReply({ embeds: [blockEmbed] }).catch(() => null);
		return;
	}

	const pendingEmbed = await noticeEmbed(guildId, {
		title: await translate('questEnroll.pendingTitle', scope),
		description: `${await announceTargetLine(guildId, interaction.user.id, settings.channelId)}\n\n${await translate('questEnroll.pendingDescription', scope)}`
	});
	await interaction.editReply({ embeds: [pendingEmbed] });

	const member = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);

	queueQuestEnrollJob({
		client: interaction.client,
		channelId: settings.channelId,
		guildId: interaction.guild!.id,
		questId,
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		serverId: server.id,
		memberId: member?.id ?? 0
	});
}
