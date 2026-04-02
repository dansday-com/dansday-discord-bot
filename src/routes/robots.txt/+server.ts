import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const base = env.BASE_URL;
	const body = `User-agent: *
Allow: /

Host: ${base}
Sitemap: ${base}/sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
