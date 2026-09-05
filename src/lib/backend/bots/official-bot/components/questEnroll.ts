import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	type ModalActionRowComponentBuilder
} from 'discord.js';
import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import db from '../../../../database.js';
import {
	fetchQuestsMe,
	getBotConfig,
	getEmbedConfig,
	getServerForCurrentBot,
	precheckQuestPayloadForEnrollment,
	serverSettingsComponent,
	type DiscordQuestSummary
} from '../../../config.js';
import { translate } from '../i18n.js';
import { hasPermission, getPermissionDeniedMessage } from './permissions.js';
import { queueQuestEnrollJob, queueQuestClaimAllJob, isUserEnrollRunning } from './questEnrollWorker.js';

export const QUEST_ENROLL_BUTTON_PREFIX = 'quest_enroll:';
export const LEGACY_ENROLL_BUTTON_PREFIX = '\u006f\u0072\u0062_enroll:';

export const QUEST_ENROLL_MODAL_PREFIX = 'quest_enroll_submit:';
export const LEGACY_ENROLL_MODAL_PREFIX = '\u006f\u0072\u0062_enroll_submit:';

export const DISCORD_QUEST_BUTTON_ID = 'bot_discord_quest';
export const QUEST_CLAIM_ALL_BUTTON_ID = 'quest_claim_all';
export const QUEST_CLAIM_ALL_MODAL_ID = 'quest_claim_all_submit';

const TOKEN_FIELD_ID = 'quest_enroll_token';
const LEGACY_TOKEN_FIELD_ID = '\u006f\u0072\u0062_enroll_token';

const QUEST_LIST_LIMIT = 20;

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
	if (customId.startsWith(QUEST_ENROLL_MODAL_PREFIX)) return customId.slice(QUEST_ENROLL_MODAL_PREFIX.length).trim();
	if (customId.startsWith(LEGACY_ENROLL_MODAL_PREFIX)) return customId.slice(LEGACY_ENROLL_MODAL_PREFIX.length).trim();
	return '';
}

function tokenFromModal(interaction: ModalSubmitInteraction): string {
	return interaction.fields.getTextInputValue(TOKEN_FIELD_ID)?.trim() || interaction.fields.getTextInputValue(LEGACY_TOKEN_FIELD_ID)?.trim() || '';
}

async function readQuestNotifierSettings(serverId: number): Promise<{ autoQuest: boolean; httpProxyUrl: string | null }> {
	const row = await db.getServerSettings(serverId, serverSettingsComponent.discord_quest_notifier).catch(() => null);
	const rawSettings = row && !Array.isArray(row) ? row.settings : null;
	const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};
	return {
		autoQuest: s.auto_quest !== false,
		httpProxyUrl: typeof s.http_proxy_url === 'string' && s.http_proxy_url.trim() ? s.http_proxy_url.trim() : null
	};
}

function buildTokenModal(customId: string, title: string): ModalBuilder {
	const modal = new ModalBuilder().setCustomId(customId.slice(0, 100)).setTitle(title);

	const tokenInput = new TextInputBuilder()
		.setCustomId(TOKEN_FIELD_ID)
		.setLabel('Discord user token (not saved)')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('ToS risk: your account may be banned; bot/server possible. Paste once; never in public.')
		.setRequired(true)
		.setMinLength(20)
		.setMaxLength(4000);

	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(tokenInput));
	return modal;
}

async function autoQuestDisabledReply(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
	const message = await translate('questEnroll.autoQuestDisabled', interaction.guild!.id, interaction.user.id);
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply({ content: message, embeds: [], components: [] }).catch(() => null);
	} else {
		await interaction.reply({ content: message, flags: 64 }).catch(() => null);
	}
}

function questExpiresLine(quest: DiscordQuestSummary): string {
	const t = quest.expiresAt ? Date.parse(quest.expiresAt) : NaN;
	if (!Number.isFinite(t)) return '';
	return `<t:${Math.floor(t / 1000)}:R>`;
}

