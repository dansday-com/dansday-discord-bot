import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	type ModalActionRowComponentBuilder,
	TextInputBuilder,
	TextInputStyle,
	MessageFlags
} from 'discord.js';
import { CONTENT_CREATOR, getBotConfig, getEmbedConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../../config.js';
import { hasPermission, getPermissionDeniedMessage } from '../permissions.js';
import { CREATOR_CONTENT_HUB_SUFFIX, CREATOR_NOTIFICATIONS_MENU_BUTTON_ID } from '../creatorAlerts.js';
import { memberTranslator, translate, serverTranslator, errorReason, type Translator } from '../../i18n.js';
import db from '../../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../../utils/index.js';
import { menuBackButton } from './menuBack.js';
import { featureAvailable } from './availability.js';
import { sendWithNotifiedMentions } from '../notifiedMentions.js';
import type { Client, Guild, GuildMember, MessageComponentInteraction, ModalSubmitInteraction, MessageActionRowComponentBuilder } from 'discord.js';
import { DAY_MS, SECOND_MS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS, embedFieldText } from '../../../../../discordLimits.js';
import { EMBED_COLORS } from '../embedColors.js';

const COLOR_REJECTED = 0xef4444;
const COLOR_PENDING = 0xf59e0b;
const COLOR_FALLBACK = 0xec4899;
const COLOR_LIVE_ENDED = 0x64748b;
const COLOR_LIVE_ERROR = 0xef4444;
const TIKTOK_USERNAME_MAX_LENGTH = 100;
const APPLICATION_REASON_MAX_LENGTH = 500;
const REVIEW_REASON_MAX_LENGTH = 1000;
const MAX_PENDING_SHOWN = 10;
const MAX_ROSTER_SHOWN = 10;
const REVIEW_ID_PARTS = 5;

type LiveConnection = {
	on(event: string, listener: (data: Record<string, unknown>) => void): unknown;
	connect(): Promise<unknown>;
	disconnect?(): Promise<unknown> | void;
};
type LiveConnectionCtor = new (uniqueId: string, options: Record<string, unknown>) => LiveConnection;
type TikTokLiveModule = {
	TikTokLiveConnection?: LiveConnectionCtor;
	WebcastEvent?: Record<string, string>;
	ControlEvent?: Record<string, string>;
};

const liveWatchers = new Map<string, LiveConnection>();
const liveStatus = new Map<string, boolean>();
type LiveSessionMeta = {
	streamId: number;
	memberId: number;
	tiktokUsername: string;
	discordMemberId: string;
};
const liveSessionMeta = new Map<string, LiveSessionMeta>();
const liveDigest = new Map<string, { chat: number; like: number; gift: number; follow: number; share: number }>();
let watchInterval: NodeJS.Timeout | null = null;
let digestInterval: NodeJS.Timeout | null = null;
let isSyncLiveWatchersInFlight = false;
let tiktokModule: { Ctor: LiveConnectionCtor; WebcastEvent: Record<string, string>; ControlEvent: Record<string, string> } | null = null;
let hasTiktokLoadFailed = false;

function normalizeTikTokUsername(raw: string) {
	return raw.trim().replace(/^@+/, '').toLowerCase();
}

const DUPLICATE_CONTENT_CREATOR_AUTO_REJECT_MS = 500;

const LIVE_WATCHER_RESYNC_MS = 5_000;

type EmbedStyle = Awaited<ReturnType<typeof getEmbedConfig>>;
type ApplicationRow = NonNullable<Awaited<ReturnType<typeof db.getContentCreatorApplicationById>>>;
type Rejection = { key: string; params?: Record<string, unknown> };
type ReviewedApplication = { tr: Translator; embedConfig: EmbedStyle | null; app: ApplicationRow; reviewReason: string; isApproved: boolean; reviewer: string };

async function findReviewMessage(guild: Guild, channelId: string, messageId: string) {
	const ch = await guild.channels.fetch(channelId).catch(() => null);
	return ch?.isTextBased() ? ch.messages.fetch(messageId).catch(() => null) : null;
}

function reviewedApplicationEmbed({ tr, embedConfig, app, reviewReason, isApproved, reviewer }: ReviewedApplication) {
	const embed = new EmbedBuilder()
		.setColor(isApproved ? EMBED_COLORS.approved : COLOR_REJECTED)
		.setTitle(tr(isApproved ? 'contentCreator.channelEmbed.titleApproved' : 'contentCreator.channelEmbed.titleRejected'))
		.setDescription(tr('contentCreator.channelEmbed.descriptionReviewed', { mention: `<@${app.applicant_discord_id}>`, tiktok: app.tiktok_username }))
		.addFields(
			{
				name: tr('contentCreator.channelEmbed.fieldStatus'),
				value: tr(isApproved ? 'contentCreator.embed.statusApproved' : 'contentCreator.embed.statusRejected'),
				inline: true
			},
			{ name: tr('contentCreator.embed.reviewedBy'), value: reviewer, inline: true },
			{ name: tr('contentCreator.channelEmbed.fieldApplicantReason'), value: embedFieldText(app.reason), inline: false },
			{ name: tr('contentCreator.embed.staffDecision'), value: embedFieldText(reviewReason), inline: false }
		)
		.setTimestamp();
	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: `${embedConfig.FOOTER} ${tr('contentCreator.channelEmbed.footerAppSuffix', { appId: app.id })}` });
	}
	return embed;
}

