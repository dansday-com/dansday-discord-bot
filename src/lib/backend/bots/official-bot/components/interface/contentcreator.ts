import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	type ModalActionRowComponentBuilder,
	TextInputBuilder,
	TextInputStyle
} from 'discord.js';
import { CONTENT_CREATOR, getBotConfig, getEmbedConfig } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { translate, t } from '../../i18n.js';
import db from '../../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../../utils/index.js';

const liveWatchers = new Map<string, any>();
const liveStatus = new Map<string, boolean>();
let watchInterval: NodeJS.Timeout | null = null;
let connectionCtor: any = null;
let ctorLoadAttempted = false;

function normalizeTikTokUsername(raw: string) {
	return raw.trim().replace(/^@+/, '').toLowerCase();
}

function truncateReason(text: string) {
	if (!text) return '—';
	if (text.length > 1024) return `${text.slice(0, 1021)}...`;
	return text;
}

const DUPLICATE_CONTENT_CREATOR_AUTO_REJECT_MS = 500;

async function runDuplicateContentCreatorAutoReject(opts: {
	client: any;
	botId: number | string;
	guildId: string;
	channelId: string | null;
	messageId: string | null;
	serverId: number;
	appId: number;
	applicantDiscordId: string;
	username: string;
	conflict: { kind: 'pending' | 'approved'; discordId: string };
}) {
	try {
		const { client, botId, guildId, channelId, messageId, serverId, appId, applicantDiscordId, username, conflict } = opts;
		const guild = await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) return;
		const server = await db.getServerByDiscordId(Number(botId), guildId).catch(() => null);
		if (!server || Number(server.id) !== Number(serverId)) return;

		const app = await db.getContentCreatorApplicationById(server.id, appId);
		if (!app || app.status !== 'pending') return;

		const systemReason = t('contentCreator.channelEmbed.autoRejectReviewReason', 'en');
		const conflictNote =
			conflict.kind === 'pending'
				? t('contentCreator.channelEmbed.autoRejectConflictPending', 'en')
				: t('contentCreator.channelEmbed.autoRejectConflictApproved', 'en');
		const reviewReasonFull = `${systemReason}\n\n${conflictNote} <@${conflict.discordId}>`;

		await db.updateContentCreatorApplicationStatus(app.id, 'rejected', undefined, reviewReasonFull);

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const applicantUser = await client.users.fetch(applicantDiscordId).catch(() => null);
		if (applicantUser) {
			const applicantReasonDm = await translate('contentCreator.autoRejectApplicantReason', guild.id, applicantUser.id);
			await applicantUser
				.send({
					content: await translate('contentCreator.dm.rejected', guild.id, applicantUser.id, {
						server: guild.name,
						username: `@${username}`,
						reason: truncateReason(applicantReasonDm)
					})
				})
				.catch(() => null);
		}

		if (channelId && messageId) {
			const ch = await guild.channels.fetch(channelId).catch(() => null);
			if (ch?.isTextBased()) {
				const sourceMessage = await ch.messages.fetch(messageId).catch(() => null);
				if (sourceMessage) {
					const staffDecisionLabel = t('contentCreator.embed.staffDecision', 'en');
					const reviewedByLabel = t('contentCreator.embed.reviewedBy', 'en');
					const statusLabel = t('contentCreator.embed.statusRejected', 'en');
					const reviewedBySystem = t('contentCreator.embed.reviewedBySystem', 'en');
					const updatedEmbed = new EmbedBuilder()
						.setColor(0xef4444)
						.setTitle(t('contentCreator.channelEmbed.titleRejected', 'en'))
						.setDescription(
							t('contentCreator.channelEmbed.descriptionReviewed', 'en', {
								mention: `<@${app.applicant_discord_id}>`,
								tiktok: app.tiktok_username
							})
						)
						.addFields(
							{ name: t('contentCreator.channelEmbed.fieldStatus', 'en'), value: statusLabel, inline: true },
							{ name: reviewedByLabel, value: reviewedBySystem, inline: true },
							{
								name: t('contentCreator.channelEmbed.fieldApplicantReason', 'en'),
								value: truncateReason(app.reason),
								inline: false
							},
							{ name: staffDecisionLabel, value: truncateReason(reviewReasonFull), inline: false }
						)
						.setTimestamp();
					if (embedConfig?.FOOTER) {
						updatedEmbed.setFooter({
							text: `${embedConfig.FOOTER} ${t('contentCreator.channelEmbed.footerAppSuffix', 'en', { appId: app.id })}`
						});
					}
					await sourceMessage.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
				}
			}
		}

		await logger.log(
			`⛔ Content creator duplicate auto-reject: @${username} applicant ${applicantDiscordId} vs ${conflict.discordId} (${conflict.kind}) guild ${guildId} app #${appId}`
		);
	} catch (e: any) {
		await logger.log(`❌ Content creator duplicate auto-reject failed: ${e.message}`);
	}
}

