import { COMMUNICATION, getEmbedConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, RateLimitError } from 'discord.js';
import { logger, attemptSync } from '../../../../utils/index.js';
import db from '../../../../database.js';
import type { Client, Guild, GuildMember } from 'discord.js';
import type { ForwardedMessage } from '../../../../forwarder-settings.js';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import { HTTP } from '../../../../http.js';
import { SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';

let webhookServer: Server | null = null;
let currentBotId: number | null = null;

const FORWARD_MAX_CONCURRENT = 4;
const FORWARD_QUEUE_MAX = 500;
const FORWARD_DROP_LOG_EVERY = 25;
const SLOW_FORWARD_SECONDS = 5;
const IPV4_MAPPED_PREFIX = '::ffff:';
const forwardQueue: { messageData: ForwardedMessage; deliveryClient: Client; queuedAt: number }[] = [];
let forwardActive = 0;
let forwardDropped = 0;

function enqueueForwardDelivery(messageData: ForwardedMessage, deliveryClient: Client) {
	if (forwardQueue.length >= FORWARD_QUEUE_MAX) {
		forwardQueue.shift();
		forwardDropped++;
		if (forwardDropped % FORWARD_DROP_LOG_EVERY === 1) {
			logger.log(`🚨 Forward queue full (${FORWARD_QUEUE_MAX}), dropping oldest message(s); ${forwardDropped} dropped so far`);
		}
	}

	forwardQueue.push({ messageData, deliveryClient, queuedAt: Date.now() });
	drainForwardQueue();
}

function drainForwardQueue() {
	while (forwardActive < FORWARD_MAX_CONCURRENT && forwardQueue.length > 0) {
		const job = forwardQueue.shift()!;
		forwardActive++;

		(async () => {
			const waited = Date.now() - job.queuedAt;
			if (waited > SLOW_FORWARD_SECONDS * SECOND_MS) {
				await logger.log(`🐌 Forward of message ${job.messageData.id} waited ${waited}ms in the queue (depth ${forwardQueue.length})`);
			}
			const { processMessageFromSelfBot } = await import('./forwarder.js');
			await processMessageFromSelfBot(job.messageData, job.deliveryClient);
		})()
			.catch((err) => logger.log(`❌ Failed to process forwarded message ${job.messageData?.id}: ${err?.message || err}`))
			.finally(() => {
				forwardActive--;
				drainForwardQueue();
			});
	}
}

function getClientIp(req: IncomingMessage) {
	const address = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
	return address.startsWith(IPV4_MAPPED_PREFIX) ? address.slice(IPV4_MAPPED_PREFIX.length) : address || 'unknown';
}

function botProfileErrorMessage(err: unknown) {
	if (err instanceof RateLimitError) {
		return `Discord is rate limiting profile changes. Try again in ${Math.max(1, Math.ceil(err.retryAfter / SECOND_MS))}s.`;
	}
	return (err as Error | null)?.message || 'Unknown error';
}

type WebhookReply = { status: number; body: unknown };
type WebhookAction = { run: (client: Client<true>, payload: unknown) => Promise<WebhookReply>; failure?: (details: string) => unknown };
type OkResult = { ok: boolean };

const SUCCESS: WebhookReply = { status: HTTP.OK, body: { success: true } };

function respond(res: ServerResponse, { status, body }: WebhookReply) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(body));
}

