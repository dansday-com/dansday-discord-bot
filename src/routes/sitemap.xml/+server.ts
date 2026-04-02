import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import { listEnabledLeaderboardSlugs } from '$lib/leaderboard/index.js';

function escapeXml(s: string) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	const base = env.BASE_URL;
	if (!base) return new Response('BASE_URL environment variable is not set', { status: 503 });
	const servers = await listEnabledLeaderboardSlugs();

	const lastmod = (d: any) => {
		try {
			const dt = d instanceof Date ? d : new Date(String(d).replace(' ', 'T'));
			if (Number.isNaN(dt.getTime())) return null;
			return dt.toISOString();
		} catch (_) {
			return null;
		}
	};

	const urls = servers
		.filter((s: any) => s.slug)
		.map((s: any) => {
			const lm = lastmod(s.updated_at);
			const loc = `${base}/${encodeURIComponent(String(s.slug))}/leaderboard`;
			return `  <url>
    <loc>${escapeXml(loc)}</loc>${lm ? `\n    <lastmod>${escapeXml(lm)}</lastmod>` : ''}
  </url>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	setHeaders({
		'Cache-Control': 'public, max-age=600, s-maxage=3600'
	});

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8'
		}
	});
};
