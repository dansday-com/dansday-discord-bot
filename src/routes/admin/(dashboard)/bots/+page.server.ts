import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return {
		bots: parentData.bots || [],
		user: parentData.user
	};
};
