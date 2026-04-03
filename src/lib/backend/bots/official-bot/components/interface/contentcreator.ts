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
import { translate } from '../../i18n.js';
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
	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? 0xec4899)
		.setTitle('🔴 Content Creator is LIVE')
		.setDescription(`<@${discordMemberId}> is now live on TikTok!\nhttps://www.tiktok.com/@${tiktokUsername}/live`)
		.setTimestamp();
	if (embedConfig?.FOOTER) embed.setFooter({ text: embedConfig.FOOTER });
	await channel.send({ embeds: [embed] }).catch(() => null);
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

		const appId = await db.createContentCreatorApplication(server.id, applicant.id, username, reason);
		const admissionChannelId = await CONTENT_CREATOR.getAdmissionChannel(guild.id);
		const admissionChannel = guild.channels.cache.get(admissionChannelId) || (await guild.channels.fetch(admissionChannelId).catch(() => null));
		if (admissionChannel && admissionChannel.isTextBased()) {
			const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
			const embed = new EmbedBuilder()
				.setColor(0xf59e0b)
				.setTitle('🕒 Content Creator Application Pending')
				.setDescription(`<@${interaction.user.id}> requested Content Creator access.`)
				.addFields(
					{ name: 'TikTok Username', value: `@${username}`, inline: true },
					{ name: 'Status', value: 'Pending admin approval', inline: true },
					{ name: 'Reason', value: truncateReason(reason), inline: false }
				)
				.setTimestamp();
			if (embedConfig?.FOOTER) embed.setFooter({ text: `${embedConfig.FOOTER} • Application ID: #${appId}` });
			const approveButton = new ButtonBuilder().setCustomId(`content_creator_approve|${appId}`).setLabel('Approve').setStyle(ButtonStyle.Success);
			const rejectButton = new ButtonBuilder().setCustomId(`content_creator_reject|${appId}`).setLabel('Reject').setStyle(ButtonStyle.Danger);
			const pendingRole = await CONTENT_CREATOR.getPendingRole(guild.id);
			await admissionChannel
				.send({
					content: pendingRole ? `<@&${pendingRole}>` : undefined,
					embeds: [embed],
					components: [new ActionRowBuilder().addComponents(approveButton, rejectButton)]
				})
				.catch(() => null);
		}

		await interaction.editReply({ content: await translate('contentCreator.submitted', guild.id, interaction.user.id, { username: `@${username}` }) });
	} catch (error: any) {
		await logger.log(`❌ Error processing content creator application: ${error.message}`);
		await interaction.editReply({
			content: await translate('contentCreator.errors.submitFailed', interaction.guild.id, interaction.user.id, { error: error.message })
		});
	}
}

async function handleContentCreatorDecision(interaction: any, decision: 'approve' | 'reject') {
	await interaction.deferReply({ flags: 64 });
	try {
		const guild = interaction.guild;
		const moderator = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!moderator || !(await hasPermission(moderator, 'setup'))) {
			await interaction.editReply({ content: await translate('contentCreator.errors.permissionDenied', guild.id, interaction.user.id) });
			return;
		}

		const [, appIdRaw] = interaction.customId.split('|');
		const appId = Number(appIdRaw);
		if (!Number.isFinite(appId)) {
			await interaction.editReply({ content: '❌ Invalid application ID.' });
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction.editReply({ content: await translate('contentCreator.errors.notConfigured', guild.id, interaction.user.id) }).catch(() => null);
			return;
		}
		const botId = botConfig.id;
		const server = await db.getServerByDiscordId(botId, guild.id);
		const app = await db.getContentCreatorApplicationById(server.id, appId);
		if (!app) {
			await interaction.editReply({ content: '❌ Application not found.' });
			return;
		}
		if (app.status !== 'pending') {
			await interaction.editReply({ content: '⚠️ This application was already processed.' });
			if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => null);
			return;
		}

		const reviewer = await db.upsertMember(server.id, moderator);
		await db.updateContentCreatorApplicationStatus(app.id, decision === 'approve' ? 'approved' : 'rejected', reviewer.id);

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const applicantUser = await guild.client.users.fetch(app.applicant_discord_id).catch(() => null);

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
						username: `@${app.tiktok_username}`
					})
				})
				.catch(() => null);
			await interaction.editReply({ content: `✅ Application #${app.id} approved.` });
		} else {
			await applicantUser
				?.send({
					content: await translate('contentCreator.dm.rejected', guild.id, applicantUser.id, {
						server: guild.name,
						username: `@${app.tiktok_username}`
					})
				})
				.catch(() => null);
			await interaction.editReply({ content: `❌ Application #${app.id} rejected.` });
		}

		if (interaction.message) {
			const updatedEmbed = new EmbedBuilder()
				.setColor(decision === 'approve' ? 0x22c55e : 0xef4444)
				.setTitle(decision === 'approve' ? '✅ Content Creator Application Approved' : '❌ Content Creator Application Rejected')
				.setDescription(`<@${app.applicant_discord_id}> • TikTok: @${app.tiktok_username}`)
				.addFields(
					{ name: 'Status', value: `${decision === 'approve' ? 'Approved' : 'Rejected'} by <@${interaction.user.id}>` },
					{ name: 'Reason', value: truncateReason(app.reason), inline: false }
				)
				.setTimestamp();
			if (embedConfig?.FOOTER) updatedEmbed.setFooter({ text: `${embedConfig.FOOTER} • Application ID: #${app.id}` });
			await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
		}
	} catch (error: any) {
		await logger.log(`❌ Error handling content creator decision: ${error.message}`);
		await interaction.editReply({
			content: await translate('contentCreator.errors.submitFailed', interaction.guild.id, interaction.user.id, { error: error.message })
		});
	}
}

export async function handleContentCreatorApprove(interaction: any) {
	await handleContentCreatorDecision(interaction, 'approve');
}

export async function handleContentCreatorReject(interaction: any) {
	await handleContentCreatorDecision(interaction, 'reject');
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
