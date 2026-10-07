import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/utils/index.js';
import { canEditServerSettings } from '$lib/frontend/panelServer.js';
import { REWARD_IMAGE_MAX_BYTES } from '$lib/rewards.js';
import { readUploadedImage } from '$lib/backend/storage/imageUpload.js';
import { themeImageToWebp } from '$lib/backend/storage/imageConvert.js';
import { rewardImageFilename, rewardImageKey, rewardImageUrl, saveRewardImage } from '$lib/backend/storage/rewards.js';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const serverId = Number(params.id);
	if (!(await canEditServerSettings(locals, serverId))) return json({ ok: false, error: 'Access denied' }, { status: 403 });

	try {
		const upload = await readUploadedImage(request, REWARD_IMAGE_MAX_BYTES);
		if (!upload.ok) return json({ ok: false, error: upload.error }, { status: upload.status });

		const converted = await themeImageToWebp(upload.data, upload.extension);
		const key = rewardImageKey(serverId, rewardImageFilename(converted.extension));
		await saveRewardImage(key, converted.data);
		return json({ ok: true, key, url: rewardImageUrl(key) });
	} catch (error: any) {
		logger.log(`❌ Error saving reward image: ${error.message}`);
		return json({ ok: false, error: 'Could not save the image.' }, { status: 500 });
	}
};
