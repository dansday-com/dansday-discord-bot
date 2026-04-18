import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { DEFAULT_LEVELING_SETTINGS } from '$lib/backend/config.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user.authenticated) redirect(302, '/login');
	const row = await db.getServerSettings(params.serverId, SERVER_SETTINGS.component.leveling).catch(() => ({}));
	const settings = row?.settings && typeof row.settings === 'object' ? row.settings : {};

	const req = settings.REQUIREMENTS || DEFAULT_LEVELING_SETTINGS.REQUIREMENTS;
	const msg = settings.MESSAGE || DEFAULT_LEVELING_SETTINGS.MESSAGE;
	const voi = settings.VOICE || DEFAULT_LEVELING_SETTINGS.VOICE;
	const videoCfg = settings.VIDEO || DEFAULT_LEVELING_SETTINGS.VIDEO;
	const streamCfg = settings.STREAMING || DEFAULT_LEVELING_SETTINGS.STREAMING;

	const mergedSettings = {
		...settings,
		REQUIREMENTS: {
			BASE_XP: req.BASE_XP ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.BASE_XP,
			MULTIPLIER: req.MULTIPLIER ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.MULTIPLIER
		},
		MESSAGE: {
			XP: msg.XP ?? DEFAULT_LEVELING_SETTINGS.MESSAGE.XP,
			COOLDOWN_SECONDS: msg.COOLDOWN_SECONDS ?? DEFAULT_LEVELING_SETTINGS.MESSAGE.COOLDOWN_SECONDS
		},
		VOICE: {
			XP_PER_MINUTE: voi.XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.VOICE.XP_PER_MINUTE,
			AFK_XP_PER_MINUTE: voi.AFK_XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.VOICE.AFK_XP_PER_MINUTE,
			COOLDOWN_SECONDS: voi.COOLDOWN_SECONDS ?? DEFAULT_LEVELING_SETTINGS.VOICE.COOLDOWN_SECONDS
		},
		VIDEO: {
			XP_PER_MINUTE: videoCfg?.XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.VIDEO.XP_PER_MINUTE
		},
		STREAMING: {
			XP_PER_MINUTE: streamCfg?.XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.STREAMING.XP_PER_MINUTE
		}
	};

	return { settings: mergedSettings };
};
