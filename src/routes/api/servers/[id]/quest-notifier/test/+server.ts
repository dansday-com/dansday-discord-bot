import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { request as httpRequest } from 'http';
import db from '$lib/database.js';
import { extractOrbQuests, fetchQuestsMe } from '$lib/discord-quest-api.js';

function canEditServer(locals: App.Locals, serverId: string): boolean {
	if (!locals.user.authenticated) return false;
	if (locals.user.account_source === 'accounts') return true;
	return locals.user.server_id === Number(serverId);
}

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!canEditServer(locals, params.id)) {
		return json({ success: false, error: 'Access denied' }, { status: 403 });
	}

	const server = await db.getServer(params.id);
	if (!server?.discord_server_id) {
		return json({ success: false, error: 'Server not found' }, { status: 404 });
	}

	const row = await db.getServerSettings(params.id, 'discord_quest_notifier').catch(() => null);
	const raw = row?.settings;
	const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
	if (!channelId) {
		return json({ success: false, error: 'Set notification channel and save before testing.' }, { status: 400 });
	}

	const officialBotId = await db.resolveOfficialBotIdForServer(server);
	if (officialBotId == null) {
		return json({ success: false, error: 'Could not resolve official bot for this server.' }, { status: 500 });
	}

	const selfbot = await db.getFirstRunningSelfbotForOfficialBot(officialBotId);
	if (!selfbot?.token) {
		return json(
			{
				success: false,
				error: 'No running selfbot for this bot. Start at least one selfbot linked to this official bot.'
			},
			{ status: 400 }
		);
	}

	let payload: unknown;
	try {
		payload = await fetchQuestsMe(selfbot.token);
	} catch (e: any) {
		return json({ success: false, error: e?.message || 'Failed to fetch quests from Discord.' }, { status: 502 });
	}

	const orbQuests = extractOrbQuests(payload);
	if (orbQuests.length === 0) {
		return json({
			success: false,
			error: 'No orb quests found for this account right now (or API response changed).'
		});
	}

	const latest = orbQuests[0];
	const bot = await db.getBot(officialBotId);
	if (!bot?.port || !bot.secret_key) {
		return json({ success: false, error: 'Official bot port or secret not configured.' }, { status: 500 });
	}

	const body = JSON.stringify({
		type: 'send_quest_notification',
		guild_id: server.discord_server_id,
		channel_id: channelId,
		quest_id: latest.id,
		quest_name: latest.questName,
		game_title: latest.gameTitle,
		description: latest.description,
		quest_url: latest.questUrl,
		quest_task_type: latest.taskTypeKey,
		quest_task_label: latest.taskTypeLabel,
		test: true
	});

	const ok = await new Promise<boolean>((resolve) => {
		const req = httpRequest(
			{
				hostname: 'localhost',
				port: bot.port,
				path: '/',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(body),
					'X-Secret-Key': bot.secret_key
				}
			},
			(res) => {
				resolve(res.statusCode === 200);
			}
		);
		req.on('error', () => resolve(false));
		req.write(body);
		req.end();
	});

	if (!ok) {
		return json(
			{
				success: false,
				error: 'Could not reach the official bot webhook. Is the bot running on this host?'
			},
			{ status: 502 }
		);
	}

	return json({
		success: true,
		quest: { id: latest.id, name: latest.questName, url: latest.questUrl }
	});
};
