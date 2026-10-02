import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { computePublicServerSlugForServerId, resolvePublicServerBySlug } from '$lib/frontend/public/server-slug/index.js';
import { inviteJoinPath, isValidInviteSlug, normalizeInviteSlug } from '$lib/invites.js';

export const load: PageServerLoad = async ({ params }) => {
	const raw = String(params.slug ?? '');
	const publicServer = await resolvePublicServerBySlug(raw.toLowerCase()).catch(() => null);
	if (publicServer) {
		if (publicServer.computedSlug !== raw) redirect(301, inviteJoinPath(publicServer.computedSlug));
		const slug = publicServer.computedSlug;
		const server = await db.getServer(publicServer.server.id);
		const code = server?.vanity_url_code || server?.invite_code || null;
		return {
			slug,
			inviteUrl: code ? `https://discord.gg/${code}` : null,
			member: null,
			server: {
				name: String(server?.name ?? publicServer.server.name ?? 'a Discord server'),
				icon: server?.server_icon ?? null,
				members: Number(server?.total_members) || 0
			},
			serverSlug: slug,
			indexable: true
		};
	}

	const slug = normalizeInviteSlug(raw);
	if (!isValidInviteSlug(slug)) error(404, 'Invite not found');
	if (slug !== raw) redirect(301, inviteJoinPath(slug));

	const link = await db.getInviteLinkBySlug(slug);
	if (!link) error(404, 'Invite not found');

	const serverSlug = await computePublicServerSlugForServerId(Number(link.server_id)).catch(() => null);

	return {
		slug,
		inviteUrl: `https://discord.gg/${link.code}`,
		member: { name: String(link.member_name ?? 'A member'), avatar: link.avatar ?? null },
		server: { name: String(link.server_name ?? 'a Discord server'), icon: link.server_icon ?? null, members: Number(link.total_members) || 0 },
		serverSlug,
		indexable: serverSlug != null
	};
};