function trimmedText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function textOr(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function httpUrl(value: unknown): string | null {
	return typeof value === 'string' && value.startsWith('http') ? value : null;
}

async function requireGuild(client: Client<true>, guildId: string): Promise<Guild> {
	const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
	if (!guild) {
		throw new Error('Guild not found');
	}
	return guild;
}

async function invalidPayload(payload: unknown): Promise<WebhookReply> {
	await logger.log(`❌ Invalid payload format: ${JSON.stringify(payload)}`);
	return { status: HTTP.BAD_REQUEST, body: { error: 'Invalid payload format' } };
}

function withPayload<P>(run: (client: Client<true>, payload: P) => Promise<WebhookReply>): WebhookAction {
	return { run: (client, payload) => run(client, payload as P) };
}

function okResult<P>(load: () => Promise<(client: Client<true>, payload: P) => Promise<OkResult>>): WebhookAction {
	return withPayload<P>(async (client, payload) => {
		const handle = await load();
		const result = await handle(client, payload);
		return { status: result.ok ? HTTP.OK : HTTP.BAD_REQUEST, body: result };
	});
}

function plainResult<P>(load: () => Promise<(client: Client<true>, payload: P) => Promise<unknown>>): WebhookAction {
	return withPayload<P>(async (client, payload) => {
		const handle = await load();
		return { status: HTTP.OK, body: await handle(client, payload) };
	});
}

type QuestPayload = {
	guild_id?: string;
	channel_id?: string;
	quest_id?: unknown;
	quest_name?: unknown;
	quest_url?: unknown;
	game_title?: unknown;
	game_subtitle?: unknown;
	quest_task_label?: unknown;
	quest_task_type?: unknown;
	quest_description?: unknown;
	task_detail_line?: unknown;
	reward?: unknown;
	publisher?: unknown;
	starts_at?: unknown;
	expires_at?: unknown;
	thumbnail_url?: unknown;
	banner_url?: unknown;
	test?: unknown;
};

function questFromPayload(payload: QuestPayload) {
	const taskLabel = trimmedText(payload.quest_task_label) || 'Quest';
	return {
		id: String(payload.quest_id || ''),
		questName: String(payload.quest_name),
		gameTitle: textOr(payload.game_title, 'Quest'),
		questUrl: String(payload.quest_url),
		startsAt: textOr(payload.starts_at, ''),
		expiresAt: textOr(payload.expires_at, ''),
		reward: trimmedText(payload.reward) || '• Quest reward',
		taskTypeKey: textOr(payload.quest_task_type, ''),
		taskTypeLabel: taskLabel,
		publisher: textOr(payload.publisher, ''),
		gameSubtitle: textOr(payload.game_subtitle, ''),
		questDescription: trimmedText(payload.quest_description) || trimmedText(payload.task_detail_line) || taskLabel,
		thumbnailUrl: httpUrl(payload.thumbnail_url),
		bannerUrl: httpUrl(payload.banner_url)
	};
}

async function sendQuestNotification(client: Client<true>, payload: QuestPayload): Promise<WebhookReply> {
	const { guild_id: guildId, channel_id: channelId } = payload;
	if (!guildId || !channelId || !payload.quest_name || !payload.quest_url) {
		return { status: HTTP.BAD_REQUEST, body: { error: 'Missing guild_id, channel_id, quest_name, or quest_url' } };
	}
	if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.discord_quest_notifier))) {
		return { status: HTTP.FORBIDDEN, body: { error: 'Quest notifier module is disabled for this server.' } };
	}
	const { sendQuestNotificationMessage } = await import('./questNotifier.js');
	const quest = questFromPayload(payload);
	await logger.log(
		`🖼️ QUEST-EMBED quest=${payload.quest_id} raw_banner=${JSON.stringify(payload.banner_url)} raw_thumb=${JSON.stringify(payload.thumbnail_url)} -> banner=${quest.bannerUrl ?? 'NULL'} thumb=${quest.thumbnailUrl ?? 'NULL'}`
	);
	await sendQuestNotificationMessage(client, { guildId, channelId, quest, opts: { test: payload.test === true } });
	await logger.log(`📥 Quest notification sent → #${channelId} (guild ${guildId})`);
	return SUCCESS;
}

type DmPayload = {
	guild_id?: string;
	user_id?: string;
	content?: unknown;
	embed_title?: unknown;
	embed_description?: unknown;
	link_url?: unknown;
	link_label?: unknown;
};

function dmLinkRows(payload: DmPayload) {
	const linkUrl = trimmedText(payload.link_url);
	if (!/^https?:\/\//i.test(linkUrl)) {
		return [];
	}
	const linkLabel = (trimmedText(payload.link_label) || 'Open link').slice(0, DISCORD_LIMITS.BUTTON_LABEL);
	return [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(linkUrl).setLabel(linkLabel))];
}

