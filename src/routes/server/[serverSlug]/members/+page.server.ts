import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();

	const disguisedIds = new Set((await db.getDisguisedMemberIds(server.id).catch(() => [])).map((n: number) => Number(n)));
	const members = (await db.getServerMembersList(server.id)).filter((m: any) => !disguisedIds.has(Number(m.id)));

	return { members: members ?? [] };
};