async function runDuplicateContentCreatorAutoReject(opts: {
	client: Client;
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
		if (!guild) {
			return;
		}
		const server = await db.getServerByDiscordId(Number(botId), guildId).catch(() => null);
		if (!server || Number(server.id) !== Number(serverId)) {
			return;
		}

		const app = await db.getContentCreatorApplicationById(server.id, appId);
		if (!app || app.status !== 'pending') {
			return;
		}

		const tr = await serverTranslator(guild.id);
		const systemReason = tr('contentCreator.channelEmbed.autoRejectReviewReason');
		const conflictNote =
			conflict.kind === 'pending' ? tr('contentCreator.channelEmbed.autoRejectConflictPending') : tr('contentCreator.channelEmbed.autoRejectConflictApproved');
		const reviewReasonFull = `${systemReason}\n\n${conflictNote} <@${conflict.discordId}>`;

		await db.updateContentCreatorApplicationStatus(app.id, 'rejected', { reviewReason: reviewReasonFull });

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const applicantUser = await client.users.fetch(applicantDiscordId).catch(() => null);
		if (applicantUser) {
			const applicantReasonDm = await translate('contentCreator.autoRejectApplicantReason', { guildId: guild.id, userId: applicantUser.id });
			await applicantUser
				.send({
					content: await translate(
						'contentCreator.dm.rejected',
						{ guildId: guild.id, userId: applicantUser.id },
						{
							server: guild.name,
							username: `@${username}`,
							reason: embedFieldText(applicantReasonDm)
						}
					)
				})
				.catch(() => null);
		}

		const sourceMessage = channelId && messageId ? await findReviewMessage(guild, channelId, messageId) : null;
		if (sourceMessage) {
			await sourceMessage
				.edit({
					embeds: [
						reviewedApplicationEmbed({
							tr,
							embedConfig,
							app,
							reviewReason: reviewReasonFull,
							isApproved: false,
							reviewer: tr('contentCreator.embed.reviewedBySystem')
						})
					],
					components: []
				})
				.catch(() => null);
		}

		await logger.log(
			`⛔ Content creator duplicate auto-reject: @${username} applicant ${applicantDiscordId} vs ${conflict.discordId} (${conflict.kind}) guild ${guildId} app #${appId}`
		);
	} catch (e) {
		await logger.log(`❌ Content creator duplicate auto-reject failed: ${(e as Error).message}`);
	}
}

function isLive(guildId: string, discordMemberId: string) {
	return liveStatus.get(`${guildId}:${discordMemberId}`) === true;
}

async function showContentCreatorApplyModal(interaction: MessageComponentInteraction<'cached'>) {
	const member = interaction.member || (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

	const config = await CONTENT_CREATOR.getConfig(interaction.guild.id);
	const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(interaction.guild.id).catch(() => null);
	if (!config?.admission_channel_id || !creatorRoleId) {
		await interaction
			.reply({
				content: await translate('contentCreator.errors.notConfigured', { guildId: interaction.guild.id, userId: interaction.user.id }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}

	if (member?.roles?.cache?.has(creatorRoleId)) {
		await interaction
			.reply({
				content: await translate('contentCreator.errors.alreadyCreator', { guildId: interaction.guild.id, userId: interaction.user.id }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId('content_creator_apply')
		.setTitle(await translate('contentCreator.modal.title', { guildId: interaction.guild.id, userId: interaction.user.id }));
	const usernameInput = new TextInputBuilder()
		.setCustomId('tiktok_username')
		.setLabel(await translate('contentCreator.modal.usernameLabel', { guildId: interaction.guild.id, userId: interaction.user.id }))
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(await translate('contentCreator.modal.usernamePlaceholder', { guildId: interaction.guild.id, userId: interaction.user.id }))
		.setRequired(true)
		.setMaxLength(TIKTOK_USERNAME_MAX_LENGTH);
	const reasonInput = new TextInputBuilder()
		.setCustomId('reason')
		.setLabel(await translate('contentCreator.modal.reasonLabel', { guildId: interaction.guild.id, userId: interaction.user.id }))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(await translate('contentCreator.modal.reasonPlaceholder', { guildId: interaction.guild.id, userId: interaction.user.id }))
		.setRequired(true)
		.setMaxLength(APPLICATION_REASON_MAX_LENGTH);
	modal.addComponents(
		new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(usernameInput),
		new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput)
	);
	await interaction.showModal(modal);
}

async function loadTikTokModule() {
	if (tiktokModule || hasTiktokLoadFailed) {
		return tiktokModule;
	}
	try {
		const lib = (await import('tiktok-live-connector')) as unknown as TikTokLiveModule;
		const Ctor = lib.TikTokLiveConnection ?? null;
		if (!Ctor) {
			hasTiktokLoadFailed = true;
			await logger.log('⚠️ TikTok connector unavailable: tiktok-live-connector has no TikTokLiveConnection export');
			return null;
		}
		tiktokModule = {
			Ctor,
			WebcastEvent: lib.WebcastEvent || {},
			ControlEvent: lib.ControlEvent || {}
		};
	} catch (error) {
		hasTiktokLoadFailed = true;
		await logger.log(`⚠️ TikTok connector unavailable: ${(error as Error).message}`);
		return null;
	}
	return tiktokModule;
}

function liveKey(guildId: string, discordMemberId: string) {
	return `${guildId}:${discordMemberId}`;
}

function noteLiveDigest(key: string, field: 'chat' | 'like' | 'gift' | 'follow' | 'share', amount = 1) {
	if (!liveSessionMeta.has(key)) {
		return;
	}
	const cur = liveDigest.get(key) || { chat: 0, like: 0, gift: 0, follow: 0, share: 0 };
	cur[field] += amount;
	liveDigest.set(key, cur);
}

function guessViewerCount(data: Record<string, unknown>): number | null {
	const nested = data.data as { viewerCount?: unknown } | null | undefined;
	const candidates = [data.viewerCount, data.userCount, data.totalUser, data.total, data.memberCount, nested?.viewerCount];
	for (const c of candidates) {
		const n = Number(c);
		if (Number.isFinite(n) && n >= 0) {
			return Math.floor(n);
		}
	}
	return null;
}

async function flushLiveDigest(client: Client, key: string) {
	const meta = liveSessionMeta.get(key);
	if (!meta) {
		liveDigest.delete(key);
		return;
	}
	const d = liveDigest.get(key);
	if (!d || (d.chat === 0 && d.like === 0 && d.gift === 0 && d.follow === 0 && d.share === 0)) {
		return;
	}

	liveDigest.set(key, { chat: 0, like: 0, gift: 0, follow: 0, share: 0 });

	const guildId = key.split(':')[0];
	const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
	if (!guild) {
		return;
	}
	const targetChannelId = await CONTENT_CREATOR.getTargetChannel(guild.id).catch(() => null);
	if (!targetChannelId) {
		return;
	}
	const channel = guild.channels.cache.get(targetChannelId) || (await guild.channels.fetch(targetChannelId).catch(() => null));
	if (!channel || !channel.isTextBased()) {
		return;
	}

	const tr = await serverTranslator(guild.id);
	const parts = [tr('contentCreator.live.digest', { mention: `<@${meta.discordMemberId}>`, tiktok: meta.tiktokUsername, streamId: meta.streamId })];
	if (d.chat) {
		parts.push(`💬 +${d.chat}`);
	}
	if (d.like) {
		parts.push(`❤️ +${d.like}`);
	}
	if (d.gift) {
		parts.push(`🎁 +${d.gift}`);
	}
	if (d.follow) {
		parts.push(`➕ +${d.follow}`);
	}
	if (d.share) {
		parts.push(`🔁 +${d.share}`);
	}
	await channel.send({ content: parts.join(' · ').slice(0, DISCORD_LIMITS.MESSAGE) }).catch(() => null);
}

type StreamEnd = { status: 'ended' | 'error'; errorMessage?: string | null };

async function finalizeLiveStream(client: Client, key: string, { status, errorMessage = null }: StreamEnd) {
	const meta = liveSessionMeta.get(key);
	if (!meta) {
		liveDigest.delete(key);
		return;
	}
	await flushLiveDigest(client, key);
	liveSessionMeta.delete(key);
	liveStatus.set(key, false);
	liveDigest.delete(key);
	const guildId = key.split(':')[0];
	try {
		await db.endContentCreatorStream(meta.streamId, status, errorMessage);
		await db.insertContentCreatorStreamLog(meta.streamId, status === 'ended' ? 'stream_end' : 'stream_error', {
			status,
			errorMessage: errorMessage || undefined
		});
	} catch (e) {
		await logger.log(`❌ finalizeLiveStream DB: ${(e as Error).message}`);
	}
	const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
	if (guild) {
		await broadcastLiveEnd(guild, { discordMemberId: meta.discordMemberId, tiktokUsername: meta.tiktokUsername, streamId: meta.streamId }, status);
	}
}

async function broadcastLiveStart(guild: Guild, { discordMemberId, tiktokUsername, streamId }: LiveStream) {
	const targetChannelId = await CONTENT_CREATOR.getTargetChannel(guild.id).catch(() => null);
	if (!targetChannelId) {
		return;
	}
	const channel = guild.channels.cache.get(targetChannelId) || (await guild.channels.fetch(targetChannelId).catch(() => null));
	if (!channel || !channel.isTextBased()) {
		return;
	}

	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const tr = await serverTranslator(guild.id);
	const mention = `<@${discordMemberId}>`;
	const liveUrl = `https://www.tiktok.com/@${encodeURIComponent(tiktokUsername)}/live`;
	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? COLOR_FALLBACK)
		.setTitle(tr('contentCreator.channelEmbed.liveTitle'))
		.setDescription(tr('contentCreator.channelEmbed.liveDescription', { mention }))
		.setTimestamp();
	const streamFooter = tr('contentCreator.live.streamFooter', { streamId });
	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: `${embedConfig.FOOTER} · ${streamFooter}`.slice(0, DISCORD_LIMITS.EMBED_FOOTER) });
	} else {
		embed.setFooter({ text: streamFooter });
	}
	const watchButton = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(liveUrl).setLabel(tr('contentCreator.channelEmbed.liveWatchButton'));
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchButton);

	await sendWithNotifiedMentions(channel, { embeds: [embed], components: [row] }).catch(() => null);
}

type LiveStream = { discordMemberId: string; tiktokUsername: string; streamId: number };

async function broadcastLiveEnd(guild: Guild, { discordMemberId, tiktokUsername, streamId }: LiveStream, status: 'ended' | 'error') {
	const targetChannelId = await CONTENT_CREATOR.getTargetChannel(guild.id).catch(() => null);
	if (!targetChannelId) {
		return;
	}
	const channel = guild.channels.cache.get(targetChannelId) || (await guild.channels.fetch(targetChannelId).catch(() => null));
	if (!channel || !channel.isTextBased()) {
		return;
	}
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const tr = await serverTranslator(guild.id);
	const mention = `<@${discordMemberId}>`;
	const title = status === 'ended' ? tr('contentCreator.live.endedTitle') : tr('contentCreator.live.errorTitle');
	const embed = new EmbedBuilder()
		.setColor(status === 'ended' ? COLOR_LIVE_ENDED : COLOR_LIVE_ERROR)
		.setTitle(title)
		.setDescription(`${mention} · @${tiktokUsername}\n${tr('contentCreator.live.sessionLine', { streamId })}`)
		.setTimestamp();
	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: embedConfig.FOOTER });
	}
	await channel.send({ embeds: [embed] }).catch(() => null);
}

