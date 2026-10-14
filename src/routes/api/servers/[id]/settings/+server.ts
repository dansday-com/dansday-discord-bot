import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { logger } from '$lib/utils/index.js';
import { validateServerAiSettings } from '$lib/server-ai-settings.js';
import { normalizeForwarderKeywords } from '$lib/forwarder-settings.js';
import { BOT_BIO_MAX_LENGTH } from '$lib/utils/mainConfigSettings.js';
import { normalizeMainConfigForPanel } from '$lib/utils/mainConfig.js';
import { messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';
import { BOT_PROFILE_IMAGE, BOT_PROFILE_IMAGE_FORMATS_LABEL, sniffBotProfileImage, tooLargeMessage, type BotProfileImageKind } from '$lib/images.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { isServerLanguage } from '$lib/languages.js';
import { attemptSync } from '$lib/utils/attempt.js';
import { HTTP } from '$lib/http.js';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const component = url.searchParams.get('component');
		let serverId: string | number = params.id;

		if (component === SERVER_SETTINGS.component.notifications) {
			const officialServerId = await db.getOfficialBotServerIdForServer(params.id);
			if (officialServerId) {
				serverId = officialServerId;
			}
		}

		const settings = await db.getServerSettings(serverId, component);
		return json(settings);
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};

const LOG_VALUE_MAX = 1000;

function logValue(value: unknown): string | null {
	if (value === undefined) {
		return null;
	}
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return text.length > LOG_VALUE_MAX ? `${text.slice(0, LOG_VALUE_MAX)}…` : text;
}

function canonical(value: unknown): unknown {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	if (typeof value === 'number') {
		return String(value);
	}
	if (typeof value === 'string') {
		return value.trim() === '' ? null : value;
	}
	if (Array.isArray(value)) {
		const items = value.map(canonical);
		return items.length === 0 ? null : items;
	}
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			const v = canonical((value as Record<string, unknown>)[key]);
			if (v !== null) {
				out[key] = v;
			}
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
		if (before[key] === undefined && (next === null || next === false)) {
			continue;
		}
		if (JSON.stringify(canonical(before[key])) === JSON.stringify(next)) {
			continue;
		}
		changes.push({ key, before: logValue(before[key]), after: logValue(after[key]) });
	}
	return changes;
}

async function postOfficialBotWebhook(
	bot: { port: number | null; secret_key: string | null } | null | undefined,
	payload: Record<string, unknown>
): Promise<void> {
	if (!bot?.port || !bot.secret_key) {
		return;
	}
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
	if (!bot || bot.status !== 'running') {
		return { status: HTTP.SERVICE_UNAVAILABLE, body: { error: 'Bot is not running' } };
	}
	if (!bot.port || !bot.secret_key) {
		return { status: HTTP.SERVICE_UNAVAILABLE, body: { error: 'Bot webhook not configured' } };
	}
	const { request } = await import('http');
	const body = JSON.stringify(payload);
	return new Promise((resolve) => {
		const req = request(
			{
				hostname: 'localhost',
				port: bot.port!,
				path: '/',
				method: 'POST',
				timeout: 30_000,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					'X-Secret-Key': bot.secret_key!
				}
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? HTTP.INTERNAL_ERROR, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode ?? HTTP.INTERNAL_ERROR, body: { error: data } });
					}
				});
			}
		);
		req.on('timeout', () => req.destroy(new Error('Bot did not respond in time')));
		req.on('error', (err) => resolve({ status: HTTP.BAD_GATEWAY, body: { error: err.message } }));
		req.write(body);
		req.end();
	});
}

function parseBotProfileImage(kind: BotProfileImageKind, value: unknown): string | null | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === null || value === '') {
		return null;
	}
	const spec = BOT_PROFILE_IMAGE[kind];
	const match = typeof value === 'string' ? /^data:image\/[\w+.-]+;base64,(.+)$/.exec(value) : null;
	if (!match) {
		throw new Error(`${spec.label} must be ${BOT_PROFILE_IMAGE_FORMATS_LABEL}`);
	}
	const bytes = Buffer.from(match[1], 'base64');
	const type = sniffBotProfileImage(bytes);
	if (!type) {
		throw new Error(`${spec.label} must be ${BOT_PROFILE_IMAGE_FORMATS_LABEL}`);
	}
	if (bytes.length > spec.maxBytes) {
		throw new Error(`${spec.label}: ${tooLargeMessage(spec.maxBytes)}`);
	}
	return `data:${type};base64,${bytes.toString('base64')}`;
}

type MainSave = {
	targetServerId: string | number;
	panelServer: { discord_server_id: string | null } | null | undefined;
	bot: Parameters<typeof callOfficialBotWebhook>[0];
};
type MainInput = { avatar: string | null | undefined; banner: string | null | undefined; bio: string; rest: Record<string, unknown> };
type ProfileChange = { input: MainInput; profile: Record<string, string | null>; next: Record<string, unknown> };
type ProfileReply = { success?: boolean; profile?: { avatar_url?: string; banner_url?: string } };

