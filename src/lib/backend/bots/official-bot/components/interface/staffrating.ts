import {
	ModalBuilder,
	TextInputBuilder,
	ActionRowBuilder,
	TextInputStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	ButtonBuilder,
	ButtonStyle,
	LabelBuilder,
	MessageFlags
} from 'discord.js';
import { getEmbedConfig, STAFF_RATING, getBotConfig, PERMISSIONS } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { memberTranslator, translate, serverTranslator, type Translator, errorReason } from '../../i18n.js';
import { textField, checkboxField, checkboxValue, radioField, radioValue, selectValue } from './formFields.js';
import db from '../../../../../database.js';
import { updateStaffRatingRole } from '../staffrating.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../../utils/index.js';
import type {
	Guild,
	GuildMember,
	Role,
	ButtonInteraction,
	MessageComponentInteraction,
	ModalSubmitInteraction,
	RepliableInteraction,
	MessageActionRowComponentBuilder
} from 'discord.js';
import { DAY_MS, SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS, embedFieldText } from '../../../../../discordLimits.js';
import { EMBED_COLORS } from '../embedColors.js';

const VALID_CATEGORIES = ['excellent', 'helpful', 'slow_response', 'unhelpful', 'rude', 'abuse'];
const DESCRIPTION_MAX_LENGTH = 1000;
const REVIEW_REASON_MAX_LENGTH = 1000;
const MAX_RATING = 5;
const REVIEW_ID_PARTS = 5;

async function getCategoryLabel(guildId: string, userId: string, category: unknown) {
	const key = `staffRating.categories.${category}`;
	return await translate(key, { guildId, userId });
}

function getCategoryLabelFor(tr: Translator, category: string) {
	const key = `staffRating.categories.${category}`;
	return tr(key) || category;
}

type CooldownCheck = { reporterDbId: number; staffDiscordId: string; cooldownDays: number | null };

async function onRatingCooldown(serverId: number, { reporterDbId, staffDiscordId, cooldownDays }: CooldownCheck) {
	if (!Number.isFinite(cooldownDays) || cooldownDays! <= 0) {
		return false;
	}
	const staffDbMember = await db.getMemberByDiscordId(serverId, staffDiscordId).catch(() => null);
	if (!staffDbMember) {
		return false;
	}
	const lastReport = await db.getLastStaffRatingReport(serverId, reporterDbId, staffDbMember.id).catch(() => null);
	const lastRated = lastReport ? parseMySQLDateTimeUtc(lastReport.reported_at) : null;
	return !!lastRated && (Date.now() - lastRated.getTime()) / DAY_MS < cooldownDays!;
}

async function buildStaffOptions(interaction: RepliableInteraction<'cached'>) {
	const { guild } = interaction;

	try {
		const perms = await PERMISSIONS.getPermissions(guild.id);
		const staffRoleIds = perms?.STAFF_ROLES?.filter(Boolean) || [];

		if (!staffRoleIds.length) {
			return { options: [], reason: 'no_config' };
		}

		const staffMembers = new Map();

		for (const roleId of staffRoleIds) {
			const role = guild.roles.cache.get(roleId);
			if (!role) {
				continue;
			}
			role.members.forEach((member: GuildMember) => {
				if (!member.user.bot) {
					staffMembers.set(member.id, member);
				}
			});
		}

		if (staffMembers.size === 0) {
			await guild.members.fetch({ withPresences: false }).catch(() => null);
			guild.members.cache.forEach((member: GuildMember) => {
				if (member.user.bot) {
					return;
				}
				if (member.roles.cache.some((role: Role) => staffRoleIds.includes(role.id))) {
					staffMembers.set(member.id, member);
				}
			});
		}

		if (staffMembers.size === 0) {
			return { options: [], reason: 'no_staff' };
		}

		const options = Array.from(staffMembers.values())
			.sort((a, b) => {
				const aPos = a.roles?.highest?.position ?? 0;
				const bPos = b.roles?.highest?.position ?? 0;
				return bPos - aPos;
			})
			.slice(0, DISCORD_LIMITS.SELECT_OPTIONS)
			.map((member) => {
				const baseLabel = member.displayName || member.user.globalName || member.user.username || member.user.tag || member.id;
				const label = baseLabel.slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT);
				return {
					label,
					value: member.id
				};
			});

		return { options, reason: null };
	} catch (error) {
		await logger.log(`❌ Failed to build staff options: ${(error as Error).message}`);
		return { options: [], reason: 'error' };
	}
}