async function sendWebhookDm(client: Client<true>, payload: DmPayload): Promise<WebhookReply> {
	const { guild_id: guildId, user_id: userId } = payload;
	const embedDescription = trimmedText(payload.embed_description) || trimmedText(payload.content);
	if (!guildId || !userId || !embedDescription) {
		return { status: HTTP.BAD_REQUEST, body: { error: 'Missing guild_id, user_id, or content/embed_description' } };
	}

	const guild = await requireGuild(client, guildId);
	if (currentBotId && !(await db.getServerByDiscordId(currentBotId, guildId))) {
		throw new Error('Guild not found');
	}

	const user = await client.users.fetch(String(userId)).catch(() => null);
	if (!user) {
		throw new Error('User not found');
	}

	const embedConfig = await getEmbedConfig(guildId);
	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle((trimmedText(payload.embed_title) || guild.name).trim())
		.setDescription(embedDescription)
		.setTimestamp()
		.setFooter({ text: embedConfig.FOOTER });
	const components = dmLinkRows(payload);
	await user.send({ embeds: [embed], ...(components.length ? { components } : {}) });
	await logger.log(`📩 DM sent via webhook to ${user.tag} (${user.id}) for guild ${guildId}`);
	return SUCCESS;
}

type BotProfilePayload = { guild_id?: string; nickname?: unknown; avatar?: string; banner?: string; bio?: string };
type ProfileUrls = { avatar_url: string; banner_url: string };
type ProfileSync = { success: boolean; profile?: ProfileUrls; error?: string };

const PROFILE_KEYS = ['avatar', 'banner', 'bio'] as const;

async function syncBotNickname(me: GuildMember, payload: BotProfilePayload): Promise<string | null> {
	const nickname = trimmedText(payload.nickname) || null;
	if (!('nickname' in payload) || (me.nickname ?? null) === nickname) {
		return null;
	}
	try {
		await me.guild.members.editMe({ nick: nickname });
		await logger.log(`✅ Synced bot nickname for guild ${me.guild.id} to "${nickname ?? ''}"`);
		return null;
	} catch (err) {
		return `Nickname: ${botProfileErrorMessage(err)}`;
	}
}

async function syncBotProfileFields(me: GuildMember, payload: BotProfilePayload): Promise<{ failure: string | null; profile?: ProfileUrls }> {
	const profile: Record<string, string | null> = {};
	for (const key of PROFILE_KEYS) {
		if (key in payload) {
			profile[key] = payload[key] || null;
		}
	}
	if (Object.keys(profile).length === 0) {
		return { failure: null };
	}
	try {
		const updated = await me.guild.members.editMe(profile);
		await logger.log(`✅ Synced bot profile (${Object.keys(profile).join(', ')}) for guild ${me.guild.id}`);
		return { failure: null, profile: { avatar_url: updated.avatarURL({ size: 512 }) ?? '', banner_url: updated.bannerURL({ size: 1024 }) ?? '' } };
	} catch (err) {
		return { failure: `Profile: ${botProfileErrorMessage(err)}` };
	}
}

async function syncBotProfile(client: Client<true>, payload: BotProfilePayload): Promise<WebhookReply> {
	const guildId = payload.guild_id;
	if (!guildId) {
		return { status: HTTP.BAD_REQUEST, body: { error: 'Missing guild_id' } };
	}

	const guild = await requireGuild(client, guildId);
	const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
	if (!me) {
		throw new Error('Bot member not found in guild');
	}

	const nicknameFailure = await syncBotNickname(me, payload);
	const fields = await syncBotProfileFields(me, payload);
	const failures = [nicknameFailure, fields.failure].filter((failure): failure is string => failure !== null);
	const result: ProfileSync = { success: failures.length === 0, ...(fields.profile ? { profile: fields.profile } : {}) };
	if (failures.length > 0) {
		result.error = failures.join(' ');
		await logger.log(`❌ Failed to sync bot profile for guild ${guildId}: ${result.error}`);
	}
	return { status: failures.length > 0 ? HTTP.INTERNAL_ERROR : HTTP.OK, body: result };
}

async function syncComponentRuntime(client: Client<true>, payload: { guild_id?: string; component?: string; enabled?: unknown }): Promise<WebhookReply> {
	const { guild_id: guildId, component } = payload;
	const isEnabled = payload.enabled !== false;
	if (!guildId || !component) {
		return { status: HTTP.BAD_REQUEST, body: { error: 'Missing guild_id or component' } };
	}
	if (component === serverSettingsComponent.leveling) {
		const { startLevelingRuntime, stopLevelingRuntime } = await import('./leveling.js');
		await (isEnabled ? startLevelingRuntime(client, guildId) : stopLevelingRuntime(guildId));
		await logger.log(`📥 sync_component_runtime: leveling ${isEnabled ? 'on' : 'off'} for guild ${guildId}`);
	} else if (component === serverSettingsComponent.content_creator) {
		const { startContentCreatorRuntime, stopContentCreatorRuntime } = await import('./interface/contentcreator.js');
		await (isEnabled ? startContentCreatorRuntime(client, guildId) : stopContentCreatorRuntime(client, guildId));
		await logger.log(`📥 sync_component_runtime: content_creator ${isEnabled ? 'on' : 'off'} for guild ${guildId}`);
	}
	return SUCCESS;
}

