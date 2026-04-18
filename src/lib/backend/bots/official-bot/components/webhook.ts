import { COMMUNICATION, NOTIFICATIONS, getEmbedConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { resolveEmbedFooterPlaceholders } from '../../../../utils/embedFooter.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { logger } from '../../../../utils/index.js';
import db from '../../../../database.js';

let webhookServer = null;
let client = null;
let currentBotId = null;

function parseColor(colorInput) {
	if (!colorInput || colorInput.trim() === '') {
		return null;
	}

	const trimmed = colorInput.trim();

	if (trimmed.startsWith('#')) {
		const hex = trimmed.substring(1);
		if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
			return parseInt(hex, 16);
		}
	} else if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
		return parseInt(trimmed, 16);
	}

	const decimal = parseInt(trimmed, 10);
	if (!isNaN(decimal) && decimal >= 0 && decimal <= 0xffffff) {
		return decimal;
	}

	const colorNames = {
		red: 0xff0000,
		green: 0x00ff00,
		blue: 0x0000ff,
		yellow: 0xffff00,
		orange: 0xffa500,
		purple: 0x800080,
		pink: 0xffc0cb,
		cyan: 0x00ffff,
		black: 0x000000,
		white: 0xffffff,
		gray: 0x808080,
		grey: 0x808080
	};

	if (colorNames[trimmed.toLowerCase()]) {
		return colorNames[trimmed.toLowerCase()];
	}

	return null;
}

async function handleSendGlobalEmbed(payload) {
	try {
		const { title, description, image_url, color, footer, image_attachment } = payload;

		if (!title) {
			throw new Error('Title is required');
		}

		if (!currentBotId) {
			throw new Error('Current bot id not set');
		}

		const servers = await db.getServersForBot(currentBotId);
		let successCount = 0;
		let failCount = 0;

		for (const server of servers) {
			const guild_id = server.discord_server_id;
			if (!guild_id) continue;

			try {
				const mainRow = await db.getServerSettings(server.id, 'main');
				const mainSettings = mainRow && Array.isArray(mainRow) ? mainRow[0]?.settings : mainRow?.settings;
				const channelId = mainSettings?.bot_updates_channel_id;

				if (!channelId) continue;

				let guild = client.guilds.cache.get(guild_id);
				if (!guild) guild = await client.guilds.fetch(guild_id).catch(() => null);
				if (!guild) continue;

				const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
				if (!channel || !channel.isTextBased()) continue;

				const embedConfig = await getEmbedConfig(guild_id).catch(() => ({ COLOR: 0, FOOTER: '' }));
				let embedColor = embedConfig.COLOR;

				if (color && color.trim()) {
					const parsedColor = parseColor(color.trim());
					if (parsedColor !== null) embedColor = parsedColor;
				}

				const serverNameForFooter = server.name || guild.name;
				const rawFooter = footer && footer.trim() ? footer.trim() : embedConfig.FOOTER;
				const footerText = resolveEmbedFooterPlaceholders(rawFooter, serverNameForFooter);

				const embed = new EmbedBuilder().setColor(embedColor).setFooter({ text: footerText }).setTimestamp();

				embed.setTitle(title);
				if (description) embed.setDescription(description);

				let files = [];
				if (image_url) {
					embed.setImage(image_url);
				} else if (image_attachment && image_attachment.data) {
					const buffer = Buffer.from(image_attachment.data, 'base64');
					const attachment = new AttachmentBuilder(buffer, { name: image_attachment.filename || 'image.png' });
					embed.setImage(`attachment://${image_attachment.filename || 'image.png'}`);
					files.push(attachment);
				}

				const messageOptions: any = { embeds: [embed] };
				if (files.length > 0) messageOptions.files = files;

				const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(guild_id, channel.id).catch(() => null);
				const firstMentionChunk = notificationMentions ? notificationMentions[0] : null;
				if (firstMentionChunk) messageOptions.content = firstMentionChunk;

				await channel.send(messageOptions);

				if (notificationMentions && notificationMentions.length > 1) {
					for (let i = 1; i < notificationMentions.length; i++) {
						await channel.send({ content: notificationMentions[i] }).catch(() => null);
					}
				}
				successCount++;
			} catch (err: any) {
				await logger.log(`❌ Failed to send global embed to guild ${guild_id}: ${err.message}`);
				failCount++;
			}
		}

		await logger.log(`✅ Global embed sent: ${successCount} succeeded, ${failCount} failed`);
		return { success: true, successCount, failCount };
	} catch (err: any) {
		await logger.log(`❌ handleSendGlobalEmbed error: ${err.message}`);
		return { success: false, error: err.message };
	}
}

