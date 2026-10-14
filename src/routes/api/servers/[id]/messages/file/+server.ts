import type { RequestHandler } from '@sveltejs/kit';
import { messageUploadLimit } from '$lib/messages.js';
import { receiveMessageUpload } from '$lib/frontend/messageFiles.server.js';
import { messagePanelAccess, pruneMessageFiles } from '$lib/frontend/serverMessages.server.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const access = await messagePanelAccess(locals, params.id);
	if (access instanceof Response) {
		return access;
	}
	return receiveMessageUpload(
		request,
		{ scope: 'server', id: access.serverId },
		{
			limit: messageUploadLimit(access.server.boost_level),
			tooLarge: "Discord sets it from this server's boost level.",
			pruneUnused: () => pruneMessageFiles(access.serverId)
		}
	);
};
