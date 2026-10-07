import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { messageShownIds } from '$lib/messages.js';
import { logMessageAction, messagePanelAccess, pruneMessageFiles, syncMessagePosts } from '$lib/frontend/serverMessages.server.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const access = await messagePanelAccess(locals, params.id);
	if (access instanceof Response) return access;
	const { serverId, server } = access;
	const messageId = parseInt(params.messageId ?? '');
	if (isNaN(messageId)) return json({ ok: false, error: 'Invalid message ID' }, { status: 400 });

	try {
		const messages = await db.getServerMessages(serverId);
		const message = messages.find((m) => m.id === messageId);
		if (!message) return json({ ok: true, stripped: true });

		const usedBy = messages.find((m) => m.id !== messageId && messageShownIds(m.content).includes(messageId));
		if (usedBy) {
			return json(
				{ ok: false, error: `"${usedBy.name}" has a button or dropdown that shows this message. Point it at another message first, then delete this one.` },
				{ status: 400 }
			);
		}

		const posts = await db.getServerMessagePosts(serverId, messageId);
		const sync = posts.length > 0 ? await syncMessagePosts(server, messageId, false) : { running: true, failed: [] as string[] };
		await db.deleteServerMessage(serverId, messageId);
		await pruneMessageFiles(
			serverId,
			messages.filter((m) => m.id !== messageId)
		);
		await logMessageAction(locals, serverId, 'message_deleted', [
			{ key: 'message deleted', before: message.name, after: null },
			...(posts.length > 0 ? [{ key: 'posted copies left in', before: null, after: [...new Set(posts.map((p) => p.discord_channel_id))].join(', ') }] : [])
		]);

		return json({ ok: true, stripped: posts.length === 0 || (sync.running && sync.failed.length === 0) });
	} catch (error: any) {
		logger.log(`❌ Error deleting message: ${error.message}`);
		return json({ ok: false, error: 'Could not delete the message. Try again in a moment.' }, { status: 500 });
	}
};