function sortQuestsByExpiry(quests: DiscordQuestSummary[]): DiscordQuestSummary[] {
	return [...quests].sort((a, b) => {
		const ta = Date.parse(a.expiresAt || '');
		const tb = Date.parse(b.expiresAt || '');
		return (Number.isFinite(ta) ? ta : Number.MAX_SAFE_INTEGER) - (Number.isFinite(tb) ? tb : Number.MAX_SAFE_INTEGER);
	});
}

async function listActiveQuestsForMember(serverId: number, memberId: number): Promise<{ quest: DiscordQuestSummary; claimed: boolean }[]> {
	const botConfig = getBotConfig();
	const quests = await db.listActiveBotDiscordQuests(botConfig!.id).catch(() => [] as DiscordQuestSummary[]);
	const sorted = sortQuestsByExpiry(quests).slice(0, QUEST_LIST_LIMIT);
	const rows: { quest: DiscordQuestSummary; claimed: boolean }[] = [];
	for (const quest of sorted) {
		const claimed = memberId ? await db.hasServerMemberClaimedDiscordQuest(serverId, memberId, quest.id).catch(() => false) : false;
		rows.push({ quest, claimed });
	}
	return rows;
}

export async function handleDiscordQuestButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild!.id;
	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(guildId);
	const settings = await readQuestNotifierSettings(server.id);
	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	const rows = await listActiveQuestsForMember(server.id, dbMember?.id ?? 0);

	const embedConfig = await getEmbedConfig(guildId);
	const claimedTag = await translate('questEnroll.listClaimedTag', guildId, interaction.user.id);
	const lines = rows.map(({ quest, claimed }, index) => {
		const expires = questExpiresLine(quest);
		const parts = [`[${quest.questName}](${quest.questUrl})`];
		if (quest.reward?.trim()) parts.push(quest.reward.trim().replace(/\s+/g, ' ').slice(0, 120));
		if (expires) parts.push(expires);
		if (claimed) parts.push(claimedTag);
		return `**${index + 1}.** ${parts.join(' · ')}`;
	});

	const description = lines.length > 0 ? lines.join('\n').slice(0, 4000) : await translate('questEnroll.listEmpty', guildId, interaction.user.id);

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('questEnroll.listTitle', guildId, interaction.user.id))
		.setDescription(description)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const buttons: ButtonBuilder[] = [];
	const claimableCount = rows.filter((r) => !r.claimed).length;
	if (settings.autoQuest && claimableCount > 0) {
		buttons.push(
			new ButtonBuilder()
				.setCustomId(QUEST_CLAIM_ALL_BUTTON_ID)
				.setLabel(await translate('questEnroll.claimAllButton', guildId, interaction.user.id))
				.setStyle(ButtonStyle.Primary)
				.setEmoji('⚠️')
		);
	}
	buttons.push(
		new ButtonBuilder()
			.setCustomId('bot_menu')
			.setLabel(await translate('menu.button', guildId, interaction.user.id))
			.setStyle(ButtonStyle.Secondary)
	);

	const payload = { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)] };
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
	} else {
		await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }).catch(() => null));
	}
}

export async function handleQuestClaimAllButton(interaction: ButtonInteraction): Promise<void> {
	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
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
			.reply({ content: await translate('questEnroll.alreadyRunning', interaction.guild!.id, interaction.user.id), flags: 64 })
			.catch(() => null);
		return;
	}

	await interaction.showModal(buildTokenModal(QUEST_CLAIM_ALL_MODAL_ID, 'Claim all (token — high risk)'));
}

