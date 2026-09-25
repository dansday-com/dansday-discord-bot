import type { Reroute } from '@sveltejs/kit';
import { isPublicServerSubpath, publicServerPath, publicServerSlugFromHost } from '$lib/url.js';

export const reroute: Reroute = ({ url }) => {
	const slug = publicServerSlugFromHost(url.hostname);
	if (!slug) return;

	if (!isPublicServerSubpath(url.pathname)) return;

	const pathname = url.pathname.replace(/\/+$/, '');
	return publicServerPath(slug) + pathname;
};