function isLive(guildId: string, discordMemberId: string) {
	return liveStatus.get(`${guildId}:${discordMemberId}`) === true;
}

async function showContentCreatorApplyModal(interaction: any) {
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
	if (!(await hasPermission(member, 'content_creator'))) {
		const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'content_creator', interaction.user.id);
		await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
		return;
	}

	const config = await CONTENT_CREATOR.getConfig(interaction.guild.id);
	const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(interaction.guild.id).catch(() => null);
	if (!config?.admission_channel_id || !creatorRoleId) {
		await interaction
			.reply({ content: await translate('contentCreator.errors.notConfigured', interaction.guild.id, interaction.user.id), flags: 64 })
			.catch(() => null);
		return;
	}

	if (member?.roles?.cache?.has(creatorRoleId)) {
		await interaction
			.reply({ content: await translate('contentCreator.errors.alreadyCreator', interaction.guild.id, interaction.user.id), flags: 64 })
			.catch(() => null);
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId('content_creator_apply')
		.setTitle(await translate('contentCreator.modal.title', interaction.guild.id, interaction.user.id));
	const usernameInput = new TextInputBuilder()
		.setCustomId('tiktok_username')
		.setLabel(await translate('contentCreator.modal.usernameLabel', interaction.guild.id, interaction.user.id))
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(await translate('contentCreator.modal.usernamePlaceholder', interaction.guild.id, interaction.user.id))
		.setRequired(true)
		.setMaxLength(100);
	const reasonInput = new TextInputBuilder()
		.setCustomId('reason')
		.setLabel(await translate('contentCreator.modal.reasonLabel', interaction.guild.id, interaction.user.id))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(await translate('contentCreator.modal.reasonPlaceholder', interaction.guild.id, interaction.user.id))
		.setRequired(true)
		.setMaxLength(500);
	modal.addComponents(
		new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(usernameInput),
		new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput)
	);
	await interaction.showModal(modal);
}

async function ensureTikTokCtor() {
	if (connectionCtor || ctorLoadAttempted) return connectionCtor;
	ctorLoadAttempted = true;
	try {
		const lib = await import('tiktok-live-connector');
		connectionCtor = lib?.WebcastPushConnection || lib?.default?.WebcastPushConnection || null;
	} catch (error: any) {
		await logger.log(`⚠️ TikTok connector unavailable: ${error.message}`);
		connectionCtor = null;
	}
	return connectionCtor;
}

