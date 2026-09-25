import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { stopBotById } from '$lib/botProcesses.js';
import { logger } from '$lib/utils/index.js';
import { canManagePanelSelfbots } from '$lib/frontend/panelServer.js';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user.authenticated) return json({ success: false, error: 'Authentication required' }, { status: 401 });

	const selfbotId = Number(params.id);
	if (!Number.isFinite(selfbotId)) return json({ success: false, error: 'Invalid id' }, { status: 400 });

	try {
		if (!(await canManagePanelSelfbots(locals, selfbotId))) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		const selfbot = await db.getServerBotById(selfbotId);
		if (!selfbot) return json({ success: false, error: 'Bot not found' }, { status: 404 });

		const result = await stopBotById(selfbot.id, selfbot);
		if (result.success) logger.log(`${locals.user.username} stopped selfbot "${selfbot.name}" (ID: ${selfbot.id})`);
		return json(result);
	} catch (error: any) {
		return json({ success: false, error: error.message }, { status: 500 });
	}
};
