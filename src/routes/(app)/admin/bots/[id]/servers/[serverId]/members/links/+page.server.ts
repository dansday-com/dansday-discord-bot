import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

const CODE_LIMIT = 100;

export const load: PageServerLoad = async ({ params, parent }) => {
	await parent();
	const stats = await db.getServerInviteStats(Number(params.serverId), CODE_LIMIT).catch(() => null);

	return { links: stats?.codes ?? [] };
};