async function handleStreamTikTokEvent(key: string, eventType: string, data: Record<string, unknown>) {
	const guildIdFromKey = key.split(':')[0];
	if (guildIdFromKey && !(await isComponentFeatureEnabled(guildIdFromKey, serverSettingsComponent.content_creator))) {
		return;
	}
	const meta = liveSessionMeta.get(key);
	if (!meta) {
		return;
	}
	try {
		await db.insertContentCreatorStreamLog(meta.streamId, eventType, data);
	} catch (e) {
		await logger.log(`⚠️ stream log: ${(e as Error).message}`);
	}
	try {
		if (eventType === 'chat') {
			await db.incrementContentCreatorStreamCounters(meta.streamId, { chat: 1 });
			noteLiveDigest(key, 'chat');
		} else if (eventType === 'like') {
			const inc = Math.max(1, Math.floor(Number(data?.likeCount) || Number(data?.count) || 1));
			await db.incrementContentCreatorStreamCounters(meta.streamId, { like: inc });
			noteLiveDigest(key, 'like', inc);
		} else if (eventType === 'gift') {
			const inc = Math.max(1, Math.floor(Number(data?.repeatCount) || Number(data?.comboCount) || 1));
			await db.incrementContentCreatorStreamCounters(meta.streamId, { gift: inc });
			noteLiveDigest(key, 'gift', inc);
		} else if (eventType === 'follow') {
			await db.incrementContentCreatorStreamCounters(meta.streamId, { follow: 1 });
			noteLiveDigest(key, 'follow');
		} else if (eventType === 'share') {
			await db.incrementContentCreatorStreamCounters(meta.streamId, { share: 1 });
			noteLiveDigest(key, 'share');
		}
	} catch (e) {
		await logger.log(`⚠️ stream counters: ${(e as Error).message}`);
	}
	if (eventType === 'roomUser') {
		const pv = guessViewerCount(data);
		if (pv != null) {
			await db.updateContentCreatorStreamPeakViewers(meta.streamId, pv).catch(() => null);
		}
	}
}

async function dropLiveWatcher(client: Client, key: string, conn: LiveConnection) {
	if (liveSessionMeta.has(key)) {
		await finalizeLiveStream(client, key, { status: 'ended' });
	}
	try {
		await conn.disconnect?.();
	} catch (_) {}
	liveWatchers.delete(key);
	liveStatus.delete(key);
	liveDigest.delete(key);
}

