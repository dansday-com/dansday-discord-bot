import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { request as httpRequest } from 'http';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { canUseEmbedBuilder } from '$lib/serverPanelAccess.js';
import { mainAppearanceBlockingMessage, messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';
import { mainChannelId } from '$lib/utils/mainConfigSettings.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user.authenticated) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	const serverId = parseInt(params.id ?? '');
	if (isNaN(serverId)) {
		return json({ success: false, error: 'Invalid server ID' }, { status: 400 });
	}

	if (!canUseEmbedBuilder(locals, serverId)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	let uploaded_image_path: string | null = null;

	try {
		const body = await request.json();
		const { channel_ids, role_ids, title, description, image_url, color, footer } = body;
		uploaded_image_path = body.uploaded_image_path || null;

		if (!title) {
			return json({ success: false, error: 'title is required' }, { status: 400 });
		}

		const server = await db.getServer(serverId);
		if (!server) return json({ success: false, error: 'Server not found' }, { status: 404 });

		const officialBotId = await db.resolveOfficialBotIdForServer(server);
		const bot = officialBotId ? await db.getBot(officialBotId) : null;
		if (!bot) return json({ success: false, error: 'Bot not found' }, { status: 404 });

		if (bot.status !== 'running') {
			return json({ success: false, error: 'Bot is not running' }, { status: 400 });
		}

		if (!bot.port || !bot.secret_key) {
			return json({ success: false, error: 'Bot webhook not configured' }, { status: 400 });
		}

		const mainRow = await db.getServerSettings(serverId, SERVER_SETTINGS.component.main).catch(() => null);
		const mainSettings = mainRow == null ? undefined : Array.isArray(mainRow) ? mainRow[0]?.settings : mainRow.settings;
		const appearanceBlock = mainAppearanceBlockingMessage(mainSettings);
		if (appearanceBlock) {
			return json({ success: false, error: appearanceBlock }, { status: 400 });
		}

		let resolvedChannelIds: string[] = Array.isArray(channel_ids)
			? channel_ids.filter((id: any) => id != null && id !== '')
			: [];

		if (resolvedChannelIds.length === 0) {
			const defaultChannel = mainChannelId(mainSettings);
			if (!defaultChannel) {
				return json({ success: false, error: 'No channel selected and no default channel configured in main settings.' }, { status: 400 });
			}
			resolvedChannelIds = [defaultChannel];
		}

		let imageBuffer: Buffer | null = null;
		let imageFilename: string | null = null;
		if (uploaded_image_path) {
			try {
				const filePath = join(uploadsDir, uploaded_image_path);
				if (existsSync(filePath)) {
					imageBuffer = readFileSync(filePath);
					imageFilename = uploaded_image_path.split('/').pop() || 'image.png';
				}
			} catch (_) {}
		}

		let finalImageUrl = image_url ? String(image_url).trim() : null;
		if (finalImageUrl && !finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://') && !finalImageUrl.startsWith('data:')) {
			finalImageUrl = null;
		}

		const cleanup = (delay = 0) => {
			if (!uploaded_image_path) return;
			const fn = () => {
				try {
					const fp = join(uploadsDir, uploaded_image_path!);
					if (existsSync(fp)) unlinkSync(fp);
				} catch (_) {}
			};
			delay > 0 ? setTimeout(fn, delay) : fn();
		};

		const payload = JSON.stringify({
			type: 'send_embed',
			guild_id: server.discord_server_id,
			channel_ids: resolvedChannelIds,
			role_ids: role_ids || [],
			title,
			description: description || null,
			image_url: imageBuffer ? null : finalImageUrl,
			color: color || null,
			footer: footer || null,
			image_attachment: imageBuffer ? { filename: imageFilename, data: imageBuffer.toString('base64') } : null
		});

		const result = await new Promise<{ status: number; body: any }>((resolve) => {
			const options = {
				hostname: 'localhost',
				port: bot.port,
				path: '/',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(payload),
					'X-Secret-Key': bot.secret_key ?? ''
				}
			};

			const req = httpRequest(options, (res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch (_) {
						resolve({ status: 500, body: { error: 'Failed to parse bot response' } });
					}
				});
			});
			req.on('error', (err) => {
				logger.log(`❌ Error calling bot webhook: ${err.message}`);
				resolve({ status: 500, body: { error: 'Failed to communicate with bot' } });
			});
			req.write(payload);
			req.end();
		});

		if (result.status === 200 && result.body.success) {
			cleanup(uploaded_image_path && !imageBuffer ? 30000 : 0);
			logger.log(`${locals.user.username} used embed builder on server "${server.name || serverId}"`);
			return json({ success: true, message: 'Embed sent successfully' });
		} else {
			cleanup();
			const msg = messageFromBotWebhookPayload(result.body);
			return json({ success: false, error: msg }, { status: result.status });
		}
	} catch (error: any) {
		if (uploaded_image_path) {
			try {
				unlinkSync(join(uploadsDir, uploaded_image_path));
			} catch (_) {}
		}
		logger.log(`❌ Error sending embed: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
