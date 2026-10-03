import type { PageServerLoad } from './$types';
import { resolveForwarderSourceDirectory, EMPTY_FORWARDER_SOURCES } from '$lib/frontend/public/catalog/index.js';

export const load: PageServerLoad = async () => {
	let sources = EMPTY_FORWARDER_SOURCES;
	try {
		sources = await resolveForwarderSourceDirectory();
	} catch (_) {}
	return { sources };
};
