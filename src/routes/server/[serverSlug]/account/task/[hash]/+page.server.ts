import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadTasksShared } from '$lib/frontend/public/tasks/index.js';

export const load: PageServerLoad = async ({ parent, params, cookies }) => {
	const { server, itemsEnabled, minigamesEnabled, assetsEnabled, tasksEnabled } = await parent();

	if (!tasksEnabled) return { featureDisabled: true, server, hash: itemsCardTokenFromUrl(params.hash), tasks: null };

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, '/');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const rawTz = cookies.get('tz_offset');
	const knownTz = rawTz != null && rawTz !== '' && Number.isFinite(Number(rawTz));
	const tzOffsetMin = knownTz ? Math.max(-840, Math.min(840, Number(rawTz))) : 0;

	const tasks = await loadTasksShared({
		server,
		member: shared.member,
		itemsEnabled: itemsEnabled === true,
		minigamesEnabled: minigamesEnabled === true,
		assetsEnabled: assetsEnabled === true,
		tzOffsetMin,
		generate: knownTz,
		tzKnown: knownTz
	});

	return { ...shared, tasks };
};