type ReportLog = {
	tr: Translator;
	embedConfig: { COLOR: number; FOOTER: string };
	title: string;
	staffUserId: string;
	rating: number;
	categoryLabel: string;
	description: string | null | undefined;
	reporterDisplay: string;
	statusText: string;
	reportId: number;
	color?: number;
	review?: { reason: string; reviewerId: string };
};
type Rejection = { key: string; params?: Record<string, unknown> };
type StaffOption = { label: string; value: string };

function buildReportLogEmbed(log: ReportLog) {
	const { tr, review } = log;
	const fields = [
		{ name: tr('staffRating.channelEmbed.fieldStaffMember'), value: `<@${log.staffUserId}>`, inline: true },
		{ name: tr('staffRating.channelEmbed.fieldRating'), value: `${log.rating}/5`, inline: true },
		{ name: tr('staffRating.channelEmbed.fieldCategory'), value: log.categoryLabel, inline: true },
		{ name: tr('staffRating.channelEmbed.fieldReporter'), value: log.reporterDisplay, inline: true },
		{ name: tr('staffRating.channelEmbed.fieldStatus'), value: log.statusText, inline: true },
		...(review ? [{ name: tr('staffRating.embed.reviewedBy'), value: `<@${review.reviewerId}>`, inline: true }] : []),
		{ name: tr('staffRating.channelEmbed.fieldDescription'), value: embedFieldText(log.description), inline: false },
		...(review ? [{ name: tr('staffRating.embed.staffDecision'), value: embedFieldText(review.reason), inline: false }] : [])
	];
	return new EmbedBuilder()
		.setColor(log.color ?? log.embedConfig.COLOR)
		.setTitle(log.title)
		.addFields(fields)
		.setFooter({ text: `${log.embedConfig.FOOTER} ${tr('staffRating.channelEmbed.footerReportSuffix', { reportId: log.reportId })}` })
		.setTimestamp();
}

async function rateableStaff(interaction: ButtonInteraction<'cached'>, staffOptions: StaffOption[]) {
	const server = await db.getServerByDiscordId(getBotConfig()!.id, interaction.guild.id);
	const reporterDbMember = await db.getMemberByDiscordId(server.id, interaction.user.id).catch(() => null);
	const cooldownDays = await STAFF_RATING.getCooldownDays(interaction.guild.id);
	const blocked = await Promise.all(
		staffOptions.map(
			(option) =>
				option.value === interaction.user.id ||
				(!!reporterDbMember && onRatingCooldown(server.id, { reporterDbId: reporterDbMember.id, staffDiscordId: option.value, cooldownDays }))
		)
	);
	return staffOptions.filter((_, i) => !blocked[i]);
}

function staffRatingModal(tr: Translator, rateable: StaffOption[]) {
	return new ModalBuilder()
		.setCustomId('staff_rating_submit')
		.setTitle(tr('staffRating.modal.title').slice(0, DISCORD_LIMITS.MODAL_TITLE))
		.addLabelComponents(
			new LabelBuilder()
				.setLabel(tr('staffRating.selectStaff').slice(0, DISCORD_LIMITS.LABEL))
				.setStringSelectMenuComponent(
					new StringSelectMenuBuilder().setCustomId('staff').setPlaceholder(tr('staffRating.selectStaffPlaceholder')).addOptions(rateable)
				),
			radioField(
				tr('staffRating.modal.ratingLabel'),
				'rating',
				['5', '4', '3', '2', '1'].map((value) => ({ label: '⭐'.repeat(Number(value)), value }))
			),
			radioField(
				tr('staffRating.modal.categoryLabel'),
				'category',
				VALID_CATEGORIES.map((category) => ({ label: getCategoryLabelFor(tr, category), value: category }))
			),
			textField(
				tr('staffRating.modal.descriptionLabel'),
				new TextInputBuilder()
					.setCustomId('description')
					.setStyle(TextInputStyle.Paragraph)
					.setPlaceholder(tr('staffRating.modal.descriptionPlaceholder'))
					.setRequired(true)
					.setMaxLength(DESCRIPTION_MAX_LENGTH)
			),
			checkboxField(tr('staffRating.modal.anonymousLabel'), 'anonymous', false)
		);
}

