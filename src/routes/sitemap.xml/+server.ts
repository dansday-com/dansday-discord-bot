import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { listPublicServerSlugs } from '$lib/frontend/public/server-slug/index.js';
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

	const servers = await listPublicServerSlugs();

	const toLastmod = (d: unknown) => {
		try {
			const dt = d instanceof Date ? d : parseMySQLDateTimeUtc(d);
			if (!dt || Number.isNaN(dt.getTime())) return undefined;
			return dt.toISOString();
		} catch {
			return undefined;
		}
	};

	const publicPageRows = servers
		.filter((s: { slug?: string }) => s.slug)
		.flatMap((s: { slug: string; updated_at?: unknown }) => {
			const enc = encodeURIComponent(String(s.slug));
			const lastmod = toLastmod(s.updated_at);
			const base = { lastmod, changefreq: 'hourly' as const, priority: 0.8 as const };
			const root = `${baseUrl.replace(/\/$/, '')}/server`;
			return [
				{ loc: `${root}/${enc}`, ...base },
				{ loc: `${root}/${enc}/leaderboard`, ...base },
				{ loc: `${root}/${enc}/members`, ...base }
			];
		});

	const allUrlData = [{ loc: `${baseUrl}/`, changefreq: 'weekly' as const, priority: 1.0, lastmod: new Date().toISOString() }, ...publicPageRows];

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
				'Content-Type': 'application/xml'
			}
		}
	);
};
