import type { RequestHandler } from './$types';
import { listPublicServerSlugs } from '$lib/backend/public/server-slug/index.js';
import { parseMySQLDateTimeUtc } from '$lib/utils/datetime.js';
import { TERMS_URL, PRIVACY_URL, LEGAL_LAST_UPDATED } from '$lib/legal.js';
import { APP_URL, SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import db from '$lib/database.js';
import { inviteJoinPath } from '$lib/invites.js';
import { attemptSync } from '$lib/utils/attempt.js';

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

type PublicServer = Awaited<ReturnType<typeof listPublicServerSlugs>>[number];
type UrlEntry = { loc: string; changefreq: string; priority: number; lastmod?: string };

function toLastmod(d: unknown) {
	const dt = attemptSync(() => (d instanceof Date ? d : parseMySQLDateTimeUtc(d)));
	return dt.ok && dt.value && !Number.isNaN(dt.value.getTime()) ? dt.value.toISOString() : undefined;
}

function publicPageRows(servers: PublicServer[]): UrlEntry[] {
	const root = `${APP_URL}/server`;
	return servers.flatMap((s) => {
		const enc = encodeURIComponent(String(s.slug));
		const base = { lastmod: toLastmod(s.updated_at), changefreq: 'hourly', priority: 0.8 };
		return [
			{ loc: `${root}/${enc}`, ...base },
			{ loc: `${root}/${enc}/leaderboard`, ...base },
			{ loc: `${root}/${enc}/members`, ...base }
		];
	});
}

async function joinRows(servers: PublicServer[]): Promise<UrlEntry[]> {
	const inviteSlugs = await db.listInviteSlugsForServers(servers.map((s) => Number(s.id))).catch(() => []);
	const inviteServers = (
		await Promise.all(
			servers.map(async (s) => {
				const row = await db.getServerSettings(Number(s.id), SERVER_SETTINGS.component.public).catch(() => null);
				return publicSubfeatureEnabled(row?.settings, 'invite') ? s : null;
			})
		)
	).filter((s): s is PublicServer => s != null);
	return [
		...inviteServers.map((s) => ({
			loc: `${APP_URL}${inviteJoinPath(String(s.slug))}`,
			lastmod: toLastmod(s.updated_at),
			changefreq: 'weekly',
			priority: 0.7
		})),
		...inviteSlugs.map((i) => ({ loc: `${APP_URL}${inviteJoinPath(i.slug)}`, lastmod: toLastmod(i.created_at), changefreq: 'weekly', priority: 0.6 }))
	];
}

function staticPages(newestServer: string | undefined): UrlEntry[] {
	const legalLastmod = toLastmod(new Date(`${LEGAL_LAST_UPDATED} UTC`));
	return [
		{ loc: `${APP_URL}/`, changefreq: 'weekly', priority: 1.0, lastmod: newestServer },
		{ loc: `${APP_URL}/servers`, changefreq: 'daily', priority: 0.9, lastmod: newestServer },
		{ loc: `${APP_URL}/tasks`, changefreq: 'weekly', priority: 0.8 },
		{ loc: `${APP_URL}/shop`, changefreq: 'daily', priority: 0.8 },
		{ loc: `${APP_URL}/quests`, changefreq: 'daily', priority: 0.9 },
		{ loc: `${APP_URL}/roblox`, changefreq: 'daily', priority: 0.9 },
		{ loc: `${APP_URL}/wikis`, changefreq: 'weekly', priority: 0.8 },
		{ loc: `${APP_URL}/forwarder-servers`, changefreq: 'daily', priority: 0.9 },
		{ loc: `${APP_URL}/docs`, changefreq: 'monthly', priority: 0.7 },
		{ loc: TERMS_URL, changefreq: 'monthly', priority: 0.5, lastmod: legalLastmod },
		{ loc: PRIVACY_URL, changefreq: 'monthly', priority: 0.5, lastmod: legalLastmod }
	];
}

function urlElement({ loc, lastmod, changefreq, priority }: UrlEntry) {
	const lastmodElement = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
	return `
    <url>
      <loc>${escapeXml(loc)}</loc>${lastmodElement}
      <changefreq>${changefreq}</changefreq>
      <priority>${priority.toFixed(1)}</priority>
    </url>`;
}

export const GET: RequestHandler = async () => {
	const servers = await listPublicServerSlugs();
	const serverRows = publicPageRows(servers);
	const newestServer = serverRows.reduce<string | undefined>((max, r) => (r.lastmod && (!max || r.lastmod > max) ? r.lastmod : max), undefined);
	const allUrlData = [...staticPages(newestServer), ...serverRows, ...(await joinRows(servers))];

	return new Response(
		`<?xml version="1.0" encoding="UTF-8" ?>
		<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
			${allUrlData.map(urlElement).join('')}
		</urlset>`.trim(),
		{ headers: { 'Content-Type': 'application/xml' } }
	);
};
