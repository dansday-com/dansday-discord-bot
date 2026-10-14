import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apexHome } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/backend/public/items/index.js';
import { loadTasksShared } from '$lib/backend/public/tasks/index.js';
import { HTTP } from '$lib/http.js';
import { MINUTES_PER_HOUR } from '$lib/utils/time.js';

const MAX_TZ_OFFSET_HOURS = 14;
const MAX_TZ_OFFSET_MINUTES = MAX_TZ_OFFSET_HOURS * MINUTES_PER_HOUR;

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const {
		server,
		serverBasePath,
		itemsEnabled: areItemsEnabled,
		minigamesEnabled: areMinigamesEnabled,
		marketEnabled: isMarketEnabled,
		tasksEnabled: areTasksEnabled
	} = await parent();

	if (!areTasksEnabled) {
		return { featureDisabled: true, hash: itemsCardTokenFromUrl(params.hash), tasks: null };
	}

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) {
		redirect(HTTP.SEE_OTHER, apexHome());
	}
	if ('guest' in shared || !shared.member) {
		redirect(HTTP.SEE_OTHER, serverBasePath || '/');
	}

	const rawTz = cookies.get('tz_offset');
	const isTzKnown = rawTz != null && rawTz !== '' && Number.isFinite(Number(rawTz));
	const tzOffsetMin = isTzKnown ? Math.max(-MAX_TZ_OFFSET_MINUTES, Math.min(MAX_TZ_OFFSET_MINUTES, Number(rawTz))) : 0;

	const tasks = await loadTasksShared({
		server,
		member: shared.member,
		itemsEnabled: areItemsEnabled === true,
		minigamesEnabled: areMinigamesEnabled === true,
		marketEnabled: isMarketEnabled === true,
		tzOffsetMin,
		tzKnown: isTzKnown
	});

	return { ...shared, tasks };
};
