import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) {
		redirect(302, '/login');
	}
	const [row, mainRow] = await Promise.all([
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.staff_rating).catch(() => null),
		db.getServerSettings(params.serverId, SERVER_SETTINGS.component.main).catch(() => null)
	]);
	const raw = (row?.settings ?? {}) as {
		enabled?: boolean;
		cooldown_days?: number;
		review_channel_id?: string;
		report_channel_id?: string;
		rating_channel_id?: string;
		pending_role?: string;
	};
	const settings = {
		...raw,
		review_channel_id: raw.review_channel_id ?? raw.report_channel_id ?? ''
	};
	const staffRoleIds = (mainRow?.settings?.staff_roles ?? []) as string[];
	return { settings, staffRolesConfigured: staffRoleIds.filter(Boolean).length > 0 };
};
