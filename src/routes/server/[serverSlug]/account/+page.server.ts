import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { server } = await parent();
	return { server };
};
