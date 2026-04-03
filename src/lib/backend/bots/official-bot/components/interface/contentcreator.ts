import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
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

export async function handleContentCreatorButton(interaction: any) {
	try {
		const member = interaction.member;
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => null);
			return;
		}

		const config = await CONTENT_CREATOR.getConfig(interaction.guild.id);
		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(interaction.guild.id).catch(() => null);
		if (!config?.admission_channel_id || !creatorRoleId) {
			await interaction.reply({ content: await translate('contentCreator.errors.notConfigured', interaction.guild.id, interaction.user.id), flags: 64 });
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
		modal.addComponents(new ActionRowBuilder().addComponents(usernameInput), new ActionRowBuilder().addComponents(reasonInput));
		await interaction.showModal(modal);
	} catch (error: any) {
		await logger.log(`❌ Error opening content creator modal: ${error.message}`);
	}
}

export async function handleContentCreatorModal(interaction: any) {
	await interaction.deferReply({ flags: 64 });
	try {
		const guild = interaction.guild;
		const member = interaction.member;

		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(interaction.guild, 'content_creator', interaction.user.id);
			await interaction.editReply({ content: errorMessage }).catch(() => null);
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
		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
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
		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
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
