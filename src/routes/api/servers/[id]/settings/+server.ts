import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { logger } from '$lib/utils/index.js';
import { validateServerAiSettings } from '$lib/server-ai-settings.js';
import { normalizeForwarderKeywords } from '$lib/forwarder-settings.js';
import { BOT_BIO_MAX_LENGTH, normalizeMainConfigForPanel } from '$lib/utils/mainConfigSettings.js';
import { messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';
import { BOT_PROFILE_IMAGE, BOT_PROFILE_IMAGE_FORMATS_LABEL, sniffBotProfileImage, tooLargeMessage, type BotProfileImageKind } from '$lib/images.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { isServerLanguage } from '$lib/languages.js';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const component = url.searchParams.get('component');
		let serverId = params.id;

		if (component === SERVER_SETTINGS.component.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) serverId = officialServerId;
		}

		const settings = await db.getServerSettings(serverId, component);
		return json(settings);
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};

const LOG_VALUE_MAX = 1000;

function logValue(value: unknown): string | null {
	if (value === undefined) return null;
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return text.length > LOG_VALUE_MAX ? `${text.slice(0, LOG_VALUE_MAX)}…` : text;
}

function canonical(value: unknown): unknown {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') return value.trim() === '' ? null : value;
	if (Array.isArray(value)) {
		const items = value.map(canonical);
		return items.length === 0 ? null : items;
	}
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			const v = canonical((value as Record<string, unknown>)[key]);
			if (v !== null) out[key] = v;
		}
		return Object.keys(out).length === 0 ? null : out;
	}
	return value;
}

function diffSettings(before: Record<string, unknown>, after: Record<string, unknown>) {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	const changes: { key: string; before: string | null; after: string | null }[] = [];
	for (const key of [...keys].sort()) {
		const next = canonical(after[key]);
		if (before[key] === undefined && (next === null || next === false)) continue;
		if (JSON.stringify(canonical(before[key])) === JSON.stringify(next)) continue;
		changes.push({ key, before: logValue(before[key]), after: logValue(after[key]) });
	}
	return changes;
}

async function postOfficialBotWebhook(
	bot: { port: number | null; secret_key: string | null } | null | undefined,
	payload: Record<string, unknown>
): Promise<void> {
	if (!bot?.port || !bot.secret_key) return;
	const { request } = await import('http');
	const body = JSON.stringify(payload);
	const options = {
		hostname: 'localhost',
		port: bot.port,
		path: '/',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(body),
			'X-Secret-Key': bot.secret_key
		}
	};
	await new Promise<void>((resolve) => {
		const req = request(options, () => resolve());
		req.on('error', () => resolve());
		req.write(body);
		req.end();
	});
}

async function callOfficialBotWebhook(
	bot: { port: number | null; secret_key: string | null; status?: string | null } | null | undefined,
	payload: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
	if (!bot || bot.status !== 'running') return { status: 503, body: { error: 'Bot is not running' } };
	if (!bot.port || !bot.secret_key) return { status: 503, body: { error: 'Bot webhook not configured' } };
	const { request } = await import('http');
	const body = JSON.stringify(payload);
	return new Promise((resolve) => {
		const req = request(
			{
				hostname: 'localhost',
				port: bot.port,
				path: '/',
				method: 'POST',
				timeout: 30_000,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					'X-Secret-Key': bot.secret_key
				}
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode ?? 500, body: { error: data } });
					}
				});
			}
		);
		req.on('timeout', () => req.destroy(new Error('Bot did not respond in time')));
		req.on('error', (err) => resolve({ status: 502, body: { error: err.message } }));
		req.write(body);
		req.end();
	});
}