export async function handleQuestClaimAllModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const guildId = interaction.guild!.id;
	const token = tokenFromModal(interaction);
	if (token.length < 20) {
		await interaction.reply({ content: 'Token too short.', flags: 64 }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(guildId);
	const settings = await readQuestNotifierSettings(server.id);
	if (!settings.autoQuest) {
		await autoQuestDisabledReply(interaction);
		return;
	}

	if (!interaction.channelId) {
		await interaction.reply({ content: 'Unable to determine the channel. Please try again.', flags: 64 }).catch(() => null);
		return;
	}

	if (isUserEnrollRunning(interaction.user.id)) {
		await interaction.reply({ content: await translate('questEnroll.alreadyRunning', guildId, interaction.user.id), flags: 64 }).catch(() => null);
		return;
	}

	await interaction.deferReply({ flags: 64 });

	const embedConfig = await getEmbedConfig(guildId);

	let questsPayload: unknown;
	try {
		questsPayload = await fetchQuestsMe(token, { httpProxyUrl: settings.httpProxyUrl });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const invalidEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle('Invalid token')
			.setDescription(`The token you provided appears to be invalid or expired.\n\`${msg.slice(0, 500)}\``)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [invalidEmbed] }).catch(() => null);
		return;
	}

	const dbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	const rows = await listActiveQuestsForMember(server.id, dbMember?.id ?? 0);

	const queued: DiscordQuestSummary[] = [];
	const skipped: { quest: DiscordQuestSummary; reason: string }[] = [];
	for (const { quest, claimed } of rows) {
		if (claimed) {
			skipped.push({ quest, reason: await translate('questEnroll.listClaimedTag', guildId, interaction.user.id) });
			continue;
		}
		const pre = precheckQuestPayloadForEnrollment(questsPayload, quest.id);
		if (!pre.ok) {
			const keyBase =
				pre.code === 'not_found'
					? 'precheckNotFound'
					: pre.code === 'expired'
						? 'precheckExpired'
						: pre.code === 'reward_claimed'
							? 'precheckRewardClaimed'
							: 'precheckCompleted';
			skipped.push({ quest, reason: await translate(`questEnroll.${keyBase}Title`, guildId, interaction.user.id) });
			continue;
		}
		queued.push(quest);
	}

	const skippedBlock = skipped.length > 0 ? `\n\n${skipped.map(({ quest, reason }) => `• ${quest.questName} — ${reason}`).join('\n')}`.slice(0, 2000) : '';

	if (queued.length === 0) {
		const nothingEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(await translate('questEnroll.claimAllNothingTitle', guildId, interaction.user.id))
			.setDescription(`${await translate('questEnroll.claimAllNothingDescription', guildId, interaction.user.id)}${skippedBlock}`)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [nothingEmbed] }).catch(() => null);
		return;
	}

	const pendingEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('questEnroll.claimAllPendingTitle', guildId, interaction.user.id))
		.setDescription(`${await translate('questEnroll.claimAllPendingDescription', guildId, interaction.user.id, { count: queued.length })}${skippedBlock}`)
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	await interaction.editReply({ embeds: [pendingEmbed] });

	queueQuestClaimAllJob({
		client: interaction.client,
		channelId: interaction.channelId,
		guildId,
		questIds: queued.map((q) => q.id),
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		httpProxyUrl: settings.httpProxyUrl,
		serverId: server.id,
		memberId: dbMember?.id ?? 0
	});
}

