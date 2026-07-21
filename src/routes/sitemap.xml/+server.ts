import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { listPublicServerSlugs } from '$lib/frontend/public/server-slug/index.js';
import { loadItemsCatalog } from '$lib/frontend/public/items/index.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';
import { ITEM_EFFECTS } from '$lib/items.js';

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

	const visibleServers = servers.filter((s) => s.slug);

	const categoriesByServer = new Map<number, string[]>();
	await Promise.all(
		visibleServers
			.filter((s) => s.items_enabled)
			.map(async (s) => {
				const catalog = await loadItemsCatalog(Number(s.id)).catch(() => []);
				const present = [...new Set((catalog as any[]).filter((i) => i.enabled !== false || i.live).map((i) => i.effect_type))].filter((t) =>
					ITEM_EFFECTS.some((e) => e.id === t)
				);
				categoriesByServer.set(Number(s.id), present);
			})
	);

	const publicPageRows = visibleServers.flatMap((s) => {
		const enc = encodeURIComponent(String(s.slug));
		const lastmod = toLastmod(s.updated_at);
		const base = { lastmod, changefreq: 'hourly' as const, priority: 0.8 };
		const root = `${baseUrl.replace(/\/$/, '')}/server`;
		const urls: { loc: string; lastmod: string | undefined; changefreq: 'hourly'; priority: number }[] = [
			{ loc: `${root}/${enc}`, ...base },
			{ loc: `${root}/${enc}/leaderboard`, ...base },
			{ loc: `${root}/${enc}/members`, ...base }
		];
		const accountEnabled = s.items_enabled || s.assets_enabled || s.minigames_enabled;
		if (accountEnabled) {
			const accountBase = `${root}/${enc}/account`;
			urls.push({ loc: accountBase, ...base, priority: 0.7 });
			urls.push({ loc: `${accountBase}/guide/guest`, ...base, priority: 0.7 });
			if (s.items_enabled) {
				const presentCategories = categoriesByServer.get(Number(s.id)) ?? [];
				urls.push({ loc: `${accountBase}/items/all/guest`, ...base, priority: 0.6 });
				for (const cat of presentCategories) {
					urls.push({ loc: `${accountBase}/items/${cat}/guest`, ...base, priority: 0.6 });
				}
			}
			if (s.assets_enabled) {
				for (const view of ['top', 'gainers', 'losers']) {
					urls.push({ loc: `${accountBase}/assets/${view}/guest`, ...base, priority: 0.6 });
				}
			}
			if (s.minigames_enabled) {
				urls.push({ loc: `${accountBase}/minigames/all/guest`, ...base, priority: 0.6 });
				urls.push({ loc: `${accountBase}/minigames/gamble/guest`, ...base, priority: 0.6 });
			}
		}
		return urls;
	});

	const staticPages = [
		{ loc: `${baseUrl}/`, changefreq: 'weekly' as const, priority: 1.0, lastmod: new Date().toISOString() },
		{ loc: `${baseUrl.replace(/\/$/, '')}/docs`, changefreq: 'monthly' as const, priority: 0.7, lastmod: new Date().toISOString() }
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
