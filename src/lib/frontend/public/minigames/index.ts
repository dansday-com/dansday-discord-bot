import db from '$lib/database.js';
import { resolveMemberByCardToken } from '$lib/frontend/public/items/index.js';

export async function loadMinigamesShared(server: any, hash: string) {
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');

	const row = await db.getServerSettings(server.id, SERVER_SETTINGS.component.minigames).catch(() => null);
	if ((row as any)?.settings?.enabled !== true) return { notFound: true } as const;

	const levelingRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const req = (levelingRow as any)?.settings?.REQUIREMENTS ?? {};
	const levelReq = { baseXp: Number(req.BASE_XP) || 100, multiplier: Number(req.MULTIPLIER) || 1.2 };

	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;

	if (!member) {
		return {
			readOnly: true as const,
			member: null,
			hash: '',
			memberName: null,
			memberDiscordId: null,
			memberAvatar: null,
			memberCard: null,
			balance: { experience: 0, level: 1, rank: null },
			history: [],
			levelReq
		};
	}

	const history = await db.getMemberMinigameHistory(member.id, 200).catch(() => []);

	return {
		readOnly: false as const,
		member,
		hash,
		memberName: member.server_display_name || member.display_name || member.username,
		memberDiscordId: String(member.discord_member_id),
		memberAvatar: member.avatar ?? null,
		memberCard: {
			discord_member_id: String(member.discord_member_id),
			username: member.username ?? null,
			display_name: member.display_name ?? null,
			server_display_name: member.server_display_name ?? null,
			avatar: member.avatar ?? null,
			level: Number(member.level ?? 0) || 0,
			experience: Number(member.experience ?? 0) || 0,
			rank: member.rank != null ? Number(member.rank) : null,
			member_since: member.member_since ? new Date(member.member_since).toISOString() : null,
			roles: (member.roles ?? []).map((r: any) => ({ name: r.name, color: r.color, position: r.position }))
		},
		balance: {
			experience: Number(member.experience ?? 0) || 0,
			level: Number(member.level ?? 1) || 1,
			rank: member.rank != null ? Number(member.rank) : null
		},
		history: (history as any[]).map((h) => ({
			id: Number(h.id),
			multiplier: Number(h.multiplier) || 0,
			wager: Number(h.wager) || 0,
			payout: Number(h.payout) || 0,
			net: Number(h.xp_amount) || 0,
			outcome: h.outcome,
			created_at: h.created_at ? new Date(h.created_at).toISOString() : null
		})),
		levelReq
	};
}