async function handleSendEmbed(payload) {
	try {
		const { guild_id, channel_ids, role_ids, title, description, image_url, color, footer, image_attachment } = payload;

		const channelIds = channel_ids || (payload.channel_id ? [payload.channel_id] : []);
		const roleIds = role_ids || (payload.role_id ? [payload.role_id] : []);

		if (!guild_id || !channelIds || channelIds.length === 0 || !title) {
			throw new Error('Missing required fields: guild_id, channel_ids (array), and title are required');
		}

		const guild = client.guilds.cache.get(guild_id);
		if (!guild) {
			throw new Error('Guild not found');
		}
		let serverRow = null;
		if (currentBotId) {
			serverRow = await db.getServerByDiscordId(currentBotId, guild_id);
			if (!serverRow) {
				throw new Error('Guild not found');
			}
		}

		const embedConfig = await getEmbedConfig(guild_id);
		let embedColor = embedConfig.COLOR;

		if (color && color.trim()) {
			const parsedColor = parseColor(color.trim());
			if (parsedColor !== null) {
				embedColor = parsedColor;
			} else {
				throw new Error('Invalid color format');
			}
		}

		const serverNameForFooter = serverRow?.name || guild.name;

		const rawFooter = footer && footer.trim() ? footer.trim() : embedConfig.FOOTER;
		const footerText = resolveEmbedFooterPlaceholders(rawFooter, serverNameForFooter);

		const embed = new EmbedBuilder().setColor(embedColor).setFooter({ text: footerText }).setTimestamp();

		embed.setTitle(title);
		if (description) embed.setDescription(description);

		let imageAttachment = null;
		if (image_attachment && image_attachment.data) {
			try {
				const imageBuffer = Buffer.from(image_attachment.data, 'base64');
				const attachmentFilename = image_attachment.filename || 'image.png';
				imageAttachment = {
					attachment: imageBuffer,
					name: attachmentFilename
				};
				embed.setImage(`attachment://${attachmentFilename}`);
			} catch (attachErr) {
				await logger.log(`⚠️  Failed to process image attachment: ${attachErr.message}`);
				if (image_url) {
					embed.setImage(image_url);
				}
			}
		} else if (image_url) {
			const trimmedUrl = image_url.trim();
			if (trimmedUrl && (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('data:'))) {
				embed.setImage(trimmedUrl);
			} else {
				await logger.log(`⚠️  Invalid image URL format: ${image_url}`);
			}
		}

		let content = '';
		if (roleIds && roleIds.length > 0) {
			const mentions = [];
			for (const roleId of roleIds) {
				const role = guild.roles.cache.get(roleId);
				if (role) {
					mentions.push(`<@&${roleId}>`);
				}
			}
			if (mentions.length > 0) {
				content = mentions.join(' ');
			}
		}

		const messageOptions: any = {
			content: content || undefined,
			embeds: [embed]
		};

		if (imageAttachment) {
			messageOptions.files = [imageAttachment];
		}

		const results = [];
		for (const channelId of channelIds) {
			try {
				if (!channelId || channelId === 'undefined' || channelId === 'null') {
					results.push({ channelId: String(channelId), success: false, error: 'Invalid channel ID' });
					await logger.log(`❌ Invalid channel ID: ${channelId} in guild ${guild_id}`);
					continue;
				}

				const channel = await guild.channels.fetch(channelId).catch(() => null);
				if (!channel) {
					results.push({ channelId: String(channelId), success: false, error: 'Channel not found' });
					await logger.log(`❌ Channel ${channelId} not found in guild ${guild_id}`);
					continue;
				}

				if (!channel.isTextBased()) {
					results.push({ channelId, success: false, error: 'Channel is not a text channel' });
					continue;
				}

				const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(guild_id, channelId).catch(() => null);
				const firstMentionChunk = notificationMentions ? notificationMentions[0] : null;
				const channelContent = [firstMentionChunk ? firstMentionChunk : null, content].filter(Boolean).join(' ') || undefined;
				const channelMessageOptions = { ...messageOptions, content: channelContent };

				await channel.send(channelMessageOptions);

				if (notificationMentions && notificationMentions.length > 1) {
					for (let i = 1; i < notificationMentions.length; i++) {
						await channel.send({ content: notificationMentions[i] }).catch(() => null);
					}
				}
				results.push({ channelId, success: true, channelName: channel.name });
				await logger.log(`📤 Embed sent via webhook to ${channel.name} (${channel.id}) in ${guild.name} (${guild.id})`);
			} catch (channelError) {
				results.push({ channelId, success: false, error: channelError.message });
				await logger.log(`❌ Failed to send embed to channel ${channelId}: ${channelError.message}`);
			}
		}

		const successCount = results.filter((r) => r.success).length;
		if (successCount === 0) {
			throw new Error(`Failed to send embed to any channel. Errors: ${results.map((r) => r.error).join(', ')}`);
		}

		return { success: true, results, sentTo: successCount, total: channelIds.length };
	} catch (error) {
		await logger.log(`❌ Failed to send embed via webhook: ${error.message}`);
		throw error;
	}
}

