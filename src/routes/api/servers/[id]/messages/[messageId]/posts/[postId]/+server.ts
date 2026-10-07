import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { BOT_OFFLINE, callMessageBot, logMessageAction, messagePanelAccess } from '$lib/frontend/serverMessages.server.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const access = await messagePanelAccess(locals, params.id);
	if (access instanceof Response) return access;
	const { serverId, server } = access;
	const messageId = parseInt(params.messageId ?? '');
	const postId = parseInt(params.postId ?? '');
	if (isNaN(messageId) || isNaN(postId)) return json({ ok: false, error: 'Invalid ID' }, { status: 400 });

	try {
		const message = await db.getServerMessage(serverId, messageId);
		const post = (await db.getServerMessagePosts(serverId, messageId)).find((p) => p.id === postId);
		if (!message || !post) return json({ ok: true });

		const call = await callMessageBot(server, 'server_message_remove_post', {
			channel_id: post.discord_channel_id,
			channel_name: post.channel_name,
			discord_message_id: post.discord_message_id
		});
		if (!call.running) return json({ ok: false, error: BOT_OFFLINE }, { status: 400 });
		if (!call.body?.ok) return json({ ok: false, error: call.body?.error ?? 'The bot could not remove it. Try again in a moment.' }, { status: 400 });

		await db.deleteServerMessagePost(serverId, postId);
		await logMessageAction(locals, serverId, 'message_post_removed', [
			{ key: 'posted copy removed', before: message.name, after: null },
			{ key: 'channel', before: post.discord_channel_id, after: null }
		]);
		return json({ ok: true });
	} catch (error: any) {
		logger.log(`❌ Error removing posted message: ${error.message}`);
		return json({ ok: false, error: 'Could not remove it. Try again in a moment.' }, { status: 500 });
	}
};