async function syncServerMenuFromPanel(client: Client<true>, payload: { guild_id?: string; language?: unknown }): Promise<WebhookReply> {
	const guildId = payload.guild_id;
	if (!guildId) {
		return { status: HTTP.BAD_REQUEST, body: { error: 'Missing guild_id' } };
	}
	const { rememberServerLanguage } = await import('../i18n.js');
	const { syncServerMenu } = await import('./commands/admin/setup.js');
	if (payload.language) {
		rememberServerLanguage(guildId, payload.language);
	}
	syncServerMenu(client, guildId).catch((err) => logger.log(`❌ sync_server_menu failed: ${err.message}`));
	return SUCCESS;
}

async function acceptForward(client: Client<true>, payload: { data?: ForwardedMessage }): Promise<WebhookReply> {
	if (!payload.data) {
		return invalidPayload(payload);
	}
	enqueueForwardDelivery(payload.data, client);
	return { status: HTTP.ACCEPTED, body: { success: true, message: 'Message accepted' } };
}

const toolFailed = () => ({ ok: false, reason: 'tool_failed' });

const WEBHOOK_ACTIONS: Record<string, WebhookAction> = {
	message_forward: withPayload(acceptForward),
	server_message_send: plainResult(async () => (await import('./messages.js')).sendServerMessage),
	server_message_sync: plainResult(async () => (await import('./messages.js')).syncServerMessagePosts),
	server_message_remove_post: plainResult(async () => (await import('./messages.js')).removeServerMessagePost),
	server_message_emojis: plainResult(async () => (await import('./messages.js')).listGuildEmojis),
	global_message_send: plainResult(async () => (await import('./messages.js')).sendGlobalMessage),
	global_message_sync: plainResult(async () => (await import('./messages.js')).syncGlobalMessagePosts),
	global_message_remove_posts: plainResult(async () => (await import('./messages.js')).removeGlobalMessagePosts),
	agent_tools: {
		...plainResult(async () => {
			const { listAgentTools } = await import('./agentTools.js');
			return (_client, payload: Record<string, unknown>) => listAgentTools(payload);
		}),
		failure: toolFailed
	},
	agent_tool: {
		...plainResult(async () => {
			const { runAgentTool } = await import('./agentTools.js');
			return (_client, payload: Record<string, unknown>) => runAgentTool(payload);
		}),
		failure: toolFailed
	},
	send_quest_notification: { ...withPayload(sendQuestNotification), failure: (details) => ({ error: 'Failed to send quest notification', details }) },
	send_dm: { ...withPayload(sendWebhookDm), failure: (details) => ({ error: 'Failed to send DM', details }) },
	sync_bot_profile: { ...withPayload(syncBotProfile), failure: (details) => ({ error: 'Failed to sync bot profile', details }) },
	sync_bot_nickname: { ...withPayload(syncBotProfile), failure: (details) => ({ error: 'Failed to sync bot profile', details }) },
	sync_component_runtime: withPayload(syncComponentRuntime),
	sync_server_menu: withPayload(syncServerMenuFromPanel),
	moderation_action: okResult(async () => (await import('./moderation.js')).performModerationAction),
	moderation_bulk: okResult(async () => (await import('./moderation.js')).startBulkModeration),
	sync_rewards: okResult(async () => {
		const { syncGuildRewards } = await import('./rewards.js');
		return (client, payload: { guild_id: string }) => syncGuildRewards(client, payload.guild_id);
	}),
	use_item: okResult(async () => (await import('./items.js')).handleItemUse),
	claim_login: okResult(async () => (await import('./tasks.js')).handleLoginClaim),
	claim_task: okResult(async () => (await import('./tasks.js')).handleTaskClaim),
	buy_item: okResult(async () => (await import('./items.js')).handleItemBuy),
	discard_item: okResult(async () => (await import('./items.js')).handleItemDiscard),
	minigame_play: okResult(async () => (await import('./minigames.js')).handleMinigamePlay),
	minigame_tower: okResult(async () => (await import('./minigames.js')).handleTowerAction),
	minigame_color: okResult(async () => (await import('./minigames.js')).handleColorAction),
	theme_effect_spin: okResult(async () => (await import('./themeEffects.js')).handleThemeEffectSpin),
	theme_effect_set: okResult(async () => {
		const { handleThemeEffectSet } = await import('./themeEffects.js');
		return (_client, payload: Parameters<typeof handleThemeEffectSet>[0]) => handleThemeEffectSet(payload);
	}),
	gift_item_announce: okResult(async () => (await import('./items.js')).handleAdminGiftAnnounce),
	asset_buy: okResult(async () => (await import('./market.js')).handleAssetBuy),
	asset_sell: okResult(async () => (await import('./market.js')).handleAssetSell),
	asset_search: withPayload(async (_client, payload: { query?: unknown }) => {
		const { searchAssets } = await import('./market.js');
		return { status: HTTP.OK, body: { ok: true, results: await searchAssets(String(payload.query || '')) } };
	})
};

