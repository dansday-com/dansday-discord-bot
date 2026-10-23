export const USERNAME_MIN_LENGTH = 3;
export const CAPTCHA_LENGTH = 6;
export const INVITE_TOKEN_BYTES = 32;
export const INVITE_TOKEN_LENGTH = { min: 32, max: 255 };

const EMAIL_VISIBLE_PREFIX_LENGTH = 3;

export type AccountRole = 'owner' | 'staff';

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = { owner: 'Owner', staff: 'Staff' };

export type PanelAccountRow = {
	id: number;
	username: string;
	email: string;
	ip_address: string | null;
	server_id: number;
	server_name: string | null;
	account_type: AccountRole;
	is_frozen: boolean | null;
};

export function maskEmail(email: string) {
	const at = email.indexOf('@');
	if (at <= 0) {
		return `${email.slice(0, EMAIL_VISIBLE_PREFIX_LENGTH)}***`;
	}
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const prefix = local.slice(0, EMAIL_VISIBLE_PREFIX_LENGTH);
	return `${prefix}***@${domain}`;
}

export function groupPanelAccounts(rows: PanelAccountRow[]) {
	return [...new Map(rows.map((row) => [row.id, row])).values()].map(({ id, username, email, ip_address }) => ({
		id,
		username,
		email,
		ip_address,
		servers: rows
			.filter((row) => row.id === id)
			.map(({ server_id, server_name, account_type, is_frozen }) => ({ server_id, server_name, account_type, is_frozen: is_frozen === true }))
	}));
}