function getClientIp(req) {
	const address = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
	return address.startsWith('::ffff:') ? address.slice(7) : address || 'unknown';
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
					try {
						await logger.log(`📥 Received message_forward webhook: channel ${payload.data.channel?.id} in guild ${payload.data.guild?.id}`);

						const { processMessageFromSelfBot } = await import('./forwarder.js');
						await processMessageFromSelfBot(payload.data, client);

						await logger.log(`✅ Successfully processed message_forward webhook`);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true, message: 'Message processed' }));
					} catch (forwardErr) {
						await logger.log(`❌ Failed to process message: ${forwardErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to process message', details: forwardErr.message }));
					}
				} else if (payload.type === 'send_global_embed') {
					try {
						await logger.log(`📥 Received send_global_embed webhook`);
						const result = await handleSendGlobalEmbed(payload);
						res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify(result));
					} catch (embedErr) {
						await logger.log(`❌ Failed to send global embed: ${embedErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to send global embed', details: embedErr.message }));
					}
				} else if (payload.type === 'send_embed') {
					try {
						const channelIds = payload.channel_ids || (payload.channel_id ? [payload.channel_id] : []);
						await logger.log(`📥 Received send_embed webhook: ${channelIds.length} channel(s) in guild ${payload.guild_id}`);
						const result = await handleSendEmbed(payload);
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true, message: 'Embed sent successfully' }));
					} catch (embedErr) {
						await logger.log(`❌ Failed to send embed: ${embedErr.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to send embed', details: embedErr.message }));
					}
				} else if (payload.type === 'send_quest_notification') {
					try {
						const guildId = payload.guild_id;
						const channelId = payload.channel_id;
						const questName = payload.quest_name;
						const gameTitle = payload.game_title;
						const description = payload.description;
						const questUrl = payload.quest_url;
						const isTest = payload.test === true;
						const autoQuestEnabled = payload.auto_quest_enabled !== false;
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
						await sendQuestNotificationMessage(
							client,
							guildId,
							channelId,
							{
								id: String(payload.quest_id || ''),
								questName: String(questName),
								gameTitle: typeof gameTitle === 'string' ? gameTitle : 'Quest',
								description: typeof description === 'string' ? description : '',
								questUrl: String(questUrl),
								startsAt: typeof payload.starts_at === 'string' ? payload.starts_at : '',
								expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : '',
								reward,
								taskTypeKey: taskKey,
								taskTypeLabel: taskLabel,
								publisher: typeof payload.publisher === 'string' ? payload.publisher : '',
								gameSubtitle: typeof payload.game_subtitle === 'string' ? payload.game_subtitle : '',
								taskDetailLine:
									typeof payload.task_detail_line === 'string' && payload.task_detail_line.trim() ? String(payload.task_detail_line).trim() : taskLabel,
								thumbnailUrl: thumb,
								bannerUrl: banner
							},
							{ test: isTest, autoQuestEnabled }
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
				} else if (payload.type === 'sync_bot_nickname') {
					try {
						const guildId = payload.guild_id;
						const nickname = payload.nickname;
						if (!guildId) {
							res.writeHead(400, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Missing guild_id' }));
							return;
						}

						let guild = client.guilds.cache.get(guildId);
						if (!guild) guild = await client.guilds.fetch(guildId).catch(() => null);
						if (!guild) throw new Error('Guild not found');

						const me = guild.members.me || (await guild.members.fetch(client.user.id).catch(() => null));
						if (me) {
							await me.setNickname(nickname || null);
							await logger.log(`✅ Synced bot nickname for guild ${guildId} to "${nickname}"`);
						} else {
							throw new Error('Bot member not found in guild');
						}

						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ success: true }));
					} catch (err) {
						await logger.log(`❌ Failed to sync bot nickname: ${err.message}`);
						res.writeHead(500, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: 'Failed to sync bot nickname', details: err.message }));
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