async function teardownContentCreatorLiveForGuild(client: Client, guildId: string) {
	const prefix = `${guildId}:`;
	for (const [key, conn] of [...liveWatchers.entries()]) {
		if (key.startsWith(prefix)) {
			await dropLiveWatcher(client, key, conn);
		}
	}
}

type TikTokModBundle = NonNullable<Awaited<ReturnType<typeof loadTikTokModule>>>;
type ApprovedCreator = Awaited<ReturnType<typeof db.getApprovedContentCreators>>[number];
type CreatorWatch = { key: string; creator: ApprovedCreator; username: string };

const STREAM_EVENTS: [string, string][] = [
	['CHAT', 'chat'],
	['LIKE', 'like'],
	['GIFT', 'gift'],
	['FOLLOW', 'follow'],
	['SHARE', 'share'],
	['ROOM_USER', 'roomUser'],
	['MEMBER', 'member'],
	['SOCIAL', 'social'],
	['QUESTION_NEW', 'questionNew'],
	['LIVE_INTRO', 'liveIntro']
];

async function onLiveConnected(guild: Guild, { key, creator, username }: CreatorWatch, state: Record<string, unknown>) {
	if (liveSessionMeta.has(key)) {
		return;
	}
	try {
		const roomId = state?.roomId != null ? String(state.roomId) : null;
		const streamId = await db.createContentCreatorStream(Number(creator.member_id), roomId);
		await db.insertContentCreatorStreamLog(streamId, 'connected', { roomId: state?.roomId, isConnected: state?.isConnected });
		liveSessionMeta.set(key, { streamId, memberId: Number(creator.member_id), tiktokUsername: username, discordMemberId: String(creator.discord_member_id) });
		liveDigest.set(key, { chat: 0, like: 0, gift: 0, follow: 0, share: 0 });
		liveStatus.set(key, true);
		await broadcastLiveStart(guild, { discordMemberId: String(creator.discord_member_id), tiktokUsername: username, streamId });
	} catch (e) {
		await logger.log(`❌ TikTok CONNECTED: ${(e as Error).message}`);
	}
}

async function watchCreator(guild: Guild, mod: TikTokModBundle, watch: CreatorWatch) {
	const { key } = watch;
	const { client } = guild;
	try {
		const conn = new mod.Ctor(watch.username, { processInitialData: false });
		conn.on(mod.ControlEvent.CONNECTED || 'connected', (state) => onLiveConnected(guild, watch, state));
		conn.on(mod.WebcastEvent.STREAM_END || 'streamEnd', () => finalizeLiveStream(client, key, { status: 'ended' }));
		conn.on(mod.ControlEvent.DISCONNECTED || 'disconnected', async () => {
			liveWatchers.delete(key);
			await finalizeLiveStream(client, key, { status: 'ended' });
		});
		for (const [webcastKey, eventType] of STREAM_EVENTS) {
			conn.on(mod.WebcastEvent[webcastKey] || eventType, (data) => {
				handleStreamTikTokEvent(key, eventType, data);
			});
		}

		try {
			await conn.connect();
			liveWatchers.set(key, conn);
		} catch {
			try {
				await conn.disconnect?.();
			} catch (_) {}
		}
	} catch (_) {}
}

async function syncLiveWatchersForGuild(client: Client, guild: Guild, mod: TikTokModBundle) {
	const botConfig = getBotConfig();
	if (!botConfig) {
		return;
	}
	const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
	if (!server) {
		return;
	}
	const creators = await db.getApprovedContentCreators(server.id).catch(() => []);
	const activeKeys = new Set<string>();

	for (const creator of creators) {
		const username = normalizeTikTokUsername(creator.tiktok_username || '');
		if (!username || !creator.discord_member_id) {
			continue;
		}
		const key = liveKey(guild.id, String(creator.discord_member_id));
		activeKeys.add(key);
		if (!liveWatchers.has(key)) {
			await watchCreator(guild, mod, { key, creator, username });
		}
	}

	for (const [key, conn] of liveWatchers.entries()) {
		if (key.startsWith(`${guild.id}:`) && !activeKeys.has(key)) {
			await dropLiveWatcher(client, key, conn);
		}
	}
}

async function syncLiveWatchers(client: Client) {
	if (isSyncLiveWatchersInFlight) {
		return;
	}
	isSyncLiveWatchersInFlight = true;
	try {
		for (const guild of client.guilds.cache.values()) {
			if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.content_creator))) {
				await teardownContentCreatorLiveForGuild(client, guild.id);
			}
		}

		const mod = await loadTikTokModule();
		if (!mod) {
			return;
		}

		for (const guild of client.guilds.cache.values()) {
			if (!(await isComponentFeatureEnabled(guild.id, serverSettingsComponent.content_creator))) {
				continue;
			}
			await syncLiveWatchersForGuild(client, guild, mod);
		}
	} finally {
		isSyncLiveWatchersInFlight = false;
	}
}

export async function stopContentCreatorRuntime(client: Client, guildDiscordId: string) {
	if (!client || !guildDiscordId) {
		return;
	}
	await teardownContentCreatorLiveForGuild(client, guildDiscordId);
	await logger.log(`🔇 Content creator module off: TikTok live watchers stopped for guild ${guildDiscordId}`);
}

export async function startContentCreatorRuntime(client: Client, guildDiscordId: string) {
	if (!client || !guildDiscordId) {
		return;
	}
	if (isSyncLiveWatchersInFlight) {
		await logger.log(`⏳ Content creator sync skipped (watcher sync already running) for guild ${guildDiscordId}`);
		return;
	}
	const guild = client.guilds.cache.get(guildDiscordId) || (await client.guilds.fetch(guildDiscordId).catch(() => null));
	if (!guild) {
		return;
	}
	isSyncLiveWatchersInFlight = true;
	try {
		const mod = await loadTikTokModule();
		if (!mod) {
			return;
		}
		if (!(await isComponentFeatureEnabled(guildDiscordId, serverSettingsComponent.content_creator))) {
			return;
		}
		await syncLiveWatchersForGuild(client, guild, mod);
		await logger.log(`📥 Content creator module on: TikTok live watchers synced for guild ${guildDiscordId}`);
	} finally {
		isSyncLiveWatchersInFlight = false;
	}
}

type ContentCreatorListOptions = { bannerNote?: string };

