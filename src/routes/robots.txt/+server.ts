import type { RequestHandler } from './$types';
import { APP_URL } from '$lib/frontend/panelServer.js';

export const GET: RequestHandler = async () => {
	const baseUrl = APP_URL;
	return new Response(
		`User-Agent: *
Allow: /
Disallow: /server/*/account
Disallow: /api/

Host: ${baseUrl}
Sitemap: ${baseUrl}/sitemap.xml`,
		{
			headers: {
				'Content-Type': 'text/plain'
			}
		}
	);
};
