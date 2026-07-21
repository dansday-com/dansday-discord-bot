import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicServerPath } from '$lib/url.js';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();
	redirect(303, `${publicServerPath(server.slug)}/account/overview/information/${params.hash}`);
};
