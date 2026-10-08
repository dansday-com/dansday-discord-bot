import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { computePublicServerSlugForServerId, resolvePublicServerBySlug } from '$lib/backend/public/server-slug/index.js';
import { SERVER_SETTINGS, publicSubfeatureEnabled } from '$lib/backend/panelServer.js';
import { inviteJoinPath, isValidInviteSlug, normalizeInviteSlug } from '$lib/invites.js';
import { serverThemeUrl } from '$lib/backend/storage/serverThemes.js';
import { DEFAULT_ACCENT, normalizeAccent, type MemberTheme } from '$lib/themes.js';
import { normalizeEffect, normalizeSeed } from '$lib/effects.js';

function inviteTheme(settings: Record<string, any> | null | undefined): MemberTheme | null {
	const image = serverThemeUrl(settings?.invite_theme_image);
	const accent = normalizeAccent(settings?.invite_theme_accent);
	const effect = normalizeEffect(settings?.invite_theme_effect);
	if (!image && !accent && effect === 'none') return null;
	return {
		image,
		accent: accent ?? DEFAULT_ACCENT,
		accentAuto: false,
		effect,
		ownedEffect: effect,
		effectEnabled: effect !== 'none',
		effectSeed: normalizeSeed(settings?.invite_theme_effect_seed)
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const raw = String(params.slug ?? '');
	const publicServer = await resolvePublicServerBySlug(raw.toLowerCase()).catch(() => null);
	if (publicServer) {
		const settingsRow = await db.getServerSettings(publicServer.server.id, SERVER_SETTINGS.component.public).catch(() => null);
		if (!publicSubfeatureEnabled((settingsRow as any)?.settings, 'invite')) error(404, 'Invite not found');
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
			indexable: true,
			memberTheme: inviteTheme((settingsRow as any)?.settings)
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
