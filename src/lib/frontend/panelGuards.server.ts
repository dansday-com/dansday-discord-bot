import { json } from '@sveltejs/kit';
import db from '../database.js';
import { TIER_DENIED, canActOn, canActOnAccount, panelActorOf } from '../panelHierarchy.js';

function denied(locals: App.Locals) {
	const actor = panelActorOf(locals.user);
	return json({ ok: false, success: false, error: actor ? TIER_DENIED[actor] : 'Access denied' }, { status: 403 });
}

export async function guardMemberAction(locals: App.Locals, serverId: number | string, discordMemberId: string): Promise<Response | null> {
	if (canActOn(panelActorOf(locals.user), await db.getMemberTier(serverId, discordMemberId))) return null;
	return denied(locals);
}

export function guardAccountAction(locals: App.Locals, accountType: string): Response | null {
	return canActOnAccount(panelActorOf(locals.user), accountType) ? null : denied(locals);
}
