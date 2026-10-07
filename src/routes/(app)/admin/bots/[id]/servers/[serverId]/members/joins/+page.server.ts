import type { PageServerLoad } from './$types';
import db from '$lib/database.js';

const JOIN_LIMIT = 300;

export const load: PageServerLoad = async ({ params, parent }) => {
	await parent();
	const joins = await db.getServerInviteJoins(Number(params.serverId), JOIN_LIMIT).catch(() => []);

	return {
		joinLimit: JOIN_LIMIT,
		joins: (joins as any[]).map((j) => ({
			id: String(j.id),
			discord_member_id: String(j.discord_member_id),
			name: (j.name ?? null) as string | null,
			avatar: (j.avatar ?? null) as string | null,
			inviter_name: (j.inviter_name ?? null) as string | null,
			code: (j.code ?? null) as string | null,
			source: String(j.source ?? 'unknown'),
			fake_reason: (j.fake_reason ?? null) as string | null,
			status: String(j.status),
			joined_at: j.joined_at ?? j.created_at
		}))
	};
};