async function broadcastLiveStart(guild: any, discordMemberId: string, tiktokUsername: string) {
	const targetChannelId = await CONTENT_CREATOR.getTargetChannel(guild.id).catch(() => null);
	if (!targetChannelId) return;
	const channel = guild.channels.cache.get(targetChannelId) || (await guild.channels.fetch(targetChannelId).catch(() => null));
	if (!channel || !channel.isTextBased()) return;

	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const mention = `<@${discordMemberId}>`;
	const liveUrl = `https://www.tiktok.com/@${encodeURIComponent(tiktokUsername)}/live`;
	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? 0xec4899)
		.setTitle(t('contentCreator.channelEmbed.liveTitle', 'en'))
		.setDescription(t('contentCreator.channelEmbed.liveDescription', 'en', { mention }))
		.setTimestamp();
	if (embedConfig?.FOOTER) embed.setFooter({ text: embedConfig.FOOTER });
	const watchButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(liveUrl).setLabel(t('contentCreator.channelEmbed.liveWatchButton', 'en'));
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);
	await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
}

async function syncLiveWatchers(client: any) {
	const Ctor = await ensureTikTokCtor();
	if (!Ctor) return;

	for (const guild of client.guilds.cache.values()) {
		const botConfig = getBotConfig();
		if (!botConfig) continue;
		const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
		if (!server) continue;
		const creators = await db.getApprovedContentCreators(server.id).catch(() => []);
		const activeKeys = new Set<string>();

		for (const creator of creators) {
			const username = normalizeTikTokUsername(creator.tiktok_username || '');
			if (!username || !creator.discord_member_id) continue;
			const key = `${guild.id}:${creator.discord_member_id}`;
			activeKeys.add(key);
			if (liveWatchers.has(key)) continue;

			try {
				const conn = new Ctor(username, { processInitialData: false, enableWebsocketUpgrade: true });
				conn.on('streamStart', async () => {
					if (liveStatus.get(key)) return;
					liveStatus.set(key, true);
					await broadcastLiveStart(guild, creator.discord_member_id, username);
				});
				conn.on('streamEnd', () => liveStatus.set(key, false));
				conn.on('disconnected', () => liveStatus.set(key, false));
				await conn.connect().catch(() => null);
				liveWatchers.set(key, conn);
			} catch (_) {}
		}

		for (const [key, conn] of liveWatchers.entries()) {
			if (!key.startsWith(`${guild.id}:`) || activeKeys.has(key)) continue;
			try {
				await conn.disconnect?.();
			} catch (_) {}
			liveWatchers.delete(key);
			liveStatus.delete(key);
		}
	}
}

type ContentCreatorListOptions = { bannerNote?: string };

async function buildContentCreatorListView(guild: any, actingMember: any, localeUserId: string, options: ContentCreatorListOptions = {}) {
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
	const alreadyCreator = creatorRoleId ? actingMember?.roles?.cache?.has(creatorRoleId) : false;

	const botConfig = getBotConfig();
	if (!botConfig) {
		return { error: 'notConfigured' as const };
	}

	const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
	if (!server) {
		return { error: 'notConfigured' as const };
	}

	const dbMember = await db.upsertMember(server.id, actingMember).catch(() => null);
	const lastApplication = dbMember ? await db.getLastContentCreatorApplication(server.id, dbMember.id).catch(() => null) : null;

	const creators = await db.getApprovedContentCreators(server.id).catch(() => []);

	const title = await translate('contentCreator.list.title', guild.id, localeUserId);
	const desc = await translate('contentCreator.list.description', guild.id, localeUserId);

	const lines: string[] = [];
	for (const c of creators) {
		const discordId = String(c.discord_member_id || '');
		const username = normalizeTikTokUsername(String(c.tiktok_username || ''));
		if (!discordId || !username) continue;
		if (creatorRoleId) {
			const listedMember = await guild.members.fetch(discordId).catch(() => null);
			if (listedMember && !listedMember.roles.cache.has(creatorRoleId)) continue;
		}
		const live = isLive(guild.id, discordId);
		lines.push(`${live ? '🔴' : '⚫'} <@${discordId}> — **@${username}**\nhttps://www.tiktok.com/@${username}`);
	}

	const creatorListText = lines.length > 0 ? lines.slice(0, 10).join('\n\n') : await translate('contentCreator.list.none', guild.id, localeUserId);

	let body = `${desc}\n\n${creatorListText}`;
	if (options.bannerNote) {
		body = `${options.bannerNote}\n\n${body}`;
	}

	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? 0xec4899)
		.setTitle(title)
		.setDescription(body)
		.setTimestamp();
	if (embedConfig?.FOOTER) embed.setFooter({ text: embedConfig.FOOTER });

	const row = new ActionRowBuilder<ButtonBuilder>();
	row.addComponents(
		new ButtonBuilder()
			.setCustomId('bot_menu')
			.setLabel(await translate('menu.button', guild.id, localeUserId))
			.setStyle(ButtonStyle.Secondary)
	);

	const canApply = !alreadyCreator && lastApplication?.status !== 'pending';
	if (canApply) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_apply_open')
				.setLabel(await translate('contentCreator.list.applyButton', guild.id, localeUserId))
				.setStyle(ButtonStyle.Success)
		);
	}

	if (alreadyCreator && creatorRoleId) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_request')
				.setLabel(await translate('contentCreator.dismiss.button', guild.id, localeUserId))
				.setStyle(ButtonStyle.Danger)
		);
	}

	return { embed, components: [row] };
}

