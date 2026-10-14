import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { messageShownIds } from '$lib/messages.js';
import { logMessageAction, messagePanelAccess, pruneMessageFiles, syncMessagePosts } from '$lib/frontend/serverMessages.server.js';
import { HTTP } from '$lib/http.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
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
		const messages = await db.getServerMessages(serverId);
		const message = messages.find((m) => m.id === messageId);
		if (!message) {
			return json({ ok: true, stripped: true });
		}

		const usedBy = messages.find((m) => m.id !== messageId && messageShownIds(m.content).includes(messageId));
		if (usedBy) {
			return json(
				{ ok: false, error: `"${usedBy.name}" has a button or dropdown that shows this message. Point it at another message first, then delete this one.` },
				{ status: HTTP.BAD_REQUEST }
			);
		}

		const posts = await db.getServerMessagePosts(serverId, messageId);
		const sync = posts.length > 0 ? await syncMessagePosts(server, messageId, { interactive: false }) : { running: true, failed: [] as string[] };
		await db.deleteServerMessage(serverId, messageId);
		await pruneMessageFiles(
			serverId,
			messages.filter((m) => m.id !== messageId)
		);
		await logMessageAction(locals, serverId, {
			action: 'message_deleted',
			changes: [
				{ key: 'message deleted', before: message.name, after: null },
				...(posts.length > 0 ? [{ key: 'posted copies left in', before: null, after: [...new Set(posts.map((p) => p.discord_channel_id))].join(', ') }] : [])
			]
		});

		return json({ ok: true, stripped: posts.length === 0 || (sync.running && sync.failed.length === 0) });
	} catch (error) {
		logger.log(`❌ Error deleting message: ${(error as Error).message}`);
		return json({ ok: false, error: 'Could not delete the message. Try again in a moment.' }, { status: HTTP.INTERNAL_ERROR });
	}
};
