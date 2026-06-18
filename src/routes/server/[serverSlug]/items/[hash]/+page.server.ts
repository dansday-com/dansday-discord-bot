import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
import { loadItemsCatalog, resolveMemberByCardToken, computeCardToken } from '$lib/frontend/public/items/index.js';

function safeParse(raw: any) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { server } = await parent();

	const itemsRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.items).catch(() => null);
	if ((itemsRow as any)?.settings?.enabled !== true) error(404, 'Items not available');

	const levelingRow = await db.getServerSettings(server.id, SERVER_SETTINGS.component.leveling).catch(() => null);
	const req = (levelingRow as any)?.settings?.REQUIREMENTS ?? {};
	const levelReq = { baseXp: Number(req.BASE_XP) || 100, multiplier: Number(req.MULTIPLIER) || 1.2 };

	const items = await loadItemsCatalog(server.id);

	const hash = String(params.hash || '').trim();
	const member = hash ? await resolveMemberByCardToken(server.id, hash) : null;
	const valid = !!member;

	let inventory: any[] = [];
	let targets: any[] = [];
	if (member) {
		const list = await db.getServerMembersList(server.id).catch(() => []);
		targets = (list as any[])
			.filter((m) => m.discord_member_id && Number(m.id) !== Number(member.id))
			.map((m) => ({
				hash: computeCardToken(m.discord_member_id, m.member_since),
				name: m.server_display_name || m.display_name || m.username
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
			magnitude: Number(e.magnitude) || 0,
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