function payloadType(payload: unknown): string {
	if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
		return '';
	}
	return typeof payload.type === 'string' ? payload.type : '';
}

async function dispatchWebhook(client: Client<true>, payload: unknown): Promise<WebhookReply> {
	const type = payloadType(payload);
	const action = Object.prototype.hasOwnProperty.call(WEBHOOK_ACTIONS, type) ? WEBHOOK_ACTIONS[type] : undefined;
	if (!action) {
		return invalidPayload(payload);
	}
	try {
		return await action.run(client, payload);
	} catch (err) {
		const details = (err as Error).message;
		await logger.log(`❌ ${type} failed: ${details}`);
		return { status: HTTP.INTERNAL_ERROR, body: action.failure ? action.failure(details) : { ok: false, error: `${type} failed`, details } };
	}
}

async function handleWebhookRequest(req: IncomingMessage, res: ServerResponse, client: Client<true>) {
	try {
		if (req.method !== 'POST') {
			respond(res, { status: HTTP.METHOD_NOT_ALLOWED, body: { error: 'Method not allowed' } });
			return;
		}

		const secretKey = req.headers['x-secret-key'];
		if (!secretKey || secretKey !== COMMUNICATION.SECRET_KEY) {
			await logger.log(`❌ Webhook unauthorized access attempt from ${getClientIp(req)}`);
			respond(res, { status: HTTP.UNAUTHORIZED, body: { error: 'Unauthorized' } });
			return;
		}

		let body = '';
		req.on('data', (chunk) => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			const parsed = attemptSync<unknown>(() => JSON.parse(body));
			if (!parsed.ok) {
				await logger.log(`❌ Webhook parse error: ${(parsed.error as Error).message}`);
				await logger.log(`❌ Raw body: ${body}`);
				respond(res, { status: HTTP.BAD_REQUEST, body: { error: 'Invalid JSON' } });
				return;
			}
			respond(res, await dispatchWebhook(client, parsed.value));
		});
	} catch (err) {
		await logger.log(`❌ Webhook error: ${(err as Error).message}`);
		respond(res, { status: HTTP.INTERNAL_ERROR, body: { error: 'Internal server error' } });
	}
}

function startWebhookServer(discordClient: Client<true>, botId: number | null) {
	currentBotId = botId ?? null;

	if (COMMUNICATION.WEBHOOK_URL) {
		const port = COMMUNICATION.PORT;

		import('http').then((http) => {
			webhookServer = http.createServer((req, res) => handleWebhookRequest(req, res, discordClient));

			webhookServer.listen(port, () => {
				logger.log(`🌐 Webhook server started on port ${port}`);
				logger.log(`📡 Listening for messages at ${COMMUNICATION.WEBHOOK_URL}`);
			});

			webhookServer.on('error', (err) => {
				if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
					logger.log(`❌ Port ${port} is already in use. Trying port ${port + 1}...`);
					webhookServer!.listen(port + 1, () => {
						logger.log(`🌐 Webhook server started on port ${port + 1}`);
						logger.log(`📡 Listening for messages at ${COMMUNICATION.WEBHOOK_URL}`);
					});
				} else {
					logger.log(`❌ Webhook server error: ${err.message}`);
				}
			});
		});
	}
}

function stopWebhookServer() {
	if (webhookServer) {
		webhookServer.close();
		webhookServer = null;
		logger.log(`🛑 Webhook server stopped`);
	}
}

export default {
	startWebhookServer,
	stopWebhookServer
};
