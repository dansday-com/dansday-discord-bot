import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { GLOBAL_MENTION_GROUPS, globalPanelAccess, sendGlobalMessage } from '$lib/frontend/globalMessages.server.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	const { panelId } = access;
	const messageId = parseInt(params.messageId ?? '');
	if (isNaN(messageId)) return json({ ok: false, error: 'Invalid message ID' }, { status: 400 });

	try {
		const message = await db.getGlobalMessage(panelId, messageId);
		if (!message) return json({ ok: false, error: 'That message no longer exists. It may have been deleted.' }, { status: 404 });

		const body = await request.json().catch(() => null);
		const groups = (Array.isArray(body?.mention_groups) ? body.mention_groups : []).filter((group: unknown) =>
			(GLOBAL_MENTION_GROUPS as readonly unknown[]).includes(group)
		);

		const out = await sendGlobalMessage(locals, panelId, message, groups);
		if (out.bots === 0) return json({ ok: false, error: 'There are no bots yet. Add one first.' }, { status: 400 });
		if (out.offline === out.bots) return json({ ok: false, error: 'Every bot is offline. Start one, then try again.' }, { status: 400 });
		if (out.sent === 0) {
			const reason = out.failed[0] ?? 'No server has a Bot Updates Channel set. Each server picks one on its Main page, and /setup creates it automatically.';
			return json({ ok: false, error: reason, ...out }, { status: 400 });
		}
		logger.log(`${locals.user.authenticated ? locals.user.username : 'Someone'} sent global message "${message.name}" to ${out.sent} server(s)`);
		return json({ ok: true, ...out });
	} catch (error: any) {
		logger.log(`❌ Error sending global message: ${error.message}`);
		return json({ ok: false, error: 'Could not send the message. Try again in a moment.' }, { status: 500 });
	}
};