export async function handleContentCreatorButton(interaction: any) {
	try {
		const guild = interaction.guild;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));

		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
			return;
		}

		const built = await buildContentCreatorListView(guild, member, interaction.user.id);
		if ('error' in built) {
			await interaction.reply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), flags: 64 }).catch(() => null);
			return;
		}

		if (interaction.replied || interaction.deferred) {
			await interaction.editReply({ embeds: [built.embed], components: built.components }).catch(() => null);
		} else {
			await interaction.reply({ embeds: [built.embed], components: built.components, flags: 64 }).catch(() => null);
		}
	} catch (error: any) {
		await logger.log(`❌ Error opening content creator view: ${error.message}`);
	}
}

export async function handleContentCreatorDismissRequest(interaction: any) {
	try {
		const guild = interaction.guild;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
			return;
		}
		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (!creatorRoleId || !member?.roles?.cache?.has(creatorRoleId)) {
			const built = await buildContentCreatorListView(guild, member, interaction.user.id);
			if ('error' in built) {
				await interaction
					.reply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), flags: 64 })
					.catch(() => null);
				return;
			}
			await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const confirmEmbed = new EmbedBuilder()
			.setColor(embedConfig?.COLOR ?? 0xec4899)
			.setTitle(await translate('contentCreator.dismiss.confirmTitle', guild.id, interaction.user.id))
			.setDescription(await translate('contentCreator.dismiss.confirmDescription', guild.id, interaction.user.id))
			.setTimestamp();
		if (embedConfig?.FOOTER) confirmEmbed.setFooter({ text: embedConfig.FOOTER });

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_yes')
				.setLabel(await translate('contentCreator.dismiss.yes', guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_no')
				.setLabel(await translate('contentCreator.dismiss.no', guild.id, interaction.user.id))
				.setStyle(ButtonStyle.Secondary)
		);

		await interaction.update({ embeds: [confirmEmbed], components: [row] }).catch(() => null);
	} catch (error: any) {
		await logger.log(`❌ Content creator dismiss request error: ${error.message}`);
	}
}

export async function handleContentCreatorDismissNo(interaction: any) {
	try {
		const guild = interaction.guild;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
			return;
		}
		const built = await buildContentCreatorListView(guild, member, interaction.user.id);
		if ('error' in built) {
			await interaction
				.update({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), embeds: [], components: [] })
				.catch(() => null);
			return;
		}
		await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
	} catch (error: any) {
		await logger.log(`❌ Content creator dismiss cancel error: ${error.message}`);
	}
}

