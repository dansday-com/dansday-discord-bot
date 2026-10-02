import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { computePublicServerSlugForServerId } from '$lib/frontend/public/server-slug/index.js';
import { inviteJoinPath, isValidInviteSlug, normalizeInviteSlug } from '$lib/invites.js';

export const load: PageServerLoad = async ({ params }) => {
	const slug = normalizeInviteSlug(params.slug);
	if (!isValidInviteSlug(slug)) error(404, 'Invite not found');
	if (slug !== params.slug) redirect(301, inviteJoinPath(slug));

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