type ListViewer = { actingMember: GuildMember | null; localeUserId: string };

async function buildContentCreatorListView(guild: Guild, { actingMember, localeUserId }: ListViewer, options: ContentCreatorListOptions = {}) {
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
	const isAlreadyCreator = creatorRoleId ? actingMember?.roles?.cache?.has(creatorRoleId) : false;

	const botConfig = getBotConfig();
	if (!botConfig) {
		return { error: 'notConfigured' as const };
	}

	const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
	if (!server) {
		return { error: 'notConfigured' as const };
	}

	const dbMember = actingMember ? await db.upsertMember(server.id, actingMember).catch(() => null) : null;
	const lastApplication = dbMember ? await db.getLastContentCreatorApplication(server.id, dbMember.id).catch(() => null) : null;

	const pending = await db.getPendingContentCreatorApplications(server.id).catch(() => []);
	const pendingLines = pending.slice(0, MAX_PENDING_SHOWN).map((p) => {
		const submitted = parseMySQLDateTimeUtc(p.submitted_at);
		const when = submitted ? ` • <t:${Math.floor(submitted.getTime() / SECOND_MS)}:R>` : '';
		return `🕒 <@${p.discord_member_id}> — **@${normalizeTikTokUsername(String(p.tiktok_username || ''))}**${when}`;
	});
	const pendingTitle = await translate('contentCreator.channelEmbed.pendingStatus', { guildId: guild.id, userId: localeUserId });
	const pendingText = pendingLines.length > 0 ? `**${pendingTitle}**\n${pendingLines.join('\n')}` : `**${pendingTitle}**\n—`;

	const embed = new EmbedBuilder()
		.setColor(embedConfig?.COLOR ?? COLOR_FALLBACK)
		.setTitle(await translate('contentCreator.modal.title', { guildId: guild.id, userId: localeUserId }))
		.setDescription(options.bannerNote ? `${options.bannerNote}\n\n${pendingText}` : pendingText)
		.setTimestamp();
	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: embedConfig.FOOTER });
	}

	const row = new ActionRowBuilder<ButtonBuilder>();
	row.addComponents(await menuBackButton(guild.id, localeUserId, 'perks'));

	const canApply = !isAlreadyCreator && lastApplication?.status !== 'pending';
	if (canApply) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_apply_open')
				.setLabel(await translate('contentCreator.list.applyButton', { guildId: guild.id, userId: localeUserId }))
				.setStyle(ButtonStyle.Primary)
		);
	}

	if (isAlreadyCreator && creatorRoleId) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_request')
				.setLabel(await translate('contentCreator.dismiss.button', { guildId: guild.id, userId: localeUserId }))
				.setStyle(ButtonStyle.Danger)
		);
	}

	return { embed, components: [row] };
}

async function buildContentCreatorRoster(guild: Guild, localeUserId: string): Promise<string> {
	const botConfig = getBotConfig();
	const server = botConfig ? await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null) : null;
	const creators = server ? await db.getApprovedContentCreators(server.id).catch(() => []) : [];

	type ListRow = { live: boolean; username: string; line: string };
	const rows: ListRow[] = [];
	for (const c of creators) {
		const discordId = String(c.discord_member_id || '');
		const username = normalizeTikTokUsername(String(c.tiktok_username || ''));
		if (!discordId || !username) {
			continue;
		}
		const isStreamLive = isLive(guild.id, discordId);
		rows.push({
			live: isStreamLive,
			username,
			line: `${isStreamLive ? '🔴' : '⚫'} <@${discordId}> — **@${username}**\nhttps://www.tiktok.com/@${username}`
		});
	}
	rows.sort((a, b) => {
		if (a.live !== b.live) {
			return a.live ? -1 : 1;
		}
		return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
	});
	const lines = rows.slice(0, MAX_ROSTER_SHOWN).map((r) => r.line);

	const desc = await translate('contentCreator.list.description', { guildId: guild.id, userId: localeUserId });
	const creatorListText = lines.length > 0 ? lines.join('\n\n') : await translate('contentCreator.list.none', { guildId: guild.id, userId: localeUserId });
	return `${desc}\n\n${creatorListText}`;
}