export async function handleContentCreatorDismissYes(interaction: any) {
	try {
		const guild = interaction.guild;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
			return;
		}

		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (!creatorRoleId || !member?.roles?.cache?.has(creatorRoleId)) {
			const built = await buildContentCreatorListView(guild, member, interaction.user.id);
			if ('error' in built) {
				await interaction
					.update({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), embeds: [], components: [] })
					.catch(() => null);
				return;
			}
			await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction
				.update({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), embeds: [], components: [] })
				.catch(() => null);
			return;
		}
		const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
		if (!server) {
			await interaction
				.update({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id), embeds: [], components: [] })
				.catch(() => null);
			return;
		}

		const dbMember = await db.upsertMember(server.id, member).catch(() => null);
		await member.roles.remove(creatorRoleId, 'Content creator dismissed by user').catch(() => null);
		if (dbMember) {
			await db.clearMemberContentCreatorRole(server.id, dbMember.id, creatorRoleId).catch(() => null);
		}

		const refreshedMember = await guild.members.fetch(interaction.user.id).catch(() => member);
		const bannerNote = await translate('contentCreator.dismiss.removed', guild.id, interaction.user.id);
		const built = await buildContentCreatorListView(guild, refreshedMember, interaction.user.id, { bannerNote });
		if ('error' in built) {
			await interaction.update({ content: bannerNote, embeds: [], components: [] }).catch(() => null);
			return;
		}
		await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
	} catch (error: any) {
		await logger.log(`❌ Content creator dismiss confirm error: ${error.message}`);
	}
}

export async function handleContentCreatorApplyButton(interaction: any) {
	try {
		await showContentCreatorApplyModal(interaction);
	} catch (error: any) {
		await logger.log(`❌ Error opening content creator apply modal: ${error.message}`);
	}
}

