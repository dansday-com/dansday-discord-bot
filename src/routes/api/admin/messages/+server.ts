import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { MAX_SAVED_MESSAGES, MESSAGE_LIMITS, messageDocProblems, messageShownIds, normalizeMessageDoc } from '$lib/messages.js';
import { messageFileBelongsTo } from '$lib/backend/storage/messageFiles.js';
import { globalPanelAccess, pruneGlobalMessageFiles } from '$lib/frontend/globalMessages.server.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	const { panelId } = access;

	const body = await request.json().catch(() => null);
	const name = String(body?.name ?? '')
		.trim()
		.slice(0, MESSAGE_LIMITS.name);
	if (!name) return json({ ok: false, error: 'Give the message a name so you can find it later.' }, { status: 400 });

	const messageId = body?.id == null ? null : Math.trunc(Number(body.id));
	if (messageId !== null && !(messageId > 0)) return json({ ok: false, error: 'Invalid message ID' }, { status: 400 });

	const content = normalizeMessageDoc(body?.content, (key) => messageFileBelongsTo(key, { scope: 'global', id: panelId }), 'global');
	const problems = messageDocProblems(content);
	if (problems.length > 0) return json({ ok: false, error: problems[0], problems }, { status: 400 });

	try {
		const existing = await db.getGlobalMessages(panelId);
		const previous = messageId === null ? null : (existing.find((m) => m.id === messageId) ?? null);
		if (messageId !== null && !previous) return json({ ok: false, error: 'That message no longer exists. It may have been deleted.' }, { status: 404 });
		if (messageId === null && existing.length >= MAX_SAVED_MESSAGES) {
			return json({ ok: false, error: `You can keep ${MAX_SAVED_MESSAGES} global messages. Delete one you no longer use first.` }, { status: 400 });
		}
		const known = new Set(existing.map((m) => m.id));
		if (messageShownIds(content).some((id) => !known.has(id))) {
			return json({ ok: false, error: 'A button or dropdown shows a message that no longer exists. Pick another one for it.' }, { status: 400 });
		}

		const id = await db.saveGlobalMessage(panelId, messageId, name, content);
		if (id === null) return json({ ok: false, error: 'Could not save the message. Try again.' }, { status: 500 });
		await pruneGlobalMessageFiles(panelId);
		logger.log(`${locals.user.authenticated ? locals.user.username : 'Someone'} saved global message "${name}"`);
		return json({ ok: true, id });
	} catch (error: any) {
		logger.log(`❌ Error saving global message: ${error.message}`);
		return json({ ok: false, error: 'Could not save the message. Try again in a moment.' }, { status: 500 });
	}
};
