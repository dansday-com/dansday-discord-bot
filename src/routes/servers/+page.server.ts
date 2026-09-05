import type { PageServerLoad } from './$types';
import { resolveServerDirectory, EMPTY_DIRECTORY } from '$lib/frontend/public/statistics/directory.js';

export const load: PageServerLoad = async () => {
	let directory = EMPTY_DIRECTORY;
	try {
		directory = await resolveServerDirectory();
	} catch (_) {}

	return { entries: directory.entries, totals: directory.totals };
};