export async function handleContentCreatorModal(interaction: any) {
	await interaction.deferReply({ flags: 64 });
	try {
		const guild = interaction.guild;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));

		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'content_creator', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
			return;
		}

		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (creatorRoleId && member?.roles?.cache?.has(creatorRoleId)) {
			await interaction.editReply({ content: await translate('contentCreator.errors.alreadyCreator', guild.id, interaction.user.id) }).catch(() => null);
			return;
		}

		const usernameRaw = interaction.fields.getTextInputValue('tiktok_username');
		const username = normalizeTikTokUsername(usernameRaw);
		const reason = interaction.fields.getTextInputValue('reason')?.trim();
		if (!username || !/^[a-z0-9._]{2,24}$/i.test(username)) {
			await interaction.editReply({ content: await translate('contentCreator.errors.invalidUsername', guild.id, interaction.user.id) });
			return;
		}
		if (!reason) {
			await interaction.editReply({ content: await translate('contentCreator.errors.reasonRequired', guild.id, interaction.user.id) });
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.editReply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id) }).catch(() => null);
			return;
		}
		const botId = botConfig.id;
		const server = await db.getServerByDiscordId(botId, guild.id);
		const applicant = await db.upsertMember(server.id, member);

		const lastApplication = await db.getLastContentCreatorApplication(server.id, applicant.id);
		if (lastApplication?.status === 'pending') {
			await interaction.editReply({ content: await translate('contentCreator.errors.pendingExists', guild.id, interaction.user.id) });
			return;
		}

		const cooldownDays = await CONTENT_CREATOR.getCooldownDays(guild.id);
		if (lastApplication && Number.isFinite(cooldownDays) && cooldownDays && cooldownDays > 0) {
			const lastSubmittedDate = parseMySQLDateTimeUtc(lastApplication.submitted_at);
			if (lastSubmittedDate) {
				const daysPassed = (Date.now() - lastSubmittedDate.getTime()) / (1000 * 60 * 60 * 24);
				if (daysPassed < cooldownDays) {
					await interaction.editReply({
						content: await translate('contentCreator.errors.cooldown', guild.id, interaction.user.id, { days: Math.ceil(cooldownDays - daysPassed) })
					});
					return;
				}
			}
		}

		const conflict = await db.getContentCreatorTiktokConflict(username, interaction.user.id);

		const appId = await db.createContentCreatorApplication(server.id, applicant.id, username, reason);
		const admissionChannelId = await CONTENT_CREATOR.getAdmissionChannel(guild.id);
		const admissionChannel = guild.channels.cache.get(admissionChannelId) || (await guild.channels.fetch(admissionChannelId).catch(() => null));
		let postedChannelId: string | null = null;
		let postedMessageId: string | null = null;
		if (admissionChannel && admissionChannel.isTextBased()) {
			const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
			const embed = new EmbedBuilder()
				.setColor(0xf59e0b)
				.setTitle(t('contentCreator.channelEmbed.pendingTitle', 'en'))
				.setDescription(t('contentCreator.channelEmbed.pendingDescription', 'en', { user: `<@${interaction.user.id}>` }))
				.addFields(
					{ name: t('contentCreator.channelEmbed.fieldTiktok', 'en'), value: `@${username}`, inline: true },
					{ name: t('contentCreator.channelEmbed.fieldStatus', 'en'), value: t('contentCreator.channelEmbed.pendingStatus', 'en'), inline: true },
					{
						name: t('contentCreator.channelEmbed.fieldApplicantReason', 'en'),
						value: truncateReason(reason),
						inline: false
					}
				)
				.setTimestamp();
			if (embedConfig?.FOOTER) {
				embed.setFooter({
					text: `${embedConfig.FOOTER} ${t('contentCreator.channelEmbed.footerAppSuffix', 'en', { appId })}`
				});
			}
			const approveButton = new ButtonBuilder()
				.setCustomId(`content_creator_approve|${appId}`)
				.setLabel(t('contentCreator.channelEmbed.buttonApprove', 'en'))
				.setStyle(ButtonStyle.Success);
			const rejectButton = new ButtonBuilder()
				.setCustomId(`content_creator_reject|${appId}`)
				.setLabel(t('contentCreator.channelEmbed.buttonReject', 'en'))
				.setStyle(ButtonStyle.Danger);
			const pendingRole = await CONTENT_CREATOR.getPendingRole(guild.id);
			const sent = await admissionChannel
				.send({
					content: pendingRole ? `<@&${pendingRole}>` : undefined,
					embeds: [embed],
					components: [new ActionRowBuilder().addComponents(approveButton, rejectButton)]
				})
				.catch(() => null);
			if (sent) {
				postedChannelId = sent.channelId;
				postedMessageId = sent.id;
			}
		}

		if (conflict) {
			setTimeout(() => {
				void runDuplicateContentCreatorAutoReject({
					client: guild.client,
					botId,
					guildId: guild.id,
					channelId: postedChannelId,
					messageId: postedMessageId,
					serverId: server.id,
					appId,
					applicantDiscordId: interaction.user.id,
					username,
					conflict
				});
			}, DUPLICATE_CONTENT_CREATOR_AUTO_REJECT_MS);
		}

		await interaction.editReply({ content: await translate('contentCreator.submitted', guild.id, interaction.user.id, { username: `@${username}` }) });
	} catch (error: any) {
		await logger.log(`❌ Error processing content creator application: ${error.message}`);
		await interaction.editReply({
			content: await translate('contentCreator.errors.submitFailed', interaction.guild.id, interaction.user.id, { error: error.message })
		});
	}
}

const REVIEW_DECISION_REASON_INPUT = 'review_decision_reason';