function readMainInput(settings: Record<string, unknown>): MainInput | { error: string } {
	const { bot_avatar, bot_banner, ...rest } = settings;
	const images = attemptSync(() => ({ avatar: parseBotProfileImage('avatar', bot_avatar), banner: parseBotProfileImage('banner', bot_banner) }));
	if (!images.ok) {
		return { error: (images.error as Error).message };
	}
	const bio = typeof rest.bot_bio === 'string' ? rest.bot_bio.trim() : '';
	if (bio.length > BOT_BIO_MAX_LENGTH) {
		return { error: `Bot bio must be ${BOT_BIO_MAX_LENGTH} characters or fewer` };
	}
	if (rest.language !== undefined && !isServerLanguage(rest.language)) {
		return { error: 'Unsupported server language' };
	}
	return { ...images.value, bio, rest };
}

function profileChanges(input: MainInput, previousBio: string): Record<string, string | null> {
	const profile: Record<string, string | null> = {};
	if (input.avatar !== undefined) {
		profile.avatar = input.avatar;
	}
	if (input.banner !== undefined) {
		profile.banner = input.banner;
	}
	if (input.bio !== previousBio) {
		profile.bio = input.bio || null;
	}
	return profile;
}

async function syncMainProfile({ panelServer, bot }: MainSave, { input, profile, next }: ProfileChange): Promise<string> {
	const hasProfile = Object.keys(profile).length > 0;
	if (!panelServer?.discord_server_id) {
		return hasProfile ? 'This server is not linked to Discord yet' : '';
	}
	const synced = await callOfficialBotWebhook(bot, {
		type: 'sync_bot_profile',
		guild_id: panelServer.discord_server_id,
		nickname: typeof input.rest.bot_nickname === 'string' ? input.rest.bot_nickname : '',
		...profile
	});
	const reply = (synced.body ?? {}) as ProfileReply;
	if (reply.profile && 'bio' in profile) {
		next.bot_bio = input.bio;
	}
	if (reply.profile && 'avatar' in profile) {
		next.bot_avatar_url = reply.profile.avatar_url ?? '';
	}
	if (reply.profile && 'banner' in profile) {
		next.bot_banner_url = reply.profile.banner_url ?? '';
	}
	return hasProfile && (synced.status !== HTTP.OK || reply.success !== true) ? messageFromBotWebhookPayload(synced.body) : '';
}

async function prepareMainSettings(
	settings: Record<string, unknown>,
	save: MainSave
): Promise<{ error: string } | { next: Record<string, unknown>; profileError: string }> {
	const input = readMainInput(settings);
	if ('error' in input) {
		return input;
	}
	const existing = await db.getServerSettings(save.targetServerId, SERVER_SETTINGS.component.main).catch(() => null);
	const existingRaw = existing?.settings && typeof existing.settings === 'object' ? (existing.settings as Record<string, unknown>) : {};
	const prev = normalizeMainConfigForPanel(existingRaw);
	const next = { ...existingRaw, ...input.rest, bot_bio: prev.bot_bio, bot_avatar_url: prev.bot_avatar_url, bot_banner_url: prev.bot_banner_url };
	const profileError = await syncMainProfile(save, { input, profile: profileChanges(input, prev.bot_bio), next });
	return { next, profileError };
}

type SettingsBody = Record<string, unknown>;
type SavedSettings = { component: string; settings: SettingsBody; previous: SettingsBody; targetServerId: string | number };
type BotTarget = { panelServer: Awaited<ReturnType<typeof db.getServer>>; bot: Awaited<ReturnType<typeof db.getBot>> | null };

function normalizeComponentSettings(component: string, settings: SettingsBody): string | null {
	if (component === SERVER_SETTINGS.component.ai) {
		return validateServerAiSettings(settings) || null;
	}
	if (component === SERVER_SETTINGS.component.forwarder && Array.isArray(settings.forwarders)) {
		settings.forwarders = settings.forwarders.map((fw: unknown) =>
			fw && typeof fw === 'object' ? { ...(fw as SettingsBody), keywords: normalizeForwarderKeywords((fw as SettingsBody).keywords) } : fw
		);
	}
	return null;
}

async function settingsTargetId(component: string, panelServerId: string): Promise<string | number> {
	if (component !== SERVER_SETTINGS.component.notifications) {
		return panelServerId;
	}
	return (await db.getOfficialBotServerIdForServer(panelServerId)) || panelServerId;
}

async function storedSettingsCopy(targetServerId: string | number, component: string): Promise<SettingsBody> {
	const previousRow = await db.getServerSettings(targetServerId, component).catch(() => null);
	return previousRow?.settings && typeof previousRow.settings === 'object' ? { ...(previousRow.settings as SettingsBody) } : {};
}

