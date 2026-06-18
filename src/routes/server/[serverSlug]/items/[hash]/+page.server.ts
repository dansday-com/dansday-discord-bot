import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { publicServerPath } from '$lib/url.js';
import { loadItemsCatalog, resolveMemberByCardToken, computeCardToken } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server, publicStatsEnabled } = await parent();

	const itemsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.items).catch(() => null);
	if ((itemsRow as any)?.settings?.enabled !== true) error(404, 'Items not available');

	const hash = String(params.hash || '').trim();
	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;
	if (!member) {
		redirect(303, publicStatsEnabled ? publicServerPath(server.slug) : '/');
	}

	const levelingRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const req = (levelingRow as any)?.settings?.REQUIREMENTS ?? {};
	const levelReq = { baseXp: Number(req.BASE_XP) || 100, multiplier: Number(req.MULTIPLIER) || 1.2 };

	const items = await loadItemsCatalog(server.id);

	const valid = true;

	const permissionsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.permissions).catch(() => null);
	const memberRoleIds: string[] = (permissionsRow as any)?.settings?.member_roles ?? [];

	let inventory: any[] = [];
	let targets: any[] = [];
	if (member) {
		const list = await db.getServerMembersList(server.id).catch(() => []);
		targets = (list as any[])
			.filter((m) => m.discord_member_id && Number(m.id) !== Number(member.id))
			.filter((m) => (m.roles ?? []).some((r: any) => memberRoleIds.includes(r.id)))
			.map((m) => ({
				hash: computeCardToken(m.discord_member_id, m.member_since),
				name: m.server_display_name || m.display_name || m.username,
				avatar: m.avatar ?? null,
				discord_member_id: String(m.discord_member_id),
				level: Number(m.level ?? 0) || 0,
				experience: Number(m.experience ?? 0) || 0,
				rank: m.rank != null ? Number(m.rank) : null,
				roles: (m.roles ?? []).map((r: any) => ({ name: r.name, color: r.color }))
			}));

		const rows = await db.getMemberInventory(member.id).catch(() => []);
		inventory = (rows as any[]).map((r) => ({
			member_item_id: r.id,
			item_id: r.item_id,
			name: r.name,
			effect_type: r.effect_type,
			description: r.description,
			icon: r.icon,
			quantity: r.quantity,
			config: typeof r.config === 'string' ? safeParse(r.config) : r.config
		}));
	}

	let activeEffects: any[] = [];
	let cooldownUntil: number | null = null;
	let immuneUntil: number | null = null;
	if (member) {
		const effectRows = await db.getActiveEffectsForMember(member.id).catch(() => []);
		activeEffects = (effectRows as any[]).map((e) => ({
			effect_type: e.effect_type,
			effect_value: Number(e.effect_value) || 0,
			expiresAt: e.expires_at ? new Date(e.expires_at).getTime() : null
		}));

		let maxCooldownMin = 0;
		let maxImmunityMin = 0;
		for (const it of items as any[]) {
			if (it.effect_type !== 'steal' && it.effect_type !== 'bomb') continue;
			const cfg = typeof it.config === 'string' ? safeParse(it.config) || {} : it.config || {};
			maxCooldownMin = Math.max(maxCooldownMin, Number(cfg.cooldown_minutes) || 0);
			maxImmunityMin = Math.max(maxImmunityMin, Number(cfg.immunity_minutes) || 0);
		}
		if (maxCooldownMin > 0) {
			const last = await db.getLastAttackActionByActor(member.id).catch(() => null);
			if (last) {
				const ends = last.getTime() + maxCooldownMin * 60000;
				if (ends > Date.now()) cooldownUntil = ends;
			}
		}
		if (maxImmunityMin > 0) {
			const last = await db.getLastActionAgainstTarget(member.id, ['steal', 'bomb']).catch(() => null);
			if (last) {
				const ends = last.getTime() + maxImmunityMin * 60000;
				if (ends > Date.now()) immuneUntil = ends;
			}
		}
	}

	return {
		items,
		inventory,
		targets,
		hash,
		valid,
		memberName: member ? member.server_display_name || member.display_name || member.username : null,
		memberDiscordId: member ? String(member.discord_member_id) : null,
		memberAvatar: member?.avatar ?? null,
		balance: member
			? {
					experience: Number(member.experience ?? 0) || 0,
					level: Number(member.level ?? 1) || 1,
					rank: member.rank != null ? Number(member.rank) : null
				}
			: null,
		activeEffects,
		cooldownUntil,
		immuneUntil,
		levelReq
	};
};
