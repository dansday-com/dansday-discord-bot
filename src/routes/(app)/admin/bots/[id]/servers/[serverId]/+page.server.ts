import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	await parent();
	const invites = await db.getServerInviteStats(params.serverId).catch(() => null);
	return { invites };
};
