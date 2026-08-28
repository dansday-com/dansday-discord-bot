import type { PageServerLoad } from './$types';
import { listPublicServers } from '$lib/database.js';
import { slugifyDisplayName, formatIndexedSlug } from '$lib/utils/slug.js';

const MAX_FEATURED_SERVERS = 50;

export const load: PageServerLoad = async () => {
	let featuredServers: { name: string; slug: string; server_icon: string | null }[] = [];

	try {
		const servers = await listPublicServers();
		if (Array.isArray(servers) && servers.length > 0) {
			const groups = new Map<string, typeof servers>();
			for (const s of servers) {
				const base = slugifyDisplayName(s.name || 'server', 'server');
				if (!groups.has(base)) groups.set(base, []);
				groups.get(base)!.push(s);
			}
			const all: { server: (typeof servers)[number]; slug: string }[] = [];
			for (const [base, list] of groups) {
				list.sort((a, b) => a.id - b.id);
				for (let i = 0; i < list.length; i++) {
					all.push({ server: list[i], slug: formatIndexedSlug(base, i + 1) });
				}
			}
			const live = all.filter((e) => !e.server.deleted_at);
			for (let i = live.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[live[i], live[j]] = [live[j], live[i]];
			}
			featuredServers = live.slice(0, MAX_FEATURED_SERVERS).map((e) => ({
				name: e.server.name || e.slug,
				slug: e.slug,
				server_icon: e.server.server_icon ?? null
			}));
		}
	} catch (_) {}

	return { featuredServers };
};
