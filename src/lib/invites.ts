export const INVITE_STAFF_MULTIPLIER = 2;

export type InviteStatus = 'active' | 'left' | 'fake';

export const INVITE_STATUS_META: Record<InviteStatus, { label: string; icon: string; tone: string }> = {
	active: { label: 'Still here', icon: 'fa-user-check', tone: 'text-emerald-400' },
	left: { label: 'Left', icon: 'fa-user-minus', tone: 'text-amber-400' },
	fake: { label: 'Fake', icon: 'fa-user-secret', tone: 'text-red-400' }
};

export const INVITE_FAKE_REASON_LABEL: Record<string, string> = {
	account_age: 'New account',
	self: 'Own link',
	bot: 'Bot inviter',
	rejoin: 'Rejoined'
};

export const INVITE_SOURCE_LABEL: Record<string, string> = {
	invite: 'Invite link',
	vanity: 'Vanity link',
	manual: 'Set by staff',
	unknown: 'Unknown'
};