export async function handleContentCreatorDecisionModal(interaction: any) {
	await interaction.deferReply({ flags: 64 });
	try {
		const guild = interaction.guild;
		const parts = interaction.customId.split('|');
		if (parts.length !== 5 || parts[0] !== 'cc_rev') {
			await interaction.editReply({ content: await translate('contentCreator.errors.submitFailed', guild.id, interaction.user.id, { error: 'Invalid form' }) });
			return;
		}
		const [, decisionRaw, appIdStr, channelId, messageId] = parts;
		if (decisionRaw !== 'approve' && decisionRaw !== 'reject') {
			await interaction.editReply({
				content: await translate('contentCreator.errors.submitFailed', guild.id, interaction.user.id, { error: 'Invalid decision' })
			});
			return;
		}
		const appId = Number(appIdStr);
		if (!Number.isFinite(appId)) {
			await interaction.editReply({ content: '❌ Invalid application ID.' });
			return;
		}

		const reviewReason = interaction.fields.getTextInputValue(REVIEW_DECISION_REASON_INPUT)?.trim();
		if (!reviewReason) {
			await interaction.editReply({ content: await translate('contentCreator.errors.reviewReasonRequired', guild.id, interaction.user.id) });
			return;
		}

		const moderator = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!moderator || !(await hasPermission(moderator, 'setup'))) {
			await interaction.editReply({ content: await translate('contentCreator.errors.permissionDenied', guild.id, interaction.user.id) });
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.editReply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id) }).catch(() => null);
			return;
		}
		const botId = botConfig.id;
		const server = await db.getServerByDiscordId(botId, guild.id);
		if (!server) {
			await interaction.editReply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id) }).catch(() => null);
			return;
		}
		const app = await db.getContentCreatorApplicationById(server.id, appId);
		if (!app) {
			await interaction.editReply({ content: '❌ Application not found.' });
			return;
		}

		let sourceMessage: any = null;
		try {
			const ch = await guild.channels.fetch(channelId);
			if (ch && ch.isTextBased()) {
				sourceMessage = await ch.messages.fetch(messageId).catch(() => null);
			}
		} catch (fetchErr: any) {
			await logger.log(`⚠️ Could not fetch content creator application message: ${fetchErr.message}`);
		}

		if (app.status !== 'pending') {
			await interaction.editReply({ content: '⚠️ This application was already processed.' });
			if (sourceMessage) await sourceMessage.edit({ components: [] }).catch(() => null);
			return;
		}

		const reviewer = await db.upsertMember(server.id, moderator);
		const decision = decisionRaw === 'approve' ? 'approve' : 'reject';
		await db.updateContentCreatorApplicationStatus(app.id, decision === 'approve' ? 'approved' : 'rejected', reviewer.id, reviewReason);

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const applicantUser = await guild.client.users.fetch(app.applicant_discord_id).catch(() => null);
		const staffDecisionLabel = t('contentCreator.embed.staffDecision', 'en');
		const reviewedByLabel = t('contentCreator.embed.reviewedBy', 'en');
		const statusLabel = decision === 'approve' ? t('contentCreator.embed.statusApproved', 'en') : t('contentCreator.embed.statusRejected', 'en');

		if (decision === 'approve') {
			const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id);
			const applicantMember = await guild.members.fetch(app.applicant_discord_id).catch(() => null);
			if (creatorRoleId && applicantMember) {
				await applicantMember.roles.add(creatorRoleId, 'Content creator application approved').catch(() => null);
				await db.markMemberContentCreatorRole(server.id, app.member_id, creatorRoleId).catch(() => null);
			}
			await applicantUser
				?.send({
					content: await translate('contentCreator.dm.approved', guild.id, applicantUser.id, {
						server: guild.name,
						username: `@${app.tiktok_username}`,
						reason: truncateReason(reviewReason)
					})
				})
				.catch(() => null);
			await interaction.editReply({ content: `✅ Application #${app.id} approved.` });
		} else {
			await applicantUser
				?.send({
					content: await translate('contentCreator.dm.rejected', guild.id, applicantUser.id, {
						server: guild.name,
						username: `@${app.tiktok_username}`,
						reason: truncateReason(reviewReason)
					})
				})
				.catch(() => null);
			await interaction.editReply({ content: `❌ Application #${app.id} rejected.` });
		}

		if (sourceMessage) {
			const updatedEmbed = new EmbedBuilder()
				.setColor(decision === 'approve' ? 0x22c55e : 0xef4444)
				.setTitle(decision === 'approve' ? t('contentCreator.channelEmbed.titleApproved', 'en') : t('contentCreator.channelEmbed.titleRejected', 'en'))
				.setDescription(
					t('contentCreator.channelEmbed.descriptionReviewed', 'en', {
						mention: `<@${app.applicant_discord_id}>`,
						tiktok: app.tiktok_username
					})
				)
				.addFields(
					{ name: t('contentCreator.channelEmbed.fieldStatus', 'en'), value: statusLabel, inline: true },
					{ name: reviewedByLabel, value: `<@${interaction.user.id}>`, inline: true },
					{
						name: t('contentCreator.channelEmbed.fieldApplicantReason', 'en'),
						value: truncateReason(app.reason),
						inline: false
					},
					{ name: staffDecisionLabel, value: truncateReason(reviewReason), inline: false }
				)
				.setTimestamp();
			if (embedConfig?.FOOTER) {
				updatedEmbed.setFooter({
					text: `${embedConfig.FOOTER} ${t('contentCreator.channelEmbed.footerAppSuffix', 'en', { appId: app.id })}`
				});
			}
			await sourceMessage.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
		}
	} catch (error: any) {
		await logger.log(`❌ Error handling content creator decision modal: ${error.message}`);
		await interaction.editReply({
			content: await translate('contentCreator.errors.submitFailed', interaction.guild.id, interaction.user.id, { error: error.message })
		});
	}
}