function parseBotProfileImage(kind: BotProfileImageKind, value: unknown): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null || value === '') return null;
	const spec = BOT_PROFILE_IMAGE[kind];
	const match = typeof value === 'string' ? /^data:image\/[\w+.-]+;base64,(.+)$/.exec(value) : null;
	if (!match) throw new Error(`${spec.label} must be ${BOT_PROFILE_IMAGE_FORMATS_LABEL}`);
	const bytes = Buffer.from(match[1], 'base64');
	const type = sniffBotProfileImage(bytes);
	if (!type) throw new Error(`${spec.label} must be ${BOT_PROFILE_IMAGE_FORMATS_LABEL}`);
	if (bytes.length > spec.maxBytes) throw new Error(`${spec.label}: ${tooLargeMessage(spec.maxBytes)}`);
	return `data:${type};base64,${bytes.toString('base64')}`;
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const panelServerId = params.id;
	if (!panelServerId) {
		return json({ error: 'Server id required' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { component, ...settings } = body;
		if (!component) {
			return json({ error: 'component is required' }, { status: 400 });
		}

		if (component === SERVER_SETTINGS.component.ai) {
			const invalid = validateServerAiSettings(settings);
			if (invalid) {
				return json({ error: invalid }, { status: 400 });
			}
		}

		if (component === SERVER_SETTINGS.component.forwarder && Array.isArray((settings as { forwarders?: unknown }).forwarders)) {
			(settings as { forwarders: unknown[] }).forwarders = (settings as { forwarders: unknown[] }).forwarders.map((fw) =>
				fw && typeof fw === 'object'
					? { ...(fw as Record<string, unknown>), keywords: normalizeForwarderKeywords((fw as Record<string, unknown>).keywords) }
					: fw
			);
		}

		let targetServerId = panelServerId;
		if (component === SERVER_SETTINGS.component.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(panelServerId);
			if (officialServerId) targetServerId = officialServerId;
		}

		const previousRow = await db.getServerSettings(targetServerId, component).catch(() => null);
		const previous =
			previousRow?.settings && typeof previousRow.settings === 'object'
				? { ...(previousRow.settings as Record<string, unknown>) }
				: ({} as Record<string, unknown>);

		const panelServer = await db.getServer(panelServerId);
		const officialBotId = panelServer ? await db.resolveOfficialBotIdForServer(panelServer) : null;
		const bot = officialBotId ? await db.getBot(officialBotId) : null;

		let profileError = '';
		if (component === SERVER_SETTINGS.component.main) {
			const { bot_avatar, bot_banner, ...rest } = settings as Record<string, unknown>;
			let avatar: string | null | undefined;
			let banner: string | null | undefined;
			try {
				avatar = parseBotProfileImage('avatar', bot_avatar);
				banner = parseBotProfileImage('banner', bot_banner);
			} catch (err: any) {
				return json({ error: err.message }, { status: 400 });
			}
			const bio = typeof rest.bot_bio === 'string' ? rest.bot_bio.trim() : '';
			if (bio.length > BOT_BIO_MAX_LENGTH) {
				return json({ error: `Bot bio must be ${BOT_BIO_MAX_LENGTH} characters or fewer` }, { status: 400 });
			}
			if (rest.language !== undefined && !isServerLanguage(rest.language)) {
				return json({ error: 'Unsupported server language' }, { status: 400 });
			}

			const existing = await db.getServerSettings(targetServerId, component).catch(() => null);
			const existingRaw = existing?.settings && typeof existing.settings === 'object' ? (existing.settings as Record<string, unknown>) : {};
			const prev = normalizeMainConfigForPanel(existingRaw);
			const next = { ...existingRaw, ...rest, bot_bio: prev.bot_bio, bot_avatar_url: prev.bot_avatar_url, bot_banner_url: prev.bot_banner_url };

			const profile: Record<string, string | null> = {};
			if (avatar !== undefined) profile.avatar = avatar;
			if (banner !== undefined) profile.banner = banner;
			if (bio !== prev.bot_bio) profile.bio = bio || null;
			const nickname = typeof rest.bot_nickname === 'string' ? rest.bot_nickname : '';

			if (panelServer?.discord_server_id) {
				const hasProfile = Object.keys(profile).length > 0;
				const synced = await callOfficialBotWebhook(bot, {
					type: 'sync_bot_profile',
					guild_id: panelServer.discord_server_id,
					nickname,
					...profile
				});
				const reply = (synced.body ?? {}) as { success?: boolean; profile?: { avatar_url?: string; banner_url?: string } };
				if (reply.profile) {
					if ('bio' in profile) next.bot_bio = bio;
					if ('avatar' in profile) next.bot_avatar_url = reply.profile.avatar_url ?? '';
					if ('banner' in profile) next.bot_banner_url = reply.profile.banner_url ?? '';
				}
				if (hasProfile && (synced.status !== 200 || reply.success !== true)) {
					profileError = messageFromBotWebhookPayload(synced.body);
				}
			} else if (Object.keys(profile).length > 0) {
				profileError = 'This server is not linked to Discord yet';
			}

			Object.keys(settings).forEach((key) => delete (settings as Record<string, unknown>)[key]);
			Object.assign(settings, next);
		}

		const result = await db.upsertServerSettings(targetServerId, component, settings);

		if (result?.id && locals.user.authenticated) {
			const changes = diffSettings(previous, settings as Record<string, unknown>);
			await db
				.createServerPanelLog(Number(targetServerId), panelActorIds(locals), component, changes)
				.catch((err: any) => logger.log(`⚠️ Could not record settings change log: ${err.message}`));
		}

		let languageError = '';
		if (component === SERVER_SETTINGS.component.main && panelServer?.discord_server_id) {
			const before = normalizeMainConfigForPanel(previous).language;
			const after = normalizeMainConfigForPanel(settings).language;
			if (before !== after) {
				const applied = await callOfficialBotWebhook(bot, {
					type: 'apply_server_language',
					guild_id: panelServer.discord_server_id,
					language: after
				});
				const reply = (applied.body ?? {}) as { success?: boolean };
				if (applied.status !== 200 || reply.success !== true) languageError = messageFromBotWebhookPayload(applied.body);
			}
		}

		if (component === SERVER_SETTINGS.component.notifications) {
			try {
				const notifServer = await db.getServer(targetServerId);
				if (notifServer?.discord_server_id && bot) {
					await postOfficialBotWebhook(bot, { type: 'sync_notification_roles', guild_id: notifServer.discord_server_id });
				}
			} catch (_) {}
		}

		const featureSwitchIds = SERVER_SETTINGS.withFeatureSwitch as readonly string[];
		if (panelServer?.discord_server_id && bot && featureSwitchIds.includes(component) && component !== SERVER_SETTINGS.component.notifications) {
			const enabled = (settings as { enabled?: boolean }).enabled !== false;
			try {
				await postOfficialBotWebhook(bot, {
					type: 'sync_component_runtime',
					guild_id: panelServer.discord_server_id,
					component,
					enabled
				});
			} catch (_) {}
		}

		const serverName = panelServer ? panelServer.name : `Server ID: ${panelServerId}`;
		const actor = locals.user.authenticated && 'username' in locals.user ? locals.user.username : 'unknown';
		logger.log(`${actor} changed ${component} configuration on server "${serverName}"`);

		if (profileError) {
			return json({ success: false, saved: true, error: `Settings saved, but the bot profile was not updated: ${profileError}` });
		}
		if (languageError) {
			return json({
				success: false,
				saved: true,
				error: `Settings saved, but the bot could not rename the setup channels or refresh the menu yet: ${languageError}. Run /setup in Discord to apply the language.`
			});
		}
		return json({ success: true, data: result });
	} catch (error: any) {
		return json({ error: error.message }, { status: 500 });
	}
};
