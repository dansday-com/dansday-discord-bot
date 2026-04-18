import { createHash } from 'crypto';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();

	const settingsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.public_statistics);
	const settings = (settingsRow as any)?.settings || {};
	if (settings.enabled === false) throw error(404, 'Not found');

	const members = await db.getServerMembersList(server.id);

	const membersWithTokens = (members ?? []).map((m: any) => {
		const dt = parseMySQLDateTimeUtc(m.member_since);
		const joinedDate = dt ? dt.toISOString().split('T')[0] : '';
		const cardToken = createHash('sha256').update(`${m.discord_member_id}_${joinedDate}`).digest('hex').substring(0, 16);
		return { ...m, cardToken };
	});

	return { members: membersWithTokens };
};
