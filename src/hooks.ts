import type { Reroute } from '@sveltejs/kit';
import { publicServerPath, publicServerSlugFromHost } from '$lib/url.js';

const SERVER_SUBPATHS = ['leaderboard', 'members', 'account'];

export const reroute: Reroute = ({ url }) => {
	const slug = publicServerSlugFromHost(url.hostname);
	if (!slug) return;

	const pathname = url.pathname.replace(/\/+$/, '');
	if (pathname === '') return publicServerPath(slug);

	const head = pathname.slice(1).split('/')[0];
	if (!SERVER_SUBPATHS.includes(head)) return;

	return publicServerPath(slug) + pathname;
};
