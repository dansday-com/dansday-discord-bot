import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { listEnabledLeaderboardSlugs } from '$lib/leaderboard/index.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';

function escapeXml(unsafe: string): string {
	return unsafe.replace(
		/[&<"'>]/g,
		(match) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'"': '&quot;',
				"'": '&apos;',
				'>': '&gt;'
			})[match] || match
	);
}

export const GET: RequestHandler = async () => {
	const baseUrl = env.BASE_URL;
	if (!baseUrl) {
		return new Response('BASE_URL environment variable is not set', { status: 503 });
	}

	const servers = await listEnabledLeaderboardSlugs();

	const toLastmod = (d: unknown) => {
		try {
			const dt = d instanceof Date ? d : parseMySQLDateTimeUtc(d);
			if (!dt || Number.isNaN(dt.getTime())) return undefined;
			return dt.toISOString();
		} catch {
			return undefined;
		}
	};

	const leaderboardUrlData = servers
		.filter((s: { slug?: string }) => s.slug)
		.map((s: { slug: string; updated_at?: unknown }) => {
			const loc = `${baseUrl}/${encodeURIComponent(String(s.slug))}/leaderboard`;
			const lastmod = toLastmod(s.updated_at);
			return { loc, lastmod, changefreq: 'weekly' as const, priority: 0.8 };
		});

	const allUrlData = [{ loc: `${baseUrl}/`, changefreq: 'daily' as const, priority: 1.0, lastmod: new Date().toISOString() }, ...leaderboardUrlData];

	const urlElements = allUrlData
		.map(({ loc, lastmod, changefreq, priority }) => {
			const lastmodElement = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
			return `
    <url>
      <loc>${escapeXml(loc)}</loc>${lastmodElement}
      <changefreq>${changefreq}</changefreq>
      <priority>${priority.toFixed(1)}</priority>
    </url>`;
		})
		.join('');

	return new Response(
		`<?xml version="1.0" encoding="UTF-8" ?>
		<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
			${urlElements}
		</urlset>`.trim(),
		{
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'max-age=3600'
			}
		}
	);
};
