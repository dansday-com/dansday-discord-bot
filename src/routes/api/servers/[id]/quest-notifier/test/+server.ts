import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { request as httpRequest } from 'http';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';
import { extractOrbQuests, fetchQuestsMe, questPayloadOrbDiagnostics } from '$lib/discord-quest-api.js';
import { canEditServerSettings } from '$lib/serverPanelAccess.js';
import { mainAppearanceBlockingMessage, messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';

export const POST: RequestHandler = async ({ locals, params }) => {
	const serverIdParam = params.id;
	if (serverIdParam == null || serverIdParam === '') {
		return json({ success: false, error: 'Server id required' }, { status: 400 });
	}

	if (!(await canEditServerSettings(locals, serverIdParam))) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const server = await db.getServer(serverIdParam);
	if (!server?.discord_server_id) {
		return json({ success: false, error: 'Server not found' }, { status: 404 });
	}

	const row = await db.getServerSettings(serverIdParam, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const questRow = row && !Array.isArray(row) ? row : null;
	const raw = questRow?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	if (s.enabled === false) {
		return json(
			{
				success: false,
				error: 'Quest notifier is disabled for this server. Turn it on and save before running a test.'
			},
			{ status: 403 }
		);
	}
	const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
	if (!channelId) {
		return json({ success: false, error: 'Set notification channel and save before testing.' }, { status: 400 });
	}

	const mainRow = await db.getServerSettings(serverIdParam, SERVER_SETTINGS.component.main).catch(() => null);
	const mainSettingsUnknown = mainRow == null ? undefined : Array.isArray(mainRow) ? mainRow[0]?.settings : mainRow.settings;
	const appearanceBlock = mainAppearanceBlockingMessage(mainSettingsUnknown);
	if (appearanceBlock) {
		return json({ success: false, error: appearanceBlock }, { status: 400 });
	}

	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	if (officialBotId == null) {
		return json({ success: false, error: 'Could not resolve official bot for this server.' }, { status: 500 });
	}

	const selfbot = await db.getFirstRunningSelfbotForServer(Number(serverIdParam));
	if (!selfbot?.token) {
		return json(
			{
				success: false,
				error: 'No running selfbot for this server. Add and start a selfbot under Selfbots for this guild.'
			},
			{ status: 400 }
		);
	}

	const httpProxyUrl = typeof s.http_proxy_url === 'string' ? s.http_proxy_url : '';
	const autoQuestEnabled = s.auto_quest !== false;

	let payload: unknown;
	try {
		payload = await fetchQuestsMe(selfbot.token, { httpProxyUrl });
	} catch (e: any) {
		return json({ success: false, error: e?.message || 'Failed to fetch quests from Discord.' }, { status: 502 });
	}

	const orbQuests = extractOrbQuests(payload);
	if (orbQuests.length === 0) {
		const d = questPayloadOrbDiagnostics(payload);
		const detail =
			d.questCount === 0
				? 'Discord returned no quests in the payload (empty list or unexpected shape).'
				: d.afterPreviewExpired === 0
					? `Discord returned ${d.questCount} quest(s); all are preview or expired.`
					: `Discord returned ${d.questCount} quest(s), ${d.afterPreviewExpired} active — none have orb-style rewards in the data we recognize.`;
		return json({
			success: false,
			error: `No orb quests to test with. ${detail}`
		});
	}

	const latest = orbQuests[0];
	const bot = await db.getBot(officialBotId);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Official bot port or secret not configured.' }, { status: 500 });
	}

	const botPort = bot.port;
	const botSecret = bot.secret_key;

	const body = JSON.stringify({
		type: 'send_quest_notification',
		guild_id: server.discord_server_id,
		channel_id: channelId,
		quest_id: latest.id,
		quest_name: latest.questName,
		game_title: latest.gameTitle,
		game_subtitle: latest.gameSubtitle,
		description: latest.description,
		quest_url: latest.questUrl,
		quest_task_type: latest.taskTypeKey,
		quest_task_label: latest.taskTypeLabel,
		orb_hint: latest.orbHint,
		rewards_line: latest.rewardsLine,
		task_detail_line: latest.taskDetailLine,
		publisher: latest.publisher,
		starts_at: latest.startsAt,
		expires_at: latest.expiresAt,
		thumbnail_url: latest.thumbnailUrl ?? undefined,
		banner_url: latest.bannerUrl ?? undefined,
		test: true,
		auto_quest_enabled: autoQuestEnabled
	});

	const webhookResult = await new Promise<{ status: number; body: unknown }>((resolve) => {
		const req = httpRequest(
			{
				hostname: 'localhost',
				port: botPort,
				path: '/',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					'X-Secret-Key': botSecret
				}
			},
			(res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					try {
						resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
					} catch {
						resolve({ status: res.statusCode ?? 500, body: null });
					}
				});
			}
		);
		req.on('error', () => resolve({ status: 502, body: null }));
		req.write(body);
		req.end();
	});

	if (webhookResult.status !== 200) {
		const msg =
			webhookResult.body != null
				? messageFromBotWebhookPayload(webhookResult.body)
				: webhookResult.status === 502
					? 'Could not reach the official bot webhook. Is the bot running on this host?'
					: 'The official bot rejected the test request.';
		return json({ success: false, error: msg }, { status: webhookResult.status >= 400 && webhookResult.status < 600 ? webhookResult.status : 502 });
	}

	return json({
		success: true,
		quest: { id: latest.id, name: latest.questName, url: latest.questUrl }
	});
};