export async function handleContentCreatorHubButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const guildId = interaction.guild.id;
		const userId = interaction.user.id;
		if (!(await featureAvailable(guildId, serverSettingsComponent.content_creator))) {
			await interaction
				.reply({ content: await translate('common.errors.featureDisabled', { guildId, userId }), flags: MessageFlags.Ephemeral })
				.catch(() => null);
			return;
		}
		const embedConfig = await getEmbedConfig(guildId).catch(() => null);
		const embed = new EmbedBuilder()
			.setColor(embedConfig?.COLOR ?? COLOR_FALLBACK)
			.setTitle(await translate('contentCreator.list.title', { guildId, userId }))
			.setDescription(await buildContentCreatorRoster(interaction.guild, userId))
			.setTimestamp();
		if (embedConfig?.FOOTER) {
			embed.setFooter({ text: embedConfig.FOOTER });
		}

		const buttons = [
			new ButtonBuilder()
				.setCustomId('content_creator_list')
				.setLabel(await translate('contentCreator.modal.title', { guildId, userId }))
				.setStyle(ButtonStyle.Secondary)
		];
		if (await featureAvailable(guildId, serverSettingsComponent.creator_alerts)) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`${CREATOR_NOTIFICATIONS_MENU_BUTTON_ID}${CREATOR_CONTENT_HUB_SUFFIX}`)
					.setLabel(await translate('notifications.hub.creators', { guildId, userId }))
					.setStyle(ButtonStyle.Secondary)
			);
		}
		const rows = [
			new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
			new ActionRowBuilder<ButtonBuilder>().addComponents(await menuBackButton(guildId, userId, 'perks'))
		];

		const payload = { embeds: [embed], components: rows };
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload).catch(() => null);
		} else {
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
		}
	} catch (error) {
		await logger.log(`❌ Error opening content creator hub: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { guild } = interaction;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));

		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const built = await buildContentCreatorListView(guild, { actingMember: member, localeUserId: interaction.user.id });
		if ('error' in built) {
			await interaction
				.reply({
					content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
					flags: MessageFlags.Ephemeral
				})
				.catch(() => null);
			return;
		}

		const payload = { embeds: [built.embed], components: built.components };
		if (interaction.replied || interaction.deferred) {
			await interaction.editReply(payload).catch(() => null);
		} else {
			await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
		}
	} catch (error) {
		await logger.log(`❌ Error opening content creator view: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorDismissRequest(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { guild } = interaction;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}
		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (!creatorRoleId || !member?.roles?.cache?.has(creatorRoleId)) {
			const built = await buildContentCreatorListView(guild, { actingMember: member, localeUserId: interaction.user.id });
			if ('error' in built) {
				await interaction
					.reply({
						content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
						flags: MessageFlags.Ephemeral
					})
					.catch(() => null);
				return;
			}
			await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
			return;
		}

		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const confirmEmbed = new EmbedBuilder()
			.setColor(embedConfig?.COLOR ?? COLOR_FALLBACK)
			.setTitle(await translate('contentCreator.dismiss.confirmTitle', { guildId: guild.id, userId: interaction.user.id }))
			.setDescription(await translate('contentCreator.dismiss.confirmDescription', { guildId: guild.id, userId: interaction.user.id }))
			.setTimestamp();
		if (embedConfig?.FOOTER) {
			confirmEmbed.setFooter({ text: embedConfig.FOOTER });
		}

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_yes')
				.setLabel(await translate('contentCreator.dismiss.yes', { guildId: guild.id, userId: interaction.user.id }))
				.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId('content_creator_dismiss_no')
				.setLabel(await translate('contentCreator.dismiss.no', { guildId: guild.id, userId: interaction.user.id }))
				.setStyle(ButtonStyle.Secondary)
		);

		await interaction.update({ embeds: [confirmEmbed], components: [row] }).catch(() => null);
	} catch (error) {
		await logger.log(`❌ Content creator dismiss request error: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorDismissNo(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { guild } = interaction;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}
		const built = await buildContentCreatorListView(guild, { actingMember: member, localeUserId: interaction.user.id });
		if ('error' in built) {
			await interaction
				.update({
					content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
					embeds: [],
					components: []
				})
				.catch(() => null);
			return;
		}
		await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
	} catch (error) {
		await logger.log(`❌ Content creator dismiss cancel error: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorDismissYes(interaction: MessageComponentInteraction<'cached'>) {
	try {
		const { guild } = interaction;
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!(await hasPermission(member, 'content_creator'))) {
			const errorMessage = await getPermissionDeniedMessage(guild, 'content_creator', interaction.user.id);
			await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
			return;
		}

		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (!creatorRoleId || !member?.roles?.cache?.has(creatorRoleId)) {
			const built = await buildContentCreatorListView(guild, { actingMember: member, localeUserId: interaction.user.id });
			if ('error' in built) {
				await interaction
					.update({
						content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
						embeds: [],
						components: []
					})
					.catch(() => null);
				return;
			}
			await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await interaction
				.update({
					content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
					embeds: [],
					components: []
				})
				.catch(() => null);
			return;
		}
		const server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
		if (!server) {
			await interaction
				.update({
					content: await translate('contentCreator.errors.notConfigured', { guildId: guild.id, userId: interaction.user.id }),
					embeds: [],
					components: []
				})
				.catch(() => null);
			return;
		}

		const dbMember = await db.upsertMember(server.id, member).catch(() => null);
		await member.roles.remove(creatorRoleId, 'Content creator dismissed by user').catch(() => null);
		if (dbMember) {
			const roleIdsAfter = Array.from(member.roles.cache.keys()).filter((id: string) => id !== guild.id);
			await db.clearMemberContentCreatorRole(server.id, dbMember.id, roleIdsAfter).catch(() => null);
		}
		syncLiveWatchers(guild.client).catch(() => null);

		const refreshedMember = await guild.members.fetch(interaction.user.id).catch(() => member);
		const bannerNote = await translate('contentCreator.dismiss.removed', { guildId: guild.id, userId: interaction.user.id });
		const built = await buildContentCreatorListView(guild, { actingMember: refreshedMember, localeUserId: interaction.user.id }, { bannerNote });
		if ('error' in built) {
			await interaction.update({ content: bannerNote, embeds: [], components: [] }).catch(() => null);
			return;
		}
		await interaction.update({ embeds: [built.embed], components: built.components }).catch(() => null);
	} catch (error) {
		await logger.log(`❌ Content creator dismiss confirm error: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorApplyButton(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showContentCreatorApplyModal(interaction);
	} catch (error) {
		await logger.log(`❌ Error opening content creator apply modal: ${(error as Error).message}`);
	}
}

type Application = { username: string; reason: string };
type PostedApplication = { channelId: string | null; messageId: string | null };

function readApplication(fields: ModalSubmitInteraction['fields']): { value: Application } | { rejection: Rejection } {
	const username = normalizeTikTokUsername(fields.getTextInputValue('tiktok_username'));
	const reason = fields.getTextInputValue('reason')?.trim();
	if (!username || !/^[a-z0-9._]{2,24}$/i.test(username)) {
		return { rejection: { key: 'contentCreator.errors.invalidUsername' } };
	}
	if (!reason) {
		return { rejection: { key: 'contentCreator.errors.reasonRequired' } };
	}
	return { value: { username, reason } };
}

async function applicationRejection(
	guildId: string,
	lastApplication: Awaited<ReturnType<typeof db.getLastContentCreatorApplication>>
): Promise<Rejection | null> {
	if (lastApplication?.status === 'pending') {
		return { key: 'contentCreator.errors.pendingExists' };
	}
	const cooldownDays = await CONTENT_CREATOR.getCooldownDays(guildId);
	const lastSubmittedDate = lastApplication ? parseMySQLDateTimeUtc(lastApplication.submitted_at) : null;
	if (!lastSubmittedDate || !Number.isFinite(cooldownDays) || !cooldownDays || cooldownDays <= 0) {
		return null;
	}
	const daysPassed = (Date.now() - lastSubmittedDate.getTime()) / DAY_MS;
	return daysPassed < cooldownDays ? { key: 'contentCreator.errors.cooldown', params: { days: Math.ceil(cooldownDays - daysPassed) } } : null;
}

async function postApplicationForReview(
	guild: Guild,
	{ appId, application, applicantId }: { appId: number; application: Application; applicantId: string }
): Promise<PostedApplication> {
	const admissionChannelId = await CONTENT_CREATOR.getAdmissionChannel(guild.id);
	const admissionChannel = guild.channels.cache.get(admissionChannelId) || (await guild.channels.fetch(admissionChannelId).catch(() => null));
	if (!admissionChannel || !admissionChannel.isTextBased()) {
		return { channelId: null, messageId: null };
	}
	const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
	const tr = await serverTranslator(guild.id);
	const embed = new EmbedBuilder()
		.setColor(COLOR_PENDING)
		.setTitle(tr('contentCreator.channelEmbed.pendingTitle'))
		.setDescription(tr('contentCreator.channelEmbed.pendingDescription', { user: `<@${applicantId}>` }))
		.addFields(
			{ name: tr('contentCreator.channelEmbed.fieldTiktok'), value: `@${application.username}`, inline: true },
			{ name: tr('contentCreator.channelEmbed.fieldStatus'), value: tr('contentCreator.channelEmbed.pendingStatus'), inline: true },
			{ name: tr('contentCreator.channelEmbed.fieldApplicantReason'), value: embedFieldText(application.reason), inline: false }
		)
		.setTimestamp();
	if (embedConfig?.FOOTER) {
		embed.setFooter({ text: `${embedConfig.FOOTER} ${tr('contentCreator.channelEmbed.footerAppSuffix', { appId })}` });
	}
	const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder().setCustomId(`content_creator_approve|${appId}`).setLabel(tr('contentCreator.channelEmbed.buttonApprove')).setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId(`content_creator_reject|${appId}`).setLabel(tr('contentCreator.channelEmbed.buttonReject')).setStyle(ButtonStyle.Danger)
	);
	const pendingRole = await CONTENT_CREATOR.getPendingRole(guild.id);
	const sent = await admissionChannel
		.send({ content: pendingRole ? `<@&${pendingRole}>` : undefined, embeds: [embed], components: [buttons] })
		.catch(() => null);
	return sent ? { channelId: sent.channelId, messageId: sent.id } : { channelId: null, messageId: null };
}

export async function handleContentCreatorModal(interaction: ModalSubmitInteraction<'cached'>) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		const { guild } = interaction;
		const mtr = await memberTranslator(guild.id, interaction.user.id);
		const reply = ({ key, params }: Rejection) => interaction.editReply({ content: mtr(key, params) }).catch(() => null);
		const member = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));

		const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id).catch(() => null);
		if (creatorRoleId && member?.roles?.cache?.has(creatorRoleId)) {
			await reply({ key: 'contentCreator.errors.alreadyCreator' });
			return;
		}

		const application = readApplication(interaction.fields);
		if ('rejection' in application) {
			await reply(application.rejection);
			return;
		}

		const botConfig = getBotConfig();
		if (!botConfig) {
			await reply({ key: 'contentCreator.errors.notConfigured' });
			return;
		}
		const server = await db.getServerByDiscordId(botConfig.id, guild.id);
		const applicant = await db.upsertMember(server.id, member);
		const rejected = await applicationRejection(guild.id, await db.getLastContentCreatorApplication(server.id, applicant.id));
		if (rejected) {
			await reply(rejected);
			return;
		}

		const { username, reason } = application.value;
		const conflict = await db.getContentCreatorTiktokConflict(username, interaction.user.id);
		const appId = await db.createContentCreatorApplication(server.id, { memberId: applicant.id, tiktokUsername: username, reason });
		const posted = await postApplicationForReview(guild, { appId, application: application.value, applicantId: interaction.user.id });

		if (conflict) {
			setTimeout(() => {
				runDuplicateContentCreatorAutoReject({
					client: guild.client,
					botId: botConfig.id,
					guildId: guild.id,
					channelId: posted.channelId,
					messageId: posted.messageId,
					serverId: server.id,
					appId,
					applicantDiscordId: interaction.user.id,
					username,
					conflict
				});
			}, DUPLICATE_CONTENT_CREATOR_AUTO_REJECT_MS);
		}

		await reply({ key: 'contentCreator.submitted', params: { username: `@${username}` } });
	} catch (error) {
		await logger.log(`❌ Error processing content creator application: ${(error as Error).message}`);
		await interaction.editReply({
			content: await translate(
				'contentCreator.errors.submitFailed',
				{ guildId: interaction.guild.id, userId: interaction.user.id },
				{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
			)
		});
	}
}

const REVIEW_DECISION_REASON_INPUT = 'review_decision_reason';

type CreatorDecision = { isApproved: boolean; appId: number; channelId: string; messageId: string; reviewReason: string };

function readCreatorDecision(interaction: ModalSubmitInteraction<'cached'>): { value: CreatorDecision } | { rejection: Rejection } {
	const parts = interaction.customId.split('|');
	const invalid = (error: string) => ({ rejection: { key: 'contentCreator.errors.submitFailed', params: { error } } });
	if (parts.length !== REVIEW_ID_PARTS || parts[0] !== 'cc_rev') {
		return invalid('Invalid form');
	}
	const [, decisionRaw, appIdStr, channelId, messageId] = parts;
	if (decisionRaw !== 'approve' && decisionRaw !== 'reject') {
		return invalid('Invalid decision');
	}
	const appId = Number(appIdStr);
	if (!Number.isFinite(appId)) {
		return { rejection: { key: 'contentCreator.review.invalidApplicationId' } };
	}
	const reviewReason = interaction.fields.getTextInputValue(REVIEW_DECISION_REASON_INPUT)?.trim();
	if (!reviewReason) {
		return { rejection: { key: 'contentCreator.errors.reviewReasonRequired' } };
	}
	return { value: { isApproved: decisionRaw === 'approve', appId, channelId, messageId, reviewReason } };
}

async function reviewableApplication(guild: Guild, appId: number): Promise<{ serverId: number; app: ApplicationRow } | { rejection: Rejection }> {
	const botConfig = getBotConfig();
	const server = botConfig ? await db.getServerByDiscordId(botConfig.id, guild.id) : null;
	if (!server) {
		return { rejection: { key: 'contentCreator.errors.notConfigured' } };
	}
	const app = await db.getContentCreatorApplicationById(server.id, appId);
	return app ? { serverId: server.id, app } : { rejection: { key: 'contentCreator.review.applicationNotFound' } };
}

async function grantCreatorRole(guild: Guild, { serverId, app }: { serverId: number; app: ApplicationRow }) {
	const creatorRoleId = await CONTENT_CREATOR.getContentCreatorRole(guild.id);
	const applicantMember = await guild.members.fetch(app.applicant_discord_id).catch(() => null);
	if (creatorRoleId && applicantMember) {
		await applicantMember.roles.add(creatorRoleId, 'Content creator application approved').catch(() => null);
		const roleIds = Array.from(applicantMember.roles.cache.keys()).filter((id: string) => id !== guild.id);
		await db.markMemberContentCreatorRole(serverId, app.member_id, roleIds).catch(() => null);
	}
	syncLiveWatchers(guild.client).catch(() => null);
}

async function dmApplicantDecision(guild: Guild, app: ApplicationRow, { isApproved, reviewReason }: { isApproved: boolean; reviewReason: string }) {
	const applicantUser = await guild.client.users.fetch(app.applicant_discord_id).catch(() => null);
	if (!applicantUser) {
		return;
	}
	const scope = { guildId: guild.id, userId: applicantUser.id };
	const body = await translate(isApproved ? 'contentCreator.dm.approved' : 'contentCreator.dm.rejected', scope, {
		server: guild.name,
		username: `@${app.tiktok_username}`,
		reason: embedFieldText(reviewReason)
	});
	const title = await translate(isApproved ? 'contentCreator.dm.embedTitleApproved' : 'contentCreator.dm.embedTitleRejected', scope, {});
	const embedConfig = await getEmbedConfig(guild.id);
	const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(title).setDescription(body).setTimestamp().setFooter({ text: embedConfig.FOOTER });
	await applicantUser.send({ embeds: [embed] }).catch(() => null);
}

export async function handleContentCreatorDecisionModal(interaction: ModalSubmitInteraction<'cached'>) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	try {
		const { guild } = interaction;
		const mtr = await memberTranslator(guild.id, interaction.user.id);
		const reply = ({ key, params }: Rejection) => interaction.editReply({ content: mtr(key, params) }).catch(() => null);

		const decision = readCreatorDecision(interaction);
		if ('rejection' in decision) {
			await reply(decision.rejection);
			return;
		}

		const moderator = interaction.member || (await guild.members.fetch(interaction.user.id).catch(() => null));
		if (!moderator || !(await hasPermission(moderator, 'setup'))) {
			await reply({ key: 'contentCreator.errors.permissionDenied' });
			return;
		}

		const found = await reviewableApplication(guild, decision.value.appId);
		if ('rejection' in found) {
			await reply(found.rejection);
			return;
		}
		const { serverId, app } = found;
		const sourceMessage = await findReviewMessage(guild, decision.value.channelId, decision.value.messageId);
		if (app.status !== 'pending') {
			await reply({ key: 'contentCreator.review.alreadyProcessed' });
			await sourceMessage?.edit({ components: [] }).catch(() => null);
			return;
		}

		const { isApproved, reviewReason } = decision.value;
		const reviewer = await db.upsertMember(serverId, moderator);
		await db.updateContentCreatorApplicationStatus(app.id, isApproved ? 'approved' : 'rejected', { reviewedByMemberId: reviewer.id, reviewReason });
		if (isApproved) {
			await grantCreatorRole(guild, { serverId, app });
		}
		await dmApplicantDecision(guild, app, { isApproved, reviewReason });
		await reply({ key: isApproved ? 'contentCreator.review.approvedReply' : 'contentCreator.review.rejectedReply', params: { appId: app.id } });

		const tr = await serverTranslator(guild.id);
		const embedConfig = await getEmbedConfig(guild.id).catch(() => null);
		const updatedEmbed = reviewedApplicationEmbed({ tr, embedConfig, app, reviewReason, isApproved, reviewer: `<@${interaction.user.id}>` });
		await sourceMessage?.edit({ embeds: [updatedEmbed], components: [] }).catch(() => null);
	} catch (error) {
		await logger.log(`❌ Error handling content creator decision modal: ${(error as Error).message}`);
		await interaction.editReply({
			content: await translate(
				'contentCreator.errors.submitFailed',
				{ guildId: interaction.guild.id, userId: interaction.user.id },
				{ error: await errorReason(error, interaction.guild.id, interaction.user.id) }
			)
		});
	}
}

async function showContentCreatorReviewModal(interaction: MessageComponentInteraction<'cached'>, decision: 'approve' | 'reject') {
	const { guild } = interaction;
	const [, appIdStr] = interaction.customId.split('|');
	const messageId = interaction.message?.id;
	const { channelId } = interaction;
	if (!appIdStr || !messageId || !channelId) {
		await interaction
			.reply({
				content: await translate('contentCreator.errors.submitFailed', { guildId: guild.id, userId: interaction.user.id }, { error: 'Invalid interaction' }),
				flags: MessageFlags.Ephemeral
			})
			.catch(() => null);
		return;
	}
	const titleKey = decision === 'approve' ? 'contentCreator.reviewModal.titleApprove' : 'contentCreator.reviewModal.titleReject';
	const modal = new ModalBuilder()
		.setCustomId(`cc_rev|${decision}|${appIdStr}|${channelId}|${messageId}`)
		.setTitle(await translate(titleKey, { guildId: guild.id, userId: interaction.user.id }));
	const input = new TextInputBuilder()
		.setCustomId(REVIEW_DECISION_REASON_INPUT)
		.setLabel(await translate('contentCreator.reviewModal.reasonLabel', { guildId: guild.id, userId: interaction.user.id }))
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(await translate('contentCreator.reviewModal.reasonPlaceholder', { guildId: guild.id, userId: interaction.user.id }))
		.setRequired(true)
		.setMinLength(2)
		.setMaxLength(REVIEW_REASON_MAX_LENGTH);
	modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
	await interaction.showModal(modal);
}

export async function handleContentCreatorApprove(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showContentCreatorReviewModal(interaction, 'approve');
	} catch (error) {
		await logger.log(`❌ Error opening content creator approve modal: ${(error as Error).message}`);
	}
}

export async function handleContentCreatorReject(interaction: MessageComponentInteraction<'cached'>) {
	try {
		await showContentCreatorReviewModal(interaction, 'reject');
	} catch (error) {
		await logger.log(`❌ Error opening content creator reject modal: ${(error as Error).message}`);
	}
}

export function init(client: Client) {
	if (watchInterval) {
		clearInterval(watchInterval);
	}
	if (digestInterval) {
		clearInterval(digestInterval);
	}
	watchInterval = setInterval(() => {
		syncLiveWatchers(client).catch(() => null);
	}, LIVE_WATCHER_RESYNC_MS);
	digestInterval = setInterval(() => {
		for (const k of [...liveSessionMeta.keys()]) {
			flushLiveDigest(client, k).catch(() => null);
		}
	}, LIVE_WATCHER_RESYNC_MS);
	syncLiveWatchers(client).catch(() => null);
}

export default {
	init
};
