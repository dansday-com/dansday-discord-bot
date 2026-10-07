import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { messageShownIds } from '$lib/messages.js';
import { globalPanelAccess, logGlobalMessageAction, pruneGlobalMessageFiles, syncGlobalMessagePosts } from '$lib/frontend/globalMessages.server.js';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	const { panelId } = access;
	const messageId = parseInt(params.messageId ?? '');
	if (isNaN(messageId)) return json({ ok: false, error: 'Invalid message ID' }, { status: 400 });

	try {
		const messages = await db.getGlobalMessages(panelId);
		const message = messages.find((m) => m.id === messageId);
		if (!message) return json({ ok: true, stripped: true });

		const usedBy = messages.find((m) => m.id !== messageId && messageShownIds(m.content).includes(messageId));
		if (usedBy) {
			return json(
				{ ok: false, error: `"${usedBy.name}" has a button or dropdown that shows this message. Point it at another message first, then delete this one.` },
				{ status: 400 }
			);
		}

		const posts = await db.getGlobalMessagePosts(panelId, messageId);
		const sync = await syncGlobalMessagePosts(locals, panelId, message, false);
		await db.deleteGlobalMessage(panelId, messageId);
		await logGlobalMessageAction(
			locals,
			'message_deleted',
			posts.map((post) => ({
				serverId: post.server_id,
				changes: [{ key: 'global message deleted, posted copy left in', before: null, after: post.discord_channel_id }]
			}))
		);
		await pruneGlobalMessageFiles(
			panelId,
			messages.filter((m) => m.id !== messageId)
		);
		logger.log(`${locals.user.authenticated ? locals.user.username : 'Someone'} deleted global message "${message.name}"`);
		return json({ ok: true, stripped: sync.failed.length === 0 && sync.unreached === 0 });
	} catch (error: any) {
		logger.log(`❌ Error deleting global message: ${error.message}`);
		return json({ ok: false, error: 'Could not delete the message. Try again in a moment.' }, { status: 500 });
	}
};
