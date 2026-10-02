import type { RequestHandler } from './$types';
import { listPublicServerSlugs } from '$lib/frontend/public/server-slug/index.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';
import { TERMS_URL, PRIVACY_URL, LEGAL_LAST_UPDATED } from '$lib/legal.js';
import { APP_URL } from '$lib/frontend/panelServer.js';
import db from '$lib/database.js';
import { inviteJoinPath } from '$lib/invites.js';

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
	const baseUrl = APP_URL;

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

	const root = `${baseUrl}/server`;

	const publicPageRows = servers.flatMap((s) => {
		const enc = encodeURIComponent(String(s.slug));
		const base = { lastmod: toLastmod(s.updated_at), changefreq: 'hourly' as const, priority: 0.8 };
		return [
			{ loc: `${root}/${enc}`, ...base },
			{ loc: `${root}/${enc}/leaderboard`, ...base },
			{ loc: `${root}/${enc}/members`, ...base }
		];
	});

	const inviteSlugs = await db.listInviteSlugsForServers(servers.map((s) => Number(s.id))).catch(() => []);
	const serverJoinRows = servers.map((s) => ({
		loc: `${baseUrl}${inviteJoinPath(String(s.slug))}`,
		lastmod: toLastmod(s.updated_at),
		changefreq: 'weekly' as const,
		priority: 0.7
	}));
	const joinRows = inviteSlugs.map((i) => ({
		loc: `${baseUrl}${inviteJoinPath(i.slug)}`,
		lastmod: toLastmod(i.created_at),
		changefreq: 'weekly' as const,
		priority: 0.6
	}));

	const newestServer = publicPageRows.reduce<string | undefined>((max, r) => (r.lastmod && (!max || r.lastmod > max) ? r.lastmod : max), undefined);
	const legalLastmod = toLastmod(new Date(`${LEGAL_LAST_UPDATED} UTC`));

	const staticPages = [
		{ loc: `${baseUrl}/`, changefreq: 'weekly' as const, priority: 1.0, lastmod: newestServer },
		{ loc: `${baseUrl}/servers`, changefreq: 'daily' as const, priority: 0.9, lastmod: newestServer },
		{ loc: `${baseUrl}/tasks`, changefreq: 'weekly' as const, priority: 0.8 },
		{ loc: `${baseUrl}/shop`, changefreq: 'daily' as const, priority: 0.8 },
		{ loc: `${baseUrl}/quests`, changefreq: 'daily' as const, priority: 0.9 },
		{ loc: `${baseUrl}/roblox`, changefreq: 'daily' as const, priority: 0.9 },
		{ loc: `${baseUrl}/wikis`, changefreq: 'weekly' as const, priority: 0.8 },
		{ loc: `${baseUrl}/forwarder-servers`, changefreq: 'daily' as const, priority: 0.9 },
		{ loc: `${baseUrl}/docs`, changefreq: 'monthly' as const, priority: 0.7 },
		{ loc: TERMS_URL, changefreq: 'monthly' as const, priority: 0.5, lastmod: legalLastmod },
		{ loc: PRIVACY_URL, changefreq: 'monthly' as const, priority: 0.5, lastmod: legalLastmod }
	];

	const allUrlData: { loc: string; changefreq: string; priority: number; lastmod?: string }[] = [
		...staticPages,
		...publicPageRows,
		...serverJoinRows,
		...joinRows
	];

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
		<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
			${urlElements}
		</urlset>`.trim(),
		{
			headers: {
				'Content-Type': 'application/xml'
			}
		}
	);
};
