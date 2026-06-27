import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const disguisedIds = new Set((await db.getDisguisedMemberIds(server.id).catch(() => [])).map((n: number) => Number(n)));
	const members = (await db.getServerMembersList(server.id)).filter((m: any) => !disguisedIds.has(Number(m.id)));

	return { members: members ?? [] };
};
