import { COMMUNICATION, getEmbedConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, RateLimitError } from 'discord.js';
import { logger } from '../../../../utils/index.js';
import db from '../../../../database.js';

let webhookServer = null;
let client = null;
let currentBotId = null;

const FORWARD_MAX_CONCURRENT = 4;
const FORWARD_QUEUE_MAX = 500;
const forwardQueue = [];
let forwardActive = 0;
let forwardDropped = 0;

function enqueueForwardDelivery(messageData, deliveryClient) {
	if (forwardQueue.length >= FORWARD_QUEUE_MAX) {
		forwardQueue.shift();
		forwardDropped++;
		if (forwardDropped % 25 === 1) {
			logger.log(`🚨 Forward queue full (${FORWARD_QUEUE_MAX}), dropping oldest message(s); ${forwardDropped} dropped so far`);
		}
	}

	forwardQueue.push({ messageData, deliveryClient, queuedAt: Date.now() });
	drainForwardQueue();
}

function drainForwardQueue() {
	while (forwardActive < FORWARD_MAX_CONCURRENT && forwardQueue.length > 0) {
		const job = forwardQueue.shift();
		forwardActive++;

		(async () => {
			const waited = Date.now() - job.queuedAt;
			if (waited > 5000) {
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

function getClientIp(req) {
	const address = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
	return address.startsWith('::ffff:') ? address.slice(7) : address || 'unknown';
}

function botProfileErrorMessage(err) {
	if (err instanceof RateLimitError) {
		return `Discord is rate limiting profile changes. Try again in ${Math.max(1, Math.ceil(err.retryAfter / 1000))}s.`;
	}
	return err?.message || 'Unknown error';
}

async function handleWebhookRequest(req, res) {
	try {
		if (req.method !== 'POST') {
			res.writeHead(405, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Method not allowed' }));
			return;
		}

		const secretKey = req.headers['x-secret-key'];
		if (!secretKey || secretKey !== COMMUNICATION.SECRET_KEY) {
			await logger.log(`❌ Webhook unauthorized access attempt from ${getClientIp(req)}`);
			res.writeHead(401, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Unauthorized' }));
			return;
		}

		let body = '';
		req.on('data', (chunk) => {
			body += chunk.toString();
		});

		req.on('end', async () => {
			try {
				const payload = JSON.parse(body);

				if (payload.type === 'message_forward' && payload.data) {
					res.writeHead(202, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ success: true, message: 'Message accepted' }));

					enqueueForwardDelivery(payload.data, client);
				} else if (typeof payload.type === 'string' && /^(server|global)_message_/.test(payload.type)) {
					try {
						const messages = await import('./messages.js');
						const handlers = {
							server_message_send: messages.sendServerMessage,
							server_message_sync: messages.syncServerMessagePosts,
							server_message_remove_post: messages.removeServerMessagePost,
							server_message_emojis: messages.listGuildEmojis,
							global_message_send: messages.sendGlobalMessage,
							global_message_sync: messages.syncGlobalMessagePosts,
							global_message_remove_posts: messages.removeGlobalMessagePosts
						};
						const handler = handlers[payload.type];
						const result = handler ? await handler(client, payload) : { ok: false, error: 'Unknown message action' };
						res.writeHead(handler ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (messageErr: any) {
						await logger.log(`❌ ${payload.type} failed: ${messageErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: `${payload.type} failed`, details: messageErr.message }));
					}
				} else if (payload.type === 'agent_tools' || payload.type === 'agent_tool') {
					try {
						const agentTools = await import('./agentTools.js');
						const result = payload.type === 'agent_tools' ? await agentTools.listAgentTools(payload) : await agentTools.runAgentTool(payload);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (agentErr: any) {
						await logger.log(`❌ ${payload.type} failed: ${agentErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, reason: 'tool_failed' }));
					}
				} else if (payload.type === 'send_quest_notification') {
					try {
						const guildId = payload.guild_id;
						const channelId = payload.channel_id;
						const questName = payload.quest_name;
						const gameTitle = payload.game_title;
						const questUrl = payload.quest_url;
						const isTest = payload.test === true;
						if (!guildId || !channelId || !questName || !questUrl) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id, channel_id, quest_name, or quest_url' }));
							return;
						}
						if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.discord_quest_notifier))) {
							res.writeHead(403, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Quest notifier module is disabled for this server.' }));
							return;
						}
						const { sendQuestNotificationMessage } = await import('./questNotifier.js');
						const taskLabel =
							typeof payload.quest_task_label === 'string' && payload.quest_task_label.trim() ? String(payload.quest_task_label).trim() : 'Quest';
						const taskKey = typeof payload.quest_task_type === 'string' ? String(payload.quest_task_type) : '';
						const reward = typeof payload.reward === 'string' && payload.reward.trim() ? String(payload.reward).trim() : '• Quest reward';
						const thumb = typeof payload.thumbnail_url === 'string' && payload.thumbnail_url.startsWith('http') ? payload.thumbnail_url : null;
						const banner = typeof payload.banner_url === 'string' && payload.banner_url.startsWith('http') ? payload.banner_url : null;
						await logger.log(
							`🖼️ QUEST-EMBED quest=${payload.quest_id} raw_banner=${JSON.stringify(payload.banner_url)} raw_thumb=${JSON.stringify(payload.thumbnail_url)} -> banner=${banner ?? 'NULL'} thumb=${thumb ?? 'NULL'}`
						);
						await sendQuestNotificationMessage(
							client,
							guildId,
							channelId,
							{
								id: String(payload.quest_id || ''),
								questName: String(questName),
								gameTitle: typeof gameTitle === 'string' ? gameTitle : 'Quest',
								questUrl: String(questUrl),
								startsAt: typeof payload.starts_at === 'string' ? payload.starts_at : '',
								expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : '',
								reward,
								taskTypeKey: taskKey,
								taskTypeLabel: taskLabel,
								publisher: typeof payload.publisher === 'string' ? payload.publisher : '',
								gameSubtitle: typeof payload.game_subtitle === 'string' ? payload.game_subtitle : '',
								questDescription:
									typeof payload.quest_description === 'string' && payload.quest_description.trim()
										? String(payload.quest_description).trim()
										: typeof payload.task_detail_line === 'string' && payload.task_detail_line.trim()
											? String(payload.task_detail_line).trim()
											: taskLabel,
								thumbnailUrl: thumb,
								bannerUrl: banner
							},
							{ test: isTest }
						);
						await logger.log(`📥 Quest notification sent → #${channelId} (guild ${guildId})`);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true }));
					} catch (qnErr) {
						await logger.log(`❌ send_quest_notification failed: ${qnErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to send quest notification', details: qnErr.message }));
					}
				} else if (payload.type === 'send_dm') {
					try {
						const guildId = payload.guild_id;
						const userId = payload.user_id;
						const content = payload.content;
						const embedDescription =
							typeof payload.embed_description === 'string' && payload.embed_description.trim()
								? payload.embed_description.trim()
								: typeof content === 'string'
									? content.trim()
									: '';
						const embedTitle = typeof payload.embed_title === 'string' && payload.embed_title.trim() ? payload.embed_title.trim() : '';

						if (!guildId || !userId || !embedDescription) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id, user_id, or content/embed_description' }));
							return;
						}

						let guild = client.guilds.cache.get(guildId);
						if (!guild) guild = await client.guilds.fetch(guildId).catch(() => null);
						if (!guild) throw new Error('Guild not found');

						if (currentBotId) {
							const server = await db.getServerByDiscordId(currentBotId, guildId);
							if (!server) throw new Error('Guild not found');
						}

						const user = await client.users.fetch(String(userId)).catch(() => null);
						if (!user) throw new Error('User not found');

						const embedConfig = await getEmbedConfig(guildId);
						const embed = new EmbedBuilder()
							.setColor(embedConfig.COLOR)
							.setTitle((embedTitle || guild.name).trim())
							.setDescription(embedDescription.trim())
							.setTimestamp()
							.setFooter({ text: embedConfig.FOOTER });
						const linkUrl = typeof payload.link_url === 'string' ? payload.link_url.trim() : '';
						const linkLabelRaw = typeof payload.link_label === 'string' ? payload.link_label.trim() : '';
						const linkLabel = (linkLabelRaw || 'Open link').slice(0, 80);
						const dmComponents =
							linkUrl && /^https?:\/\//i.test(linkUrl)
								? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(linkUrl).setLabel(linkLabel))]
								: [];
						await user.send({
							embeds: [embed],
							...(dmComponents.length ? { components: dmComponents } : {})
						});
						await logger.log(`📩 DM sent via webhook to ${user.tag} (${user.id}) for guild ${guildId}`);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true }));
					} catch (dmErr) {
						await logger.log(`❌ Failed to send DM via webhook: ${dmErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to send DM', details: dmErr.message }));
					}
				} else if (payload.type === 'sync_bot_profile' || payload.type === 'sync_bot_nickname') {
					try {
						const guildId = payload.guild_id;
						if (!guildId) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id' }));
							return;
						}

						let guild = client.guilds.cache.get(guildId);
						if (!guild) guild = await client.guilds.fetch(guildId).catch(() => null);
						if (!guild) throw new Error('Guild not found');

						const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
						if (!me) throw new Error('Bot member not found in guild');

						const failures = [];
						const result = { success: true };

						const nickname = typeof payload.nickname === 'string' && payload.nickname.trim() ? payload.nickname.trim() : null;
						if ('nickname' in payload && (me.nickname ?? null) !== nickname) {
							try {
								await guild.members.editMe({ nick: nickname });
								await logger.log(`✅ Synced bot nickname for guild ${guildId} to "${nickname ?? ''}"`);
							} catch (err) {
								failures.push(`Nickname: ${botProfileErrorMessage(err)}`);
							}
						}

						const profile = {};
						for (const key of ['avatar', 'banner', 'bio']) {
							if (key in payload) profile[key] = payload[key] || null;
						}
						if (Object.keys(profile).length > 0) {
							try {
								const updated = await guild.members.editMe(profile);
								result.profile = {
									avatar_url: updated.avatarURL({ size: 512 }) ?? '',
									banner_url: updated.bannerURL({ size: 1024 }) ?? ''
								};
								await logger.log(`✅ Synced bot profile (${Object.keys(profile).join(', ')}) for guild ${guildId}`);
							} catch (err) {
								failures.push(`Profile: ${botProfileErrorMessage(err)}`);
							}
						}

						if (failures.length > 0) {
							result.success = false;
							result.error = failures.join(' ');
							await logger.log(`❌ Failed to sync bot profile for guild ${guildId}: ${result.error}`);
						}

						res.writeHead(failures.length > 0 ? 500 : 200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (err) {
						await logger.log(`❌ Failed to sync bot profile: ${err.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to sync bot profile', details: err.message }));
					}
				} else if (payload.type === 'sync_component_runtime') {
					try {
						const guildId = payload.guild_id;
						const component = payload.component;
						const enabled = payload.enabled !== false;
						if (!guildId || !component) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id or component' }));
							return;
						}
						if (component === serverSettingsComponent.leveling) {
							const { syncLevelingRuntime } = await import('./leveling.js');
							await syncLevelingRuntime(client, guildId, enabled);
							await logger.log(`📥 sync_component_runtime: leveling ${enabled ? 'on' : 'off'} for guild ${guildId}`);
						} else if (component === serverSettingsComponent.content_creator) {
							const { syncContentCreatorRuntime } = await import('./interface/contentcreator.js');
							await syncContentCreatorRuntime(client, guildId, enabled);
							await logger.log(`📥 sync_component_runtime: content_creator ${enabled ? 'on' : 'off'} for guild ${guildId}`);
						}
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true }));
					} catch (runtimeErr) {
						await logger.log(`❌ sync_component_runtime failed: ${runtimeErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'sync_component_runtime failed', details: runtimeErr.message }));
					}
				} else if (payload.type === 'sync_server_menu') {
					try {
						const guildId = payload.guild_id;
						if (!guildId) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id' }));
							return;
						}
						const { rememberServerLanguage } = await import('../i18n.js');
						const { syncServerMenu } = await import('./commands/admin/setup.js');
						if (payload.language) rememberServerLanguage(guildId, payload.language);
						syncServerMenu(client, guildId).catch((err) => logger.log(`❌ sync_server_menu failed: ${err.message}`));
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true }));
					} catch (menuErr) {
						await logger.log(`❌ sync_server_menu failed: ${menuErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'sync_server_menu failed', details: menuErr.message }));
					}
				} else if (payload.type === 'moderation_action') {
					try {
						const { performModerationAction } = await import('./moderation.js');
						const result = await performModerationAction(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (modErr: any) {
						await logger.log(`❌ moderation_action failed: ${modErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'moderation_action failed', details: modErr.message }));
					}
				} else if (payload.type === 'moderation_bulk') {
					try {
						const { startBulkModeration } = await import('./moderation.js');
						const result = await startBulkModeration(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (bulkErr: any) {
						await logger.log(`❌ moderation_bulk failed: ${bulkErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'moderation_bulk failed', details: bulkErr.message }));
					}
				} else if (payload.type === 'sync_rewards') {
					try {
						const { syncGuildRewards } = await import('./rewards.js');
						const result = await syncGuildRewards(client, payload.guild_id);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (rewardErr: any) {
						await logger.log(`❌ sync_rewards failed: ${rewardErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'sync_rewards failed', details: rewardErr.message }));
					}
				} else if (payload.type === 'use_item') {
					try {
						const { handleItemUse } = await import('./items.js');
						const result = await handleItemUse(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (shopErr: any) {
						await logger.log(`❌ use_item failed: ${shopErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'use_item failed', details: shopErr.message }));
					}
				} else if (payload.type === 'claim_login') {
					try {
						const { handleLoginClaim } = await import('./tasks.js');
						const result = await handleLoginClaim(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (loginErr: any) {
						await logger.log(`❌ claim_login failed: ${loginErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'claim_login failed', details: loginErr.message }));
					}
				} else if (payload.type === 'claim_task') {
					try {
						const { handleTaskClaim } = await import('./tasks.js');
						const result = await handleTaskClaim(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (taskErr: any) {
						await logger.log(`❌ claim_task failed: ${taskErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'claim_task failed', details: taskErr.message }));
					}
				} else if (payload.type === 'buy_item') {
					try {
						const { handleItemBuy } = await import('./items.js');
						const result = await handleItemBuy(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (shopErr: any) {
						await logger.log(`❌ buy_item failed: ${shopErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'buy_item failed', details: shopErr.message }));
					}
				} else if (payload.type === 'discard_item') {
					try {
						const { handleItemDiscard } = await import('./items.js');
						const result = await handleItemDiscard(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (shopErr: any) {
						await logger.log(`❌ discard_item failed: ${shopErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'discard_item failed', details: shopErr.message }));
					}
				} else if (payload.type === 'minigame_play') {
					try {
						const { handleMinigamePlay } = await import('./minigames.js');
						const result = await handleMinigamePlay(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (shopErr: any) {
						await logger.log(`❌ minigame_play failed: ${shopErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'minigame_play failed', details: shopErr.message }));
					}
				} else if (payload.type === 'minigame_tower') {
					try {
						const { handleTowerAction } = await import('./minigames.js');
						const result = await handleTowerAction(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (towerErr: any) {
						await logger.log(`❌ minigame_tower failed: ${towerErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'minigame_tower failed', details: towerErr.message }));
					}
				} else if (payload.type === 'minigame_color') {
					try {
						const { handleColorAction } = await import('./minigames.js');
						const result = await handleColorAction(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (colorErr: any) {
						await logger.log(`❌ minigame_color failed: ${colorErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'minigame_color failed', details: colorErr.message }));
					}
				} else if (payload.type === 'theme_effect_spin') {
					try {
						const { handleThemeEffectSpin } = await import('./themeEffects.js');
						const result = await handleThemeEffectSpin(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (spinErr: any) {
						await logger.log(`❌ theme_effect_spin failed: ${spinErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'theme_effect_spin failed', details: spinErr.message }));
					}
				} else if (payload.type === 'theme_effect_set') {
					try {
						const { handleThemeEffectSet } = await import('./themeEffects.js');
						const result = await handleThemeEffectSet(payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (setErr: any) {
						await logger.log(`❌ theme_effect_set failed: ${setErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'theme_effect_set failed', details: setErr.message }));
					}
				} else if (payload.type === 'gift_item_announce') {
					try {
						const { handleAdminGiftAnnounce } = await import('./items.js');
						const result = await handleAdminGiftAnnounce(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (shopErr: any) {
						await logger.log(`❌ gift_item_announce failed: ${shopErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'gift_item_announce failed', details: shopErr.message }));
					}
				} else if (payload.type === 'asset_buy') {
					try {
						const { handleAssetBuy } = await import('./market.js');
						const result = await handleAssetBuy(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (assetErr: any) {
						await logger.log(`❌ asset_buy failed: ${assetErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'asset_buy failed', details: assetErr.message }));
					}
				} else if (payload.type === 'asset_sell') {
					try {
						const { handleAssetSell } = await import('./market.js');
						const result = await handleAssetSell(client, payload);
						res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (assetErr: any) {
						await logger.log(`❌ asset_sell failed: ${assetErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'asset_sell failed', details: assetErr.message }));
					}
				} else if (payload.type === 'asset_search') {
					try {
						const { searchAssets } = await import('./market.js');
						const results = await searchAssets(String(payload.query || ''));
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: true, results }));
					} catch (assetErr: any) {
						await logger.log(`❌ asset_search failed: ${assetErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ ok: false, error: 'asset_search failed', details: assetErr.message }));
					}
				} else {
					await logger.log(`❌ Invalid payload format: ${JSON.stringify(payload)}`);
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'Invalid payload format' }));
				}
			} catch (parseErr) {
				await logger.log(`❌ Webhook parse error: ${parseErr.message}`);
				await logger.log(`❌ Raw body: ${body}`);
				res.writeHead(400, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Invalid JSON' }));
			}
		});
	} catch (err) {
		await logger.log(`❌ Webhook error: ${err.message}`);
		res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Internal server error' }));
	}
}

function startWebhookServer(discordClient, botId) {
	client = discordClient;
	currentBotId = botId ?? null;

	if (COMMUNICATION.WEBHOOK_URL) {
		const port = COMMUNICATION.PORT;

		import('http').then((http) => {
			webhookServer = http.createServer(handleWebhookRequest);

			webhookServer.listen(port, () => {
				logger.log(`🌐 Webhook server started on port ${port}`);
				logger.log(`📡 Listening for messages at ${COMMUNICATION.WEBHOOK_URL}`);
			});

			webhookServer.on('error', (err) => {
				if (err.code === 'EADDRINUSE') {
					logger.log(`❌ Port ${port} is already in use. Trying port ${port + 1}...`);
					webhookServer.listen(port + 1, () => {
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
