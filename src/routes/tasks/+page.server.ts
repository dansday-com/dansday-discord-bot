import type { PageServerLoad } from './$types';
import { resolveTaskDirectory, EMPTY_TASKS } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let tasks = EMPTY_TASKS;
	try {
		tasks = resolveTaskDirectory();
	} catch (_) {}
	return { tasks };
};
