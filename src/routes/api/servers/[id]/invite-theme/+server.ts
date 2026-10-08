import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { SERVER_SETTINGS, canEditServerSettings } from '$lib/backend/panelServer.js';
import { MEMBER_THEME_MAX_BYTES } from '$lib/images.js';
import { readUploadedImage } from '$lib/backend/storage/imageUpload.js';
import { themeImageToWebp } from '$lib/backend/storage/imageConvert.js';
import { removeServerTheme, saveServerTheme, serverThemeFilename, serverThemeKey, serverThemeUrl } from '$lib/backend/storage/serverThemes.js';
import { panelActorIds } from '$lib/frontend/panelGuards.server.js';
import { normalizeAccent } from '$lib/themes.js';

async function readPublicSettings(serverId: number): Promise<Record<string, any>> {
	const row = await db.getServerSettings(serverId, SERVER_SETTINGS.component.public).catch(() => null);
	const settings = (row as any)?.settings;
	return settings && typeof settings === 'object' && !Array.isArray(settings) ? { ...settings } : {};
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!(await canEditServerSettings(locals, serverId))) return json({ success: false, error: 'Access denied' }, { status: 403 });

	try {
		const upload = await readUploadedImage(request, MEMBER_THEME_MAX_BYTES);
		if (!upload.ok) return json({ success: false, error: upload.error }, { status: upload.status });

		const converted = await themeImageToWebp(upload.data, upload.extension);
		const key = serverThemeKey(serverId, serverThemeFilename(converted.extension));
		await saveServerTheme(key, converted.data);

		const settings = await readPublicSettings(serverId);
		const previous = settings.invite_theme_image ?? null;
		const accent = normalizeAccent(upload.form?.get('accent'));
		const next = { ...settings, invite_theme_image: key, ...(accent ? { invite_theme_accent: accent } : {}) };
		await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.public, next);
		if (previous && previous !== key) await removeServerTheme(previous);

		await db
			.createServerPanelLog(serverId, panelActorIds(locals), SERVER_SETTINGS.component.public, [
				{ key: 'invite page background', before: previous ? 'image' : null, after: 'new image' },
				...(accent && accent !== settings.invite_theme_accent ? [{ key: 'invite page tone', before: settings.invite_theme_accent ?? null, after: accent }] : [])
			])
			.catch(() => null);

		return json({ success: true, key, image: serverThemeUrl(key), accent: next.invite_theme_accent ?? null });
	} catch (error: any) {
		logger.log(`❌ Error saving invite page background: ${error.message}`);
		return json({ success: false, error: 'Could not save the background.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const serverId = Number(params.id);
	if (!(await canEditServerSettings(locals, serverId))) return json({ success: false, error: 'Access denied' }, { status: 403 });

	const settings = await readPublicSettings(serverId);
	const previous = settings.invite_theme_image ?? null;
	if (!previous) return json({ success: true });

	delete settings.invite_theme_image;
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.public, settings);
	await removeServerTheme(previous);
	await db
		.createServerPanelLog(serverId, panelActorIds(locals), SERVER_SETTINGS.component.public, [{ key: 'invite page background', before: 'image', after: null }])
		.catch(() => null);
	return json({ success: true });
};
