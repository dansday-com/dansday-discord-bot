import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { serverLanguageLabel } from '$lib/languages.js';
import { BOT_OFFLINE, callMessageBot, logMessageAction, messagePanelAccess } from '$lib/frontend/serverMessages.server.js';
import { HTTP, readJsonObject } from '$lib/http.js';

function idList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((id) => typeof id === 'string' || typeof id === 'number').map(String) : [];
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const access = await messagePanelAccess(locals, params.id);
	if (access instanceof Response) {
		return access;
	}
	const { serverId, server } = access;
	const messageId = parseInt(params.messageId ?? '');
	if (isNaN(messageId)) {
		return json({ ok: false, error: 'Invalid message ID' }, { status: HTTP.BAD_REQUEST });
	}

	try {
		const message = await db.getServerMessage(serverId, messageId);
		if (!message) {
			return json({ ok: false, error: 'That message no longer exists. It may have been deleted.' }, { status: HTTP.NOT_FOUND });
		}

		const body = await readJsonObject(request);
		const channels = await db.getChannelsForServer(serverId);
		const channelName = new Map(channels.map((c) => [String(c.discord_channel_id), String(c.name ?? c.discord_channel_id)]));
		const channelIds = [...new Set(idList(body.channel_ids))].filter((id) => channelName.has(id));
		if (channelIds.length === 0) {
			return json({ ok: false, error: 'Pick at least one channel to send it to.' }, { status: HTTP.BAD_REQUEST });
		}
		const roleIds = idList(body.role_ids).filter(Boolean);
		const language = message.content.languages.find((code) => code === body.language) ?? message.content.language;

		const call = await callMessageBot(server, 'server_message_send', { message_id: messageId, channel_ids: channelIds, role_ids: roleIds, language });
		if (!call.running) {
			return json({ ok: false, error: BOT_OFFLINE }, { status: HTTP.BAD_REQUEST });
		}
		if (!call.body?.ok) {
			return json({ ok: false, error: call.body?.error ?? 'The bot could not send it. Try again in a moment.' }, { status: HTTP.BAD_REQUEST });
		}

		const results = (call.body.results ?? []) as { ok?: boolean; channel_id?: string; message_id?: string; mentions?: string | null; error?: string }[];
		const sent = results.filter((r) => r.ok);
		for (const r of sent) {
			await db.addServerMessagePost(serverId, {
				messageId,
				discordChannelId: String(r.channel_id),
				discordMessageId: String(r.message_id),
				language,
				mentions: r.mentions ?? null,
				content: message.content
			});
		}

		if (sent.length > 0) {
			logger.log(`${locals.user.authenticated ? locals.user.username : 'Someone'} sent message "${message.name}" on server "${server.name || serverId}"`);
			await logMessageAction(locals, serverId, {
				action: 'message_sent',
				changes: [
					{ key: 'message sent', before: null, after: message.name },
					{ key: 'channels', before: null, after: sent.map((r) => String(r.channel_id)).join(', ') },
					...(roleIds.length > 0 ? [{ key: 'roles pinged', before: null, after: roleIds.join(', ') }] : []),
					...(message.content.languages.length > 1 ? [{ key: 'language', before: null, after: serverLanguageLabel(language) }] : [])
				]
			});
		}

		const failed = results.filter((r) => !r.ok).map((r) => `#${channelName.get(String(r.channel_id)) ?? r.channel_id}: ${r.error}`);
		if (sent.length === 0) {
			return json({ ok: false, error: failed[0] ?? 'Nothing was sent.' }, { status: HTTP.BAD_REQUEST });
		}
		return json({ ok: true, sent: sent.length, failed });
	} catch (error) {
		logger.log(`❌ Error sending message: ${(error as Error).message}`);
		return json({ ok: false, error: 'Could not send the message. Try again in a moment.' }, { status: HTTP.INTERNAL_ERROR });
	}
};
