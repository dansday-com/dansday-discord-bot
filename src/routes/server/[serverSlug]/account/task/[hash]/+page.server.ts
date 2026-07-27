import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';
import { loadItemsShared, itemsCardTokenFromUrl } from '$lib/frontend/public/items/index.js';
import { loadTasksShared } from '$lib/frontend/public/tasks/index.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, accountEnabled, itemsEnabled, minigamesEnabled, tasksEnabled } = await parent();

	if (!accountEnabled) redirect(303, '/');
	if (!tasksEnabled) redirect(303, `${publicServerPath(server.slug)}/account/overview/${params.hash}`);

	const hash = itemsCardTokenFromUrl(params.hash);
	const shared = await loadItemsShared(server, hash, null);
	if ('notFound' in shared) redirect(303, '/');
	if ('guest' in shared || !shared.member) redirect(303, publicServerPath(server.slug));

	const tasks = await loadTasksShared({
		server,
		member: shared.member,
		itemsEnabled: itemsEnabled === true,
		minigamesEnabled: minigamesEnabled === true,
		tzOffsetMin: 0
	});

	return { ...shared, tasks };
};
