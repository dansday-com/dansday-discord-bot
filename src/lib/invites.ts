export const INVITE_STAFF_MULTIPLIER = 2;

export const INVITE_SHARE_PERCENT_MAX = 25;
const INVITE_SHARE_PERCENT_STEP = 5;

const ACCOUNT_AGE_DAY_PRESETS = { off: 0, day: 1, threeDays: 3, week: 7, twoWeeks: 14, month: 30, twoMonths: 60, threeMonths: 90 };
const HOLD_HOUR_PRESETS = { instant: 0, hour: 1, sixHours: 6, halfDay: 12, day: 24, twoDays: 48, threeDays: 72, week: 168 };

export const INVITE_ACCOUNT_AGE_DAY_OPTIONS = Object.values(ACCOUNT_AGE_DAY_PRESETS);
export const INVITE_HOLD_HOUR_OPTIONS = Object.values(HOLD_HOUR_PRESETS);
export const INVITE_SHARE_PERCENT_OPTIONS = Array.from(
	{ length: INVITE_SHARE_PERCENT_MAX / INVITE_SHARE_PERCENT_STEP + 1 },
	(_, i) => i * INVITE_SHARE_PERCENT_STEP
);

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
	invite: 'Discord link',
	personal: 'Personal link',
	vanity: 'Vanity link',
	server: 'Server link',
	manual: 'Set by staff',
	unknown: 'Unknown'
};

export const INVITE_SOURCE_TONE: Record<string, string> = {
	personal: 'text-cyan-300',
	invite: 'text-indigo-300',
	server: 'text-emerald-300',
	vanity: 'text-fuchsia-300',
	manual: 'text-violet-300',
	unknown: 'text-ash-400'
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