export async function handleStaffRatingButton(interaction: ButtonInteraction<'cached'>) {
	try {
		const { member } = interaction;

		if (!(await hasPermission(member, 'staff_rating'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'staff_rating', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const tr = await memberTranslator(interaction.guild.id, interaction.user.id);
		const refuse = (key: string) => interaction.reply({ content: tr(key), flags: MessageFlags.Ephemeral }).catch(() => null);

		if (!(await STAFF_RATING.getConfig(interaction.guild.id))) {
			await refuse('staffRating.errors.notConfigured');
			return;
		}

		const { options: staffOptions, reason: staffReason } = await buildStaffOptions(interaction);
		if (!staffOptions || staffOptions.length === 0) {
			await refuse(staffReason === 'no_config' ? 'staffRating.errors.noStaffConfigured' : 'staffRating.errors.noStaffAvailable');
			return;
		}

		const rateable = await rateableStaff(interaction, staffOptions);
		if (rateable.length === 0) {
			await refuse('staffRating.errors.allOnCooldown');
			return;
		}

		await interaction.showModal(staffRatingModal(tr, rateable));
		await logger.log(`📋 Staff rating form shown to ${member.user.tag} (${member.user.id})`);
	} catch (error) {
		await logger.log(`❌ Error showing staff report selection: ${(error as Error).message}`);
		const errorMsg = await translate(
			'staffRating.errors.submitFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
		);
		await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
	}
}

type RatingForm = { staffUserId: string; rating: number; category: string; description: string; isAnonymous: boolean };
type RatingParties = { serverId: number; reporterId: number; staffId: number };

function readRatingForm(interaction: ModalSubmitInteraction<'cached'>): { value: RatingForm } | { rejection: Rejection } {
	const { fields } = interaction;
	const staffUserId = selectValue(fields, 'staff');
	const rating = parseInt(radioValue(fields, 'rating') ?? '', 10);
	const category = radioValue(fields, 'category');
	if (!staffUserId || staffUserId === interaction.user.id) {
		return { rejection: { key: staffUserId ? 'staffRating.errors.cannotReportSelf' : 'common.errors.memberNotFound' } };
	}
	if (isNaN(rating) || rating < 1 || rating > MAX_RATING) {
		return { rejection: { key: 'staffRating.errors.invalidRating' } };
	}
	if (!category || !VALID_CATEGORIES.includes(category)) {
		return { rejection: { key: 'staffRating.errors.invalidCategory' } };
	}
	const description = fields.getTextInputValue('description').trim();
	if (!description) {
		return { rejection: { key: 'staffRating.errors.emptyDescription' } };
	}
	return { value: { staffUserId, rating, category, description, isAnonymous: checkboxValue(fields, 'anonymous', false) } };
}

async function ratingCooldownRejection(tr: Translator, guildId: string, parties: RatingParties): Promise<Rejection | null> {
	const lastReport = await db.getLastStaffRatingReport(parties.serverId, parties.reporterId, parties.staffId);
	if (!lastReport) {
		return null;
	}
	const lastRatedDate = parseMySQLDateTimeUtc(lastReport.reported_at);
	if (!lastRatedDate) {
		await logger.log(`⚠️ Could not parse reported_at for report ${lastReport.id}: ${lastReport.reported_at}`);
		return { key: 'staffRating.errors.submitFailed', params: { error: 'Invalid timestamp data' } };
	}
	const cooldownDays = await STAFF_RATING.getCooldownDays(guildId);
	const daysPassed = (Date.now() - lastRatedDate.getTime()) / DAY_MS;
	if (!Number.isFinite(cooldownDays) || cooldownDays! <= 0 || daysPassed >= cooldownDays!) {
		return null;
	}
	const daysRemaining = Math.ceil(cooldownDays! - daysPassed);
	return {
		key: 'staffRating.errors.onCooldown',
		params: {
			time: daysRemaining,
			unitKey: daysRemaining === 1 ? 'common.timeUnits.day' : 'common.timeUnits.days',
			lastRated: `<t:${Math.floor(lastRatedDate.getTime() / SECOND_MS)}:R>`
		}
	};
}

async function postReportForReview(interaction: ModalSubmitInteraction<'cached'>, { form, reportId }: { form: RatingForm; reportId: number }) {
	const { guild } = interaction;
	const reportChannelId = await STAFF_RATING.getReviewChannel(guild.id);
	const reportChannel = reportChannelId ? guild.channels.cache.get(reportChannelId) || (await guild.channels.fetch(reportChannelId).catch(() => null)) : null;
	if (!reportChannel || !reportChannel.isTextBased()) {
		return;
	}
	const tr = await serverTranslator(guild.id);
	const logEmbed = buildReportLogEmbed({
		tr,
		embedConfig: await getEmbedConfig(guild.id),
		title: tr('staffRating.channelEmbed.pendingTitle'),
		staffUserId: form.staffUserId,
		rating: form.rating,
		categoryLabel: getCategoryLabelFor(tr, form.category),
		description: form.description,
		reporterDisplay: form.isAnonymous ? tr('staffRating.channelEmbed.anonymousReporter') : `<@${interaction.user.id}>`,
		statusText: tr('staffRating.channelEmbed.pendingStatus'),
		reportId,
		color: 0xff8200
	});
	const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder().setCustomId(`staff_rating_approve|${reportId}`).setLabel(tr('staffRating.channelEmbed.approveButton')).setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(`staff_rating_reject|${reportId}`).setLabel(tr('staffRating.channelEmbed.rejectButton')).setStyle(ButtonStyle.Danger)
	);
	const pendingRoleId = await STAFF_RATING.getPendingRole(guild.id);
	await reportChannel.send({ content: pendingRoleId ? `<@&${pendingRoleId}>` : undefined, embeds: [logEmbed], components: [buttons] }).catch(() => null);
}

async function staffToRate(guild: Guild, staffUserId: string): Promise<{ value: GuildMember } | { rejection: Rejection }> {
	const staffMember = await guild.members.fetch(staffUserId).catch(() => null);
	if (!staffMember) {
		return { rejection: { key: 'common.errors.memberNotFound' } };
	}
	if (!(await hasPermission(staffMember, 'staff_only'))) {
		return { rejection: { key: 'staffRating.errors.notStaff' } };
	}
	return { value: staffMember };
}

export async function handleStaffRatingModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { member, guild, user } = interaction;

		if (!(await hasPermission(member, 'staff_rating'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'staff_rating', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const mtr = await memberTranslator(guild.id, user.id);
		const reject = ({ key, params }: Rejection) => interaction.editReply({ content: mtr(key, params) });

		const form = readRatingForm(interaction);
		if ('rejection' in form) {
			await reject(form.rejection);
			return;
		}

		const server = await db.getServerByDiscordId(getBotConfig()!.id, guild.id);
		const reporterDbMember = await db.upsertMember(server.id, member);
		const staff = await staffToRate(guild, form.value.staffUserId);
		if ('rejection' in staff) {
			await reject(staff.rejection);
			return;
		}

		const staffDbMember = await db.upsertMember(server.id, staff.value);
		const cooldown = await ratingCooldownRejection(mtr, guild.id, { serverId: server.id, reporterId: reporterDbMember.id, staffId: staffDbMember.id });
		if (cooldown) {
			await reject(cooldown);
			return;
		}

		const { rating, category, description, isAnonymous } = form.value;
		const reportId = await db.createStaffRatingReport(server.id, {
			reporterMemberId: reporterDbMember.id,
			reportedStaffId: staffDbMember.id,
			rating,
			category,
			description,
			isAnonymous
		});

		const embedConfig = await getEmbedConfig(guild.id);
		const successDescription = mtr('staffRating.submitted.description') + (isAnonymous ? mtr('staffRating.submitted.anonymous') : '');
		const successEmbed = new EmbedBuilder()
			.setColor(embedConfig.COLOR)
			.setTitle(mtr('staffRating.submitted.title'))
			.setDescription(successDescription)
			.setTimestamp()
			.setFooter({ text: embedConfig.FOOTER });
		await interaction.editReply({ embeds: [successEmbed] });

		await postReportForReview(interaction, { form: form.value, reportId });
		await logger.log(
			`✅ Staff report #${reportId} submitted by ${user.tag} (${user.id}) for staff ${staff.value.user.tag} (${form.value.staffUserId}) - Rating: ${rating}, Category: ${category}`
		);
	} catch (error) {
		await logger.log(`❌ Error processing staff report: ${(error as Error).message}`);
		await logger.log(`❌ Stack: ${(error as Error).stack}`);
		const errorMsg = await translate(
			'staffRating.errors.submitFailed',
			{ guildId: interaction.guild.id, userId: interaction.user.id },
			{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
		);
		await interaction.editReply({ content: errorMsg });
	}
}

type DecisionNotice = { translationKey: string; categoryLabel: string; reviewReason: string };

async function notifyReporterOfDecision(
	guild: Guild,
	report: NonNullable<Awaited<ReturnType<typeof db.getStaffReportById>>>,
	{ translationKey, categoryLabel, reviewReason }: DecisionNotice
) {
	if (!report?.reporter_discord_id) {
		await logger.log(`⚠️ Cannot send DM notification: reporter_discord_id is missing`);
		return;
	}
	const reporterUser = await guild.client.users.fetch(report.reporter_discord_id).catch((error) => {
		logger.log(`⚠️ Failed to fetch reporter user ${report.reporter_discord_id}: ${error.message}`);
		return null;
	});
	if (!reporterUser) {
		return;
	}
	const content = await translate(
		translationKey,
		{ guildId: guild.id, userId: reporterUser.id },
		{
			staff: `<@${report.staff_discord_id}>`,
			rating: report.rating,
			category: categoryLabel,
			description: embedFieldText(report.description),
			server: guild.name,
			reason: embedFieldText(reviewReason || '')
		}
	);
	const titleKey = translationKey.includes('rejected') ? 'staffRating.dm.embedTitleRejected' : 'staffRating.dm.embedTitleApproved';
	const title = await translate(titleKey, { guildId: guild.id, userId: reporterUser.id }, {});
	try {
		const embedConfig = await getEmbedConfig(guild.id);
		const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(title).setDescription(content).setTimestamp().setFooter({ text: embedConfig.FOOTER });
		await reporterUser.send({ embeds: [embed] });
		await logger.log(`✅ Sent DM notification (${translationKey}) to reporter ${report.reporter_discord_id} for report #${report.id}`);
	} catch (error) {
		await logger.log(`⚠️ Failed to send DM notification (${translationKey}) to reporter ${report.reporter_discord_id}: ${(error as Error).message}`);
	}
}

const REVIEW_DECISION_REASON_INPUT = 'review_decision_reason';

type DecisionForm = { isApproved: boolean; reportId: number; channelId: string; messageId: string; reviewReason: string };
type StaffReport = NonNullable<Awaited<ReturnType<typeof db.getStaffReportById>>>;
type ReviewContext = { guild: Guild; serverId: number; report: StaffReport; reviewerDbId: number; reviewReason: string; categoryLabel: string };

function readDecisionForm(interaction: ModalSubmitInteraction<'cached'>): { value: DecisionForm } | { rejection: Rejection } {
	const parts = interaction.customId.split('|');
	const invalid = (error: string) => ({ rejection: { key: 'staffRating.errors.submitFailed', params: { error } } });
	if (parts.length !== REVIEW_ID_PARTS || parts[0] !== 'sr_rev') {
		return invalid('Invalid form');
	}
	const [, decisionRaw, reportIdStr, channelId, messageId] = parts;
	if (decisionRaw !== 'approve' && decisionRaw !== 'reject') {
		return invalid('Invalid decision');
	}
	const reportId = parseInt(reportIdStr, 10);
	if (!Number.isFinite(reportId)) {
		return invalid('Invalid report ID');
	}
	const reviewReason = interaction.fields.getTextInputValue(REVIEW_DECISION_REASON_INPUT)?.trim();
	if (!reviewReason) {
		return { rejection: { key: 'staffRating.errors.reviewReasonRequired' } };
	}
	return { value: { isApproved: decisionRaw === 'approve', reportId, channelId, messageId, reviewReason } };
}

async function findReportMessage(guild: Guild, { channelId, messageId }: { channelId: string; messageId: string }) {
	try {
		const ch = await guild.channels.fetch(channelId);
		return ch && ch.isTextBased() ? await ch.messages.fetch(messageId).catch(() => null) : null;
	} catch (fetchErr) {
		await logger.log(`⚠️ Could not fetch staff report log message: ${(fetchErr as Error).message}`);
		return null;
	}
}

async function approveReport({ guild, serverId, report, reviewerDbId, reviewReason, categoryLabel }: ReviewContext) {
	await db.updateStaffReportStatus(report.id, 'approved', { reviewedByMemberId: reviewerDbId, reviewReason });
	const aggregate = await db.getStaffRatingAggregate(serverId, report.reported_staff_id);
	const rating = aggregate.average_rating || report.rating;
	await db.upsertStaffRating(serverId, report.reported_staff_id, { ratingValue: rating, totalReports: aggregate.total_reports });
	await updateStaffRatingRole(guild, {
		serverId,
		staffMemberId: report.reported_staff_id,
		staffDiscordId: report.staff_discord_id,
		stats: { rating, total_reports: aggregate.total_reports },
		options: { channelContext: { category: categoryLabel, feedback: report.description } }
	});
}

async function recordDecision(review: ReviewContext, isApproved: boolean) {
	const { guild, report, reviewReason } = review;
	if (isApproved) {
		await approveReport(review);
	} else {
		await db.updateStaffReportStatus(report.id, 'rejected', { reviewedByMemberId: review.reviewerDbId, reviewReason });
	}
	const categoryLabelForDM = await getCategoryLabel(guild.id, report.reporter_discord_id, report.category);
	await notifyReporterOfDecision(guild, report, {
		translationKey: isApproved ? 'staffRating.dm.approved' : 'staffRating.dm.rejected',
		categoryLabel: categoryLabelForDM,
		reviewReason
	});
}

async function decidedReportEmbed(review: ReviewContext, { isApproved, reviewerId }: { isApproved: boolean; reviewerId: string }) {
	const { guild, report } = review;
	const embedConfig = await getEmbedConfig(guild.id);
	const tr = await serverTranslator(guild.id);
	return buildReportLogEmbed({
		tr,
		embedConfig,
		title: tr(isApproved ? 'staffRating.channelEmbed.titleApproved' : 'staffRating.channelEmbed.titleRejected'),
		staffUserId: report.staff_discord_id,
		rating: report.rating,
		categoryLabel: review.categoryLabel,
		description: report.description,
		reporterDisplay: report.is_anonymous ? tr('staffRating.channelEmbed.anonymousReporter') : `<@${report.reporter_discord_id}>`,
		statusText: tr(isApproved ? 'staffRating.embed.statusApproved' : 'staffRating.embed.statusRejected'),
		reportId: report.id,
		color: isApproved ? EMBED_COLORS.approved : embedConfig.COLOR,
		review: { reason: review.reviewReason, reviewerId }
	});
}

async function reviewableReport(guild: Guild, reportId: number): Promise<{ serverId: number; report: StaffReport } | { rejection: Rejection }> {
	const server = await db.getServerByDiscordId(getBotConfig()!.id, guild.id);
	if (!server) {
		return { rejection: { key: 'staffRating.errors.submitFailed', params: { error: 'Server not found' } } };
	}
	const report = await db.getStaffReportById(server.id, reportId);
	if (!report) {
		return { rejection: { key: 'staffRating.errors.submitFailed', params: { error: 'Report not found' } } };
	}
	return { serverId: server.id, report };
}

export async function handleStaffRatingDecisionModal(interaction: ModalSubmitInteraction<'cached'>) {
	try {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const { guild } = interaction;
		const mtr = await memberTranslator(guild.id, interaction.user.id);
		const reply = ({ key, params }: Rejection) => interaction.editReply({ content: mtr(key, params) }).catch(() => null);

		const form = readDecisionForm(interaction);
		if ('rejection' in form) {
			await reply(form.rejection);
			return;
		}

		const moderator = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!moderator || !(await hasPermission(moderator, 'setup'))) {
			await reply({ key: 'staffRating.errors.permissionDenied' });
			return;
		}

		const found = await reviewableReport(guild, form.value.reportId);
		if ('rejection' in found) {
			await reply(found.rejection);
			return;
		}
		const { serverId, report } = found;
		const moderatorDbMember = await db.upsertMember(serverId, moderator);
		const sourceMessage = await findReportMessage(guild, form.value);

		if (report.status !== 'pending') {
			await reply({ key: 'staffRating.review.alreadyProcessed' });
			await sourceMessage?.edit({ components: [] }).catch(() => null);
			return;
		}

		const { isApproved, reviewReason } = form.value;
		const review: ReviewContext = {
			guild,
			serverId,
			report,
			reviewerDbId: moderatorDbMember.id,
			reviewReason,
			categoryLabel: getCategoryLabelFor(await serverTranslator(guild.id), report.category)
		};
		await recordDecision(review, isApproved);

		const updatedEmbed = await decidedReportEmbed(review, { isApproved, reviewerId: interaction.user.id });
		await sourceMessage?.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
		await reply({ key: isApproved ? 'staffRating.review.approvedReply' : 'staffRating.review.rejectedReply', params: { reportId: report.id } });

		await logger.log(
			`${isApproved ? '✅' : '⛔'} Staff report #${report.id} ${isApproved ? 'approve' : 'reject'} by ${interaction.user.tag} (${interaction.user.id})`
		);
	} catch (error) {
		await logger.log(`❌ Error handling staff report decision modal: ${(error as Error).message}`);
		await interaction
			.editReply({
				content: await translate(
					'staffRating.errors.submitFailed',
					{ guildId: interaction.guild.id, userId: interaction.user.id },
					{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
				)
			})
			.catch(() => null);
	}
}

async function showStaffRatingReviewModal(interaction: MessageComponentInteraction<'cached'>, decision: string) {
	const { guild } = interaction;
	const [, reportIdStr] = interaction.customId.split('|');
	const messageId = interaction.message?.id;
	const { channelId } = interaction;
	if (!reportIdStr || !messageId || !channelId) {
		await interaction
			.reply({
				content: await translate('staffRating.errors.submitFailed', { guildId: guild.id, userId: interaction.user.id }, { error: 'Invalid interaction' }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}
	const titleKey = decision === 'approve' ? 'staffRating.reviewModal.titleApprove' : 'staffRating.reviewModal.titleReject';
	const modal = new ModalBuilder()
		.setCustomId(`sr_rev|${decision}|${reportIdStr}|${channelId}|${messageId}`)
		.setTitle(await translate(titleKey, { guildId: guild.id, userId: interaction.user.id }));
	const input = new TextInputBuilder()
		.setCustomId(REVIEW_DECISION_REASON_INPUT)
		.setLabel(await translate('staffRating.reviewModal.reasonLabel', { guildId: guild.id, userId: interaction.user.id }))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(await translate('staffRating.reviewModal.reasonPlaceholder', { guildId: guild.id, userId: interaction.user.id }))
		.setRequired(true)
		.setMinLength(2)
		.setMaxLength(REVIEW_REASON_MAX_LENGTH);
	modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
	await interaction.showModal(modal);
}

export async function handleStaffRatingApprove(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showStaffRatingReviewModal(interaction, 'approve');
	} catch (error) {
		await logger.log(`❌ Error opening staff report approve modal: ${(error as Error).message}`);
	}
}

export async function handleStaffRatingReject(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showStaffRatingReviewModal(interaction, 'reject');
	} catch (error) {
		await logger.log(`❌ Error opening staff report reject modal: ${(error as Error).message}`);
	}
}
