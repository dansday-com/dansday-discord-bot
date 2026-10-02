export const INVITE_STAFF_MULTIPLIER = 2;

export const INVITE_SHARE_PERCENT_OPTIONS = [0, 5, 10, 15, 20, 25];

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

export const INVITE_SLUG_MIN = 3;

export const INVITE_SLUG_MAX = 32;

export function normalizeInviteSlug(raw: string | null | undefined): string {
	return String(raw ?? '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, INVITE_SLUG_MAX)
		.replace(/-+$/g, '');
}

export function isValidInviteSlug(slug: string): boolean {
	return slug.length >= INVITE_SLUG_MIN && slug.length <= INVITE_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function inviteJoinPath(slug: string): string {
	return `/join/${encodeURIComponent(slug)}`;
}
