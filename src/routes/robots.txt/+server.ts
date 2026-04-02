import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const body = `User-agent: *
Allow: /

Sitemap: /sitemap.xml
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