export async function handleQuestEnrollButton(interaction: ButtonInteraction): Promise<void> {
	const questId = questIdFromButtonCustomId(interaction.customId);
	if (!questId) {
		await interaction.reply({ content: 'Invalid quest id.', flags: 64 }).catch(() => null);
		return;
	}

	const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
	if (!member || !(await hasPermission(member, 'quest_enroll'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild!, 'quest_enroll', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
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
		const alreadyClaimed = await db.hasServerMemberClaimedDiscordQuest(server.id, dbMember.id, questId).catch(() => false);
		if (alreadyClaimed) {
			const embedConfig = await getEmbedConfig(interaction.guild!.id);
			const botDiscordQuest = await db.getBotDiscordQuestByQuestId(questId).catch(() => null);
			const questName = botDiscordQuest?.quest_name || questId;
			const embed = new EmbedBuilder()
				.setColor(embedConfig.COLOR)
				.setTitle(`🔮 ${await translate('questEnroll.alreadyClaimed', interaction.guild!.id, interaction.user.id)}`)
				.setDescription(await translate('questEnroll.alreadyClaimedDescription', interaction.guild!.id, interaction.user.id, { questName }))
				.setFooter({ text: embedConfig.FOOTER })
				.setTimestamp();
			await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => null);
			return;
		}
	}

	await interaction.showModal(buildTokenModal(`${QUEST_ENROLL_MODAL_PREFIX}${questId}`, 'Enroll (token — high risk)'));
}

export async function handleQuestEnrollModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const questId = questIdFromModalCustomId(interaction.customId);
	const token = tokenFromModal(interaction);

	if (!questId || token.length < 20) {
		await interaction.reply({ content: 'Missing quest id or token too short.', flags: 64 }).catch(() => null);
		return;
	}

	const server = await getServerForCurrentBot(interaction.guild!.id);
	const settings = await readQuestNotifierSettings(server.id);

	if (!settings.autoQuest) {
		await autoQuestDisabledReply(interaction);
		return;
	}

	if (!interaction.channelId) {
		await interaction.reply({ content: 'Unable to determine the channel. Please try again.', flags: 64 }).catch(() => null);
		return;
	}

	if (isUserEnrollRunning(interaction.user.id)) {
		await interaction
			.reply({ content: await translate('questEnroll.alreadyRunning', interaction.guild!.id, interaction.user.id), flags: 64 })
			.catch(() => null);
		return;
	}

	await interaction.deferReply({ flags: 64 });

	let questsPayload: unknown;
	try {
		questsPayload = await fetchQuestsMe(token, { httpProxyUrl: settings.httpProxyUrl });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const embedConfig = await getEmbedConfig(interaction.guild!.id);
		const invalidEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle('Invalid token')
			.setDescription(`The token you provided appears to be invalid or expired.\n\`${msg.slice(0, 500)}\``)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [invalidEmbed] }).catch(() => null);
		return;
	}

	const pre = precheckQuestPayloadForEnrollment(questsPayload, questId);
	if (!pre.ok) {
		const embedConfig = await getEmbedConfig(interaction.guild!.id);
		const keyBase =
			pre.code === 'not_found'
				? 'precheckNotFound'
				: pre.code === 'expired'
					? 'precheckExpired'
					: pre.code === 'reward_claimed'
						? 'precheckRewardClaimed'
						: 'precheckCompleted';
		const title = await translate(`questEnroll.${keyBase}Title`, interaction.guild!.id, interaction.user.id);
		const description = await translate(`questEnroll.${keyBase}Description`, interaction.guild!.id, interaction.user.id);
		const blockEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(title)
			.setDescription(description)
			.setFooter({ text: embedConfig.FOOTER })
			.setTimestamp();
		await interaction.editReply({ embeds: [blockEmbed] }).catch(() => null);
		return;
	}
	const embedConfig = await getEmbedConfig(interaction.guild!.id);
	const pendingEmbed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(await translate('questEnroll.pendingTitle', interaction.guild!.id, interaction.user.id))
		.setDescription(await translate('questEnroll.pendingDescription', interaction.guild!.id, interaction.user.id))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
	await interaction.editReply({ embeds: [pendingEmbed] });

	const member = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);

	queueQuestEnrollJob({
		client: interaction.client,
		channelId: interaction.channelId,
		guildId: interaction.guild!.id,
		questId,
		requesterTag: interaction.user.tag,
		requesterId: interaction.user.id,
		userToken: token,
		httpProxyUrl: settings.httpProxyUrl,
		serverId: server.id,
		memberId: member?.id ?? 0
	});
}
