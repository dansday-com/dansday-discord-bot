import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import {
	MAX_SAVED_MESSAGES,
	MESSAGE_LIMITS,
	isSelfAssignableRole,
	messageDocProblems,
	messageRoleIds,
	messageShownIds,
	normalizeMessageDoc
} from '$lib/messages.js';
import { messageFileBelongsTo } from '$lib/backend/storage/messageFiles.js';
import { logMessageAction, messagePanelAccess, pruneMessageFiles, syncMessagePosts } from '$lib/frontend/serverMessages.server.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const access = await messagePanelAccess(locals, params.id);
	if (access instanceof Response) return access;
	const { serverId, server } = access;

	const body = await request.json().catch(() => null);
	const name = String(body?.name ?? '')
		.trim()
		.slice(0, MESSAGE_LIMITS.name);
	if (!name) return json({ ok: false, error: 'Give the message a name so you can find it later.' }, { status: 400 });

	const messageId = body?.id == null ? null : Math.trunc(Number(body.id));
	if (messageId !== null && !(messageId > 0)) return json({ ok: false, error: 'Invalid message ID' }, { status: 400 });

	const content = normalizeMessageDoc(body?.content, (key) => messageFileBelongsTo(key, { scope: 'server', id: serverId }));
	const problems = messageDocProblems(content);
	if (problems.length > 0) return json({ ok: false, error: problems[0], problems }, { status: 400 });

	try {
		const existing = await db.getServerMessages(serverId);
		const previous = messageId === null ? null : (existing.find((m) => m.id === messageId) ?? null);
		if (messageId !== null && !previous) return json({ ok: false, error: 'That message no longer exists. It may have been deleted.' }, { status: 404 });
		if (messageId === null && existing.length >= MAX_SAVED_MESSAGES) {
			return json({ ok: false, error: `A server can keep ${MAX_SAVED_MESSAGES} messages. Delete one you no longer use first.` }, { status: 400 });
		}

		const known = new Set(existing.map((m) => m.id));
		if (messageShownIds(content).some((id) => !known.has(id))) {
			return json({ ok: false, error: 'A button or dropdown shows a message that no longer exists. Pick another one for it.' }, { status: 400 });
		}
		const roles = await db.getRoles(serverId).catch(() => []);
		const roleById = new Map(
			(roles as any[]).filter((r) => String(r.discord_role_id) !== String(server.discord_server_id)).map((r) => [String(r.discord_role_id), r])
		);
		const usedRoles = messageRoleIds(content);
		if (usedRoles.some((id) => !roleById.has(id))) {
			return json({ ok: false, error: 'A button or dropdown uses a role that no longer exists. Pick another role for it.' }, { status: 400 });
		}
		const unsafe = usedRoles.map((id) => roleById.get(id)).find((role) => !isSelfAssignableRole(role.permissions));
		if (unsafe) {
			return json(
				{
					ok: false,
					error: `@${unsafe.name} can moderate or manage the server, so a button can't hand it out to whoever clicks. Pick a role without those permissions.`
				},
				{ status: 400 }
			);
		}

		const id = await db.saveServerMessage(serverId, messageId, name, content);
		if (id === null) return json({ ok: false, error: 'Could not save the message. Try again.' }, { status: 500 });
		await pruneMessageFiles(serverId);

		const posts = previous ? await syncMessagePosts(server, id) : { running: true, updated: [], removed: 0, failed: [] };
		await logMessageAction(locals, serverId, 'message_saved', [
			{ key: previous ? 'message edited' : 'message created', before: previous && previous.name !== name ? previous.name : null, after: name },
			...(posts.updated.length > 0 ? [{ key: 'posted copies updated', before: null, after: posts.updated.join(', ') }] : [])
		]);
		logger.log(`${locals.user.authenticated ? locals.user.username : 'Someone'} saved message "${name}" on server "${server.name || serverId}"`);

		return json({ ok: true, id, posts: { running: posts.running, updated: posts.updated.length, removed: posts.removed, failed: posts.failed } });
	} catch (error: any) {
		logger.log(`❌ Error saving message: ${error.message}`);
		return json({ ok: false, error: 'Could not save the message. Try again in a moment.' }, { status: 500 });
	}
};
