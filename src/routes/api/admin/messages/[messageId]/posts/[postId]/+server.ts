import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { globalPanelAccess, removeGlobalMessagePosts, syncGlobalMessagePosts } from '$lib/frontend/globalMessages.server.js';

export const POST: RequestHandler = async ({ locals, params }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	const { panelId } = access;
	const messageId = parseInt(params.messageId ?? '');
	const everything = params.postId === 'all';
	const postId = parseInt(params.postId ?? '');
	if (isNaN(messageId) || (!everything && isNaN(postId))) return json({ ok: false, error: 'Invalid ID' }, { status: 400 });

	try {
		const message = await db.getGlobalMessage(panelId, messageId);
		if (!message) return json({ ok: false, error: 'That message no longer exists. It may have been deleted.' }, { status: 404 });

		const out = await syncGlobalMessagePosts(locals, panelId, message, true, everything ? 'all' : [postId]);
		if (out.updated === 0 && out.removed === 0) {
			const reason = out.failed[0] ?? 'The bot for that server is offline. Start it, then try again.';
			return json({ ok: false, error: reason }, { status: 400 });
		}
		return json({ ok: true, ...out });
	} catch (error: any) {
		logger.log(`❌ Error updating global posted message: ${error.message}`);
		return json({ ok: false, error: 'Could not update it. Try again in a moment.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	const { panelId } = access;
	const messageId = parseInt(params.messageId ?? '');
	const everything = params.postId === 'all';
	const postId = parseInt(params.postId ?? '');
	if (isNaN(messageId) || (!everything && isNaN(postId))) return json({ ok: false, error: 'Invalid ID' }, { status: 400 });

	try {
		const message = await db.getGlobalMessage(panelId, messageId);
		if (!message) return json({ ok: true, removed: 0, failed: [] });
		const posts = (await db.getGlobalMessagePosts(panelId, messageId)).filter((post) => everything || post.id === postId);
		if (posts.length === 0) return json({ ok: true, removed: 0, failed: [] });

		const out = await removeGlobalMessagePosts(locals, panelId, message, posts);
		if (out.removed === 0) {
			const reason = out.failed[0] ?? 'The bot for that server is offline. Start it, then try again.';
			return json({ ok: false, error: reason }, { status: 400 });
		}
		return json({ ok: true, ...out });
	} catch (error: any) {
		logger.log(`❌ Error removing global posted message: ${error.message}`);
		return json({ ok: false, error: 'Could not remove it. Try again in a moment.' }, { status: 500 });
	}
};