async function showContentCreatorReviewModal(interaction: any, decision: 'approve' | 'reject') {
	const guild = interaction.guild;
	const [, appIdStr] = interaction.customId.split('|');
	const messageId = interaction.message?.id;
	const channelId = interaction.channelId;
	if (!appIdStr || !messageId || !channelId) {
		await interaction
			.reply({
				content: await translate('contentCreator.errors.submitFailed', guild.id, interaction.user.id, { error: 'Invalid interaction' }),
				flags: 64
			})
			.catch(() => null);
		return;
	}
	const titleKey = decision === 'approve' ? 'contentCreator.reviewModal.titleApprove' : 'contentCreator.reviewModal.titleReject';
	const modal = new ModalBuilder()
		.setCustomId(`cc_rev|${decision}|${appIdStr}|${channelId}|${messageId}`)
		.setTitle(await translate(titleKey, guild.id, interaction.user.id));
	const input = new TextInputBuilder()
		.setCustomId(REVIEW_DECISION_REASON_INPUT)
		.setLabel(await translate('contentCreator.reviewModal.reasonLabel', guild.id, interaction.user.id))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(await translate('contentCreator.reviewModal.reasonPlaceholder', guild.id, interaction.user.id))
		.setRequired(true)
		.setMinLength(2)
		.setMaxLength(1000);
	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
	await interaction.showModal(modal);
}

export async function handleContentCreatorApprove(interaction: any) {
	try {
		await showContentCreatorReviewModal(interaction, 'approve');
	} catch (error: any) {
		await logger.log(`❌ Error opening content creator approve modal: ${error.message}`);
	}
}

export async function handleContentCreatorReject(interaction: any) {
	try {
		await showContentCreatorReviewModal(interaction, 'reject');
	} catch (error: any) {
		await logger.log(`❌ Error opening content creator reject modal: ${error.message}`);
	}
}

export function init(client: any) {
	if (watchInterval) clearInterval(watchInterval);
	watchInterval = setInterval(() => {
		syncLiveWatchers(client).catch(() => null);
	}, 120_000);
	syncLiveWatchers(client).catch(() => null);
}

export default {
	init
};
