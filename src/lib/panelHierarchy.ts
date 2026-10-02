export type PanelActor = 'superadmin' | 'owner' | 'staff';
export type MemberTier = 'owner' | 'staff' | 'member';

const ACTOR_RANK: Record<PanelActor, number> = { superadmin: 3, owner: 2, staff: 1 };
const TIER_RANK: Record<MemberTier, number> = { owner: 2, staff: 1, member: 0 };

export const TIER_DENIED: Record<PanelActor, string> = {
	superadmin: '',
	owner: 'Owners can act on staff and members, not on owners or admins.',
	staff: 'Staff can only act on regular members.'
};

export function panelActorOf(user: { authenticated: boolean; account_type?: string } | null | undefined): PanelActor | null {
	if (!user?.authenticated) return null;
	if (user.account_type === 'superadmin' || user.account_type === 'owner' || user.account_type === 'staff') return user.account_type;
	return null;
}

export function memberTier(member: { is_owner?: boolean | number | null; roleIds: string[] }, staffRoleIds: string[], adminRoleIds: string[]): MemberTier {
	if (member.is_owner === true || Number(member.is_owner) === 1) return 'owner';
	const roles = new Set(member.roleIds.map(String));
	if (adminRoleIds.some((id) => roles.has(String(id)))) return 'owner';
	if (staffRoleIds.some((id) => roles.has(String(id)))) return 'staff';
	return 'member';
}

export function canActOn(actor: PanelActor | null, tier: MemberTier): boolean {
	if (!actor) return false;
	return ACTOR_RANK[actor] > TIER_RANK[tier];
}

export type PanelAccountType = 'owner' | 'staff';

export const PANEL_ACCOUNT_TYPES: PanelAccountType[] = ['owner', 'staff'];

export function accountTier(accountType: string): MemberTier {
	return accountType === 'owner' ? 'owner' : 'staff';
}

export function canActOnAccount(actor: PanelActor | null, accountType: string): boolean {
	return canActOn(actor, accountTier(accountType));
}

export function invitableAccountTypes(actor: PanelActor | null): PanelAccountType[] {
	return PANEL_ACCOUNT_TYPES.filter((type) => canActOnAccount(actor, type));
}
