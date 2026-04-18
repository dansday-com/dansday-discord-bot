import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { sql } from 'drizzle-orm';
import { logger } from '$lib/utils/index.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { request as httpRequest } from 'http';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user.authenticated || locals.user.account_type !== 'superadmin') {
		return json({ success: false, error: 'Authentication required' }, { status: 401 });
	}

	try {
		let bots;
		if (locals.user.account_type === 'superadmin' && locals.user.is_demo === true && locals.user.demo_panel_slug) {
			const sessionUsername = `demo_${locals.user.demo_panel_slug}`;
			const demoAdminRows = await db.execute(sql`SELECT id FROM accounts WHERE username = ${sessionUsername} LIMIT 1`);
			const demoAdminId =
				(demoAdminRows as any)?.[0]?.[0]?.id ?? (Array.isArray(demoAdminRows) && demoAdminRows.length > 0 ? (demoAdminRows as any)[0].id : null);

			if (demoAdminId) {
				const demoPanelRows = await db.execute(sql`SELECT id FROM panel WHERE account_id = ${demoAdminId} LIMIT 1`);
				const panelId =
					(demoPanelRows as any)?.[0]?.[0]?.id ?? (Array.isArray(demoPanelRows) && demoPanelRows.length > 0 ? (demoPanelRows as any)[0].id : null);
				if (!panelId) return json({ success: false, error: 'Demo panel not found' }, { status: 404 });
				bots = await db.getAllBots(panelId);
			} else {
				return json({ success: false, error: 'Demo admin not found' }, { status: 404 });
			}
		} else if (locals.user.account_type === 'superadmin') {
			bots = await db.getAllBots(locals.user.panel_id);
		} else {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		if (!bots || bots.length === 0) {
			return json({ success: false, error: 'No bots found' }, { status: 404 });
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
			if (!/^[a-zA-Z0-9_.\-]+$/.test(uploadedBasename)) {
				return json({ success: false, error: 'Invalid uploaded image filename' }, { status: 400 });
			}
			try {
				const filePath = join(uploadsDir, uploadedBasename);
				if (!filePath.startsWith(uploadsDir)) {
					return json({ success: false, error: 'Invalid uploaded image path' }, { status: 400 });
				}
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

		let totalSuccess = 0;
		let totalFail = 0;

		for (const bot of bots) {
			if (!bot.port || !bot.secret_key || bot.status !== 'running') {
				continue;
			}

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
				totalSuccess += result.body.successCount || 0;
				totalFail += result.body.failCount || 0;
			} else {
				logger.log(`❌ Failed to send to bot ${bot.name} (ID: ${bot.id})`);
			}
		}

		removeTempUpload();

		return json({ success: true, successCount: totalSuccess, failCount: totalFail });
	} catch (error: any) {
		logger.log(`❌ Error in global embed API: ${error.message}`);
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
