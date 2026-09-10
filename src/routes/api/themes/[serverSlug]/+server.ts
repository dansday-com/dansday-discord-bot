import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import db from '$lib/database.js';
import { logger } from '$lib/utils/index.js';
import { resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { resolveMemberByCardToken } from '$lib/frontend/public/items/index.js';
import { MEMBER_THEME_MAX_BYTES } from '$lib/images.js';
import { readUploadedImage, uploadFilename } from '$lib/backend/storage/imageUpload.js';
import { themeImageToWebp } from '$lib/backend/storage/imageConvert.js';
import { removeMemberTheme, saveMemberTheme } from '$lib/backend/storage/memberThemes.js';
import { normalizeAccent, resolveMemberTheme } from '$lib/themes.js';

async function resolveActor(serverSlug: string, card: any) {
	const resolved = await resolvePublicServerBySlug(String(serverSlug || '').trim());
	if (!resolved) return { error: 'Not found', status: 404 } as const;
	if (!card) return { error: 'Missing card', status: 400 } as const;
	const member = await resolveMemberByCardToken(resolved.server.id, String(card));
	if (!member) return { error: 'Member not found', status: 404 } as const;
	return { member } as const;
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const contentType = request.headers.get('content-type') || '';

		if (!contentType.includes('multipart/form-data')) {
			const body = await request.json().catch(() => null);
			if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });

			const actor = await resolveActor(params.serverSlug ?? '', body.card);
			if ('error' in actor) return json({ success: false, error: actor.error }, { status: actor.status });

			const accent = normalizeAccent(body.accent);
			if (!accent) return json({ success: false, error: 'Invalid colour' }, { status: 400 });

			const row = await db.setMemberTheme(actor.member.id, { accentColor: accent, accentAuto: body.accent_auto === true });
			return json({ success: true, theme: resolveMemberTheme(row) });
		}

		const upload = await readUploadedImage(request, MEMBER_THEME_MAX_BYTES);
		if (!upload.ok) return json({ success: false, error: upload.error }, { status: upload.status });

		const actor = await resolveActor(params.serverSlug ?? '', upload.form?.get('card'));
		if ('error' in actor) return json({ success: false, error: actor.error }, { status: actor.status });

		const accent = normalizeAccent(upload.form?.get('accent'));
		const previous = await db.getMemberTheme(actor.member.id).catch(() => null);

		const converted = await themeImageToWebp(upload.data, upload.extension);
		const filename = uploadFilename(String(actor.member.id), converted.extension);
		await saveMemberTheme(filename, converted.data);

		const row = await db.setMemberTheme(actor.member.id, {
			image: filename,
			...(accent ? { accentColor: accent, accentAuto: true } : {})
		});

		if (previous?.image && previous.image !== filename) await removeMemberTheme(previous.image);

		return json({ success: true, theme: resolveMemberTheme(row) });
	} catch (error: any) {
		logger.log(`❌ Error saving member theme: ${error.message}`);
		return json({ success: false, error: 'Could not save your theme.' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json().catch(() => null);
		if (!body) return json({ success: false, error: 'Invalid body' }, { status: 400 });

		const actor = await resolveActor(params.serverSlug ?? '', body.card);
		if ('error' in actor) return json({ success: false, error: actor.error }, { status: actor.status });

		const previous = await db.getMemberTheme(actor.member.id).catch(() => null);
		await db.clearMemberTheme(actor.member.id);
		if (previous?.image) await removeMemberTheme(previous.image);

		return json({ success: true, theme: null });
	} catch (error: any) {
		logger.log(`❌ Error clearing member theme: ${error.message}`);
		return json({ success: false, error: 'Could not reset your theme.' }, { status: 500 });
	}
};
