import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { postBotWebhook } from '$lib/botControl.js';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
import { mainAppearanceBlockingMessage, messageFromBotWebhookPayload } from '$lib/utils/configPrerequisiteErrors.js';
import { HTTP, isHttpError } from '$lib/http.js';

export const POST: RequestHandler = async ({ params }) => {
	const serverIdParam = params.id;
	if (serverIdParam == null || serverIdParam === '') {
		return json({ success: false, error: 'Server id required' }, { status: HTTP.BAD_REQUEST });
	}

	const server = await db.getServer(serverIdParam);
	if (!server?.discord_server_id) {
		return json({ success: false, error: 'Server not found' }, { status: HTTP.NOT_FOUND });
	}

	const row = await db.getServerSettings(serverIdParam, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const questRow = row && !Array.isArray(row) ? row : null;
	const raw = questRow?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	if (s.enabled === false) {
		return json(
			{ success: false, error: 'Quest notifier is disabled for this server. Turn it on and save before running a test.' },
			{ status: HTTP.FORBIDDEN }
		);
	}
	const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
	if (!channelId) {
		return json({ success: false, error: 'Set notification channel and save before testing.' }, { status: HTTP.BAD_REQUEST });
	}

	const mainRow = await db.getServerSettings(serverIdParam, SERVER_SETTINGS.component.main).catch(() => null);
	const mainSettingsUnknown = mainRow == null ? undefined : Array.isArray(mainRow) ? mainRow[0]?.settings : mainRow.settings;
	const appearanceBlock = mainAppearanceBlockingMessage(mainSettingsUnknown);
	if (appearanceBlock) {
		return json({ success: false, error: appearanceBlock }, { status: HTTP.BAD_REQUEST });
	}

	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	if (officialBotId == null) {
		return json({ success: false, error: 'Could not resolve official bot for this server.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const questSummaries = await db.listActiveBotDiscordQuests(officialBotId).catch(() => []);
	if (questSummaries.length === 0) {
		return json({ success: false, error: 'No Discord quests found yet. Nothing to test with until quests are picked up.' }, { status: HTTP.BAD_REQUEST });
	}

	const latest = [...questSummaries].sort((a, b) => Date.parse(b.startsAt || '') - Date.parse(a.startsAt || ''))[0];
	const bot = await db.getBot(officialBotId);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Official bot port or secret not configured.' }, { status: HTTP.INTERNAL_ERROR });
	}

	const webhookResult = await postBotWebhook(bot, {
		type: 'send_quest_notification',
		guild_id: server.discord_server_id,
		channel_id: channelId,
		quest_id: latest.id,
		quest_name: latest.questName,
		game_title: latest.gameTitle,
		game_subtitle: latest.gameSubtitle,
		quest_url: latest.questUrl,
		quest_task_type: latest.taskTypeKey,
		quest_task_label: latest.taskTypeLabel,
		reward: latest.reward,
		quest_description: latest.questDescription,
		publisher: latest.publisher,
		starts_at: latest.startsAt,
		expires_at: latest.expiresAt,
		thumbnail_url: latest.thumbnailUrl ?? undefined,
		banner_url: latest.bannerUrl ?? undefined,
		test: true
	});

	if (webhookResult.status !== HTTP.OK) {
		const msg =
			webhookResult.body != null
				? messageFromBotWebhookPayload(webhookResult.body)
				: webhookResult.status === HTTP.BAD_GATEWAY
					? 'Could not reach the official bot webhook. Is the bot running on this host?'
					: 'The official bot rejected the test request.';
		return json({ success: false, error: msg }, { status: isHttpError(webhookResult.status) ? webhookResult.status : HTTP.BAD_GATEWAY });
	}

	return json({ success: true, quest: { id: latest.id, name: latest.questName, url: latest.questUrl } });
};
