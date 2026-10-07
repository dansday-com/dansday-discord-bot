import type { RequestHandler } from '@sveltejs/kit';
import { messageUploadLimit } from '$lib/messages.js';
import { receiveMessageUpload } from '$lib/frontend/messageFiles.server.js';
import { globalPanelAccess } from '$lib/frontend/globalMessages.server.js';

export const POST: RequestHandler = async ({ locals, request }) => {
	const access = globalPanelAccess(locals);
	if (access instanceof Response) return access;
	return receiveMessageUpload(
		request,
		{ scope: 'global', id: access.panelId },
		messageUploadLimit(0),
		'A global message goes to every server, so it has to fit the limit of a server without boosts.'
	);
};
