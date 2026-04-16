import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { request as httpRequest } from 'http';
import { accountOwnsBot } from '$lib/frontend/panelServer.js';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const botId = parseInt(params.id ?? '');
	if (isNaN(botId)) {
		return json({ success: false, error: 'Invalid bot ID' }, { status: 400 });
	}

	if (!locals.user.authenticated || !(await accountOwnsBot(locals, botId))) {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		const bot = await db.getBot(botId);
		if (!bot) {
			return json({ success: false, error: 'Bot not found' }, { status: 404 });
		}

		if (!bot.port || !bot.secret_key) {
			return json({ success: false, error: 'Bot webhook not configured' }, { status: 400 });
		}

		const bodyObj = await request.json().catch(() => null);
		if (!bodyObj) {
			return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
		}

		const { title, description, image_url, uploaded_image_path, color, footer } = bodyObj;

		if (!title) {
			return json({ success: false, error: 'Title is required.' }, { status: 400 });
		}

		let imageBuffer: Buffer | null = null;
		let imageFilename: string | null = null;
		const uploadedBasename = uploaded_image_path ? basename(uploaded_image_path) : null;
		if (uploadedBasename) {
			try {
				const filePath = join(uploadsDir, uploadedBasename);
				if (existsSync(filePath)) {
					imageBuffer = readFileSync(filePath);
					imageFilename = uploadedBasename;
				}
			} catch (_) {}
		}

		let finalImageUrl = image_url ? String(image_url).trim() : null;
		if (finalImageUrl && !finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://') && !finalImageUrl.startsWith('data:')) {
			finalImageUrl = null;
		}

		function removeTempUpload() {
			if (!uploadedBasename) return;
			try {
				const fp = join(uploadsDir, uploadedBasename);
				if (existsSync(fp)) unlinkSync(fp);
			} catch (_) {}
		}

		const payload = JSON.stringify({
			type: 'send_global_embed',
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

		removeTempUpload();

		if (result.status === 200 && result.body.success) {
			return json({ success: true, ...result.body });
		} else {
			return json({ success: false, error: result.body?.error || 'Failed to send global embed' }, { status: result.status });
		}
	} catch (error: any) {
		logger.log(`❌ Error in global embed API: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
