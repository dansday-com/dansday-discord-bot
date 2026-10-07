import { inviteJoinPath } from '$lib/invites.js';
import { publicServerUrl, publicSiteOrigin } from '$lib/url.js';

const MAX_BYTES = 3000;

export type LinkEmbedServer = { name: string; slug: string; server_icon: string | null; join_available: boolean; accent: number | null };

export function md(s: string): string {
	return String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[\\*_~`|[\]()<>#]/g, '\\$&');
}

export function compact(n: number | null | undefined): string {
	return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(Number(n ?? 0)));
}

function serialize(payload: unknown): string {
	return JSON.stringify(payload)
		.replace(/</g, '\\u003c')
		.replace(/>/g, '\\u003e')
		.replace(/&/g, '\\u0026')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

function payload(server: LinkEmbedServer, url: string, subtitle: string, lines: string[]) {
	const link = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
	const heading = { type: 10, content: `## [${md(server.name)}](${link})\n${md(subtitle)}` };
	const buttons = [
		{ type: 2, style: 5, label: 'Statistics', url: publicServerUrl(server.slug) },
		{ type: 2, style: 5, label: 'Leaderboard', url: publicServerUrl(server.slug, 'leaderboard') },
		{ type: 2, style: 5, label: 'Members', url: publicServerUrl(server.slug, 'members') },
		...(server.join_available ? [{ type: 2, style: 5, label: 'Join', url: publicSiteOrigin() + inviteJoinPath(server.slug) }] : [])
	];
	return {
		component: {
			type: 17,
			...(server.accent != null ? { accent_color: server.accent } : {}),
			components: [
				server.server_icon ? { type: 9, components: [heading], accessory: { type: 11, media: { url: server.server_icon } } } : heading,
				...(lines.length ? [{ type: 14 }, { type: 10, content: lines.join('\n') }] : []),
				{ type: 14, divider: false },
				{ type: 1, components: buttons }
			]
		}
	};
}

export function serverLinkEmbed(server: LinkEmbedServer, url: string, subtitle: string, lines: string[]): string {
	for (let n = lines.length; n >= 0; n--) {
		const json = serialize(payload(server, url, subtitle, lines.slice(0, n)));
		if (new TextEncoder().encode(json).length <= MAX_BYTES) return `<script id="discord:component-embed" type="application/json">${json}</script>`;
	}
	return '';
}