async function syncMenuAfterSave({ panelServer, bot }: BotTarget, saved: SavedSettings): Promise<string> {
	if (saved.component !== SERVER_SETTINGS.component.main || !panelServer?.discord_server_id || diffSettings(saved.previous, saved.settings).length === 0) {
		return '';
	}
	const synced = await callOfficialBotWebhook(bot, {
		type: 'sync_server_menu',
		guild_id: panelServer.discord_server_id,
		language: normalizeMainConfigForPanel(saved.settings).language
	});
	const reply = (synced.body ?? {}) as { success?: boolean };
	return synced.status !== HTTP.OK || reply.success !== true ? messageFromBotWebhookPayload(synced.body) : '';
}

async function syncRuntimeAfterSave({ panelServer, bot }: BotTarget, saved: SavedSettings) {
	const { component } = saved;
	if (component === SERVER_SETTINGS.component.notifications) {
		const notifServer = await db.getServer(saved.targetServerId).catch(() => null);
		if (notifServer?.discord_server_id && bot) {
			await postOfficialBotWebhook(bot, { type: 'sync_notification_roles', guild_id: notifServer.discord_server_id }).catch(() => null);
		}
		return;
	}
	const featureSwitchIds = SERVER_SETTINGS.withFeatureSwitch as readonly string[];
	if (panelServer?.discord_server_id && bot && featureSwitchIds.includes(component)) {
		await postOfficialBotWebhook(bot, {
			type: 'sync_component_runtime',
			guild_id: panelServer.discord_server_id,
			component,
			enabled: saved.settings.enabled !== false
		}).catch(() => null);
	}
}

async function logSettingsChange(locals: App.Locals, saved: SavedSettings) {
	const changes = diffSettings(saved.previous, saved.settings);
	await db
		.createServerPanelLog(Number(saved.targetServerId), panelActorIds(locals), { action: saved.component, changes })
		.catch((err) => logger.log(`⚠️ Could not record settings change log: ${err.message}`));
}

function saveResponse(result: unknown, { profileError, menuError }: { profileError: string; menuError: string }) {
	if (profileError) {
		return json({ success: false, saved: true, error: `Settings saved, but the bot profile was not updated: ${profileError}` });
	}
	if (menuError) {
		return json({ success: false, saved: true, error: `Settings saved, but the menu in Discord was not updated yet: ${menuError}.` });
	}
	return json({ success: true, data: result });
}

async function settingsBot(panelServerId: string): Promise<BotTarget> {
	const panelServer = await db.getServer(panelServerId);
	const officialBotId = panelServer ? await db.resolveOfficialBotIdForServer(panelServer) : null;
	return { panelServer, bot: officialBotId ? await db.getBot(officialBotId) : null };
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const panelServerId = params.id;
	if (!panelServerId) {
		return json({ error: 'Server id required' }, { status: HTTP.BAD_REQUEST });
	}

	try {
		const { component, ...settings } = (await request.json()) as SettingsBody;
		if (!component || typeof component !== 'string') {
			return json({ error: 'component is required' }, { status: HTTP.BAD_REQUEST });
		}
		const invalid = normalizeComponentSettings(component, settings);
		if (invalid) {
			return json({ error: invalid }, { status: HTTP.BAD_REQUEST });
		}

		const targetServerId = await settingsTargetId(component, panelServerId);
		const previous = await storedSettingsCopy(targetServerId, component);
		const target = await settingsBot(panelServerId);

		let profileError = '';
		if (component === SERVER_SETTINGS.component.main) {
			const prepared = await prepareMainSettings(settings, { targetServerId, ...target });
			if ('error' in prepared) {
				return json({ error: prepared.error }, { status: HTTP.BAD_REQUEST });
			}
			profileError = prepared.profileError;
			Object.keys(settings).forEach((key) => delete settings[key]);
			Object.assign(settings, prepared.next);
		}

		const result = await db.upsertServerSettings(targetServerId, component, settings);
		const saved: SavedSettings = { component, settings, previous, targetServerId };
		if (result?.id && locals.user.authenticated) {
			await logSettingsChange(locals, saved);
		}

		const menuError = await syncMenuAfterSave(target, saved);
		await syncRuntimeAfterSave(target, saved);

		const serverName = target.panelServer ? target.panelServer.name : `Server ID: ${panelServerId}`;
		const actor = locals.user.authenticated && 'username' in locals.user ? locals.user.username : 'unknown';
		logger.log(`${actor} changed ${component} configuration on server "${serverName}"`);
		return saveResponse(result, { profileError, menuError });
	} catch (error) {
		return json({ error: (error as Error).message }, { status: HTTP.INTERNAL_ERROR });
	}
};
