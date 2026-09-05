import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { listPublicServerSlugs } from '$lib/frontend/public/server-slug/index.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';
import { TERMS_URL, PRIVACY_URL } from '$lib/legal.js';

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

	const root = `${baseUrl.replace(/\/$/, '')}/server`;

	const publicPageRows = servers.flatMap((s) => {
		const enc = encodeURIComponent(String(s.slug));
		const base = { lastmod: toLastmod(s.updated_at), changefreq: 'hourly' as const, priority: 0.8 };
		return [
			{ loc: `${root}/${enc}`, ...base },
			{ loc: `${root}/${enc}/leaderboard`, ...base },
			{ loc: `${root}/${enc}/members`, ...base }
		];
	});

	const staticPages = [
		{ loc: `${baseUrl}/`, changefreq: 'weekly' as const, priority: 1.0, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/servers`, changefreq: 'daily' as const, priority: 0.9, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/tasks`, changefreq: 'weekly' as const, priority: 0.8, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/items`, changefreq: 'daily' as const, priority: 0.8, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/quests`, changefreq: 'daily' as const, priority: 0.9, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/roblox`, changefreq: 'daily' as const, priority: 0.9, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/docs`, changefreq: 'monthly' as const, priority: 0.7, lastmod: new Date().toISOString() },
		{ loc: TERMS_URL, changefreq: 'monthly' as const, priority: 0.5, lastmod: new Date().toISOString() },
		{ loc: PRIVACY_URL, changefreq: 'monthly' as const, priority: 0.5, lastmod: new Date().toISOString() }
	];

	const allUrlData = [...staticPages, ...publicPageRows];

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
