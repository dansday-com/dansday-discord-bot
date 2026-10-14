export const USERNAME_MIN_LENGTH = 3;
export const CAPTCHA_LENGTH = 6;
export const INVITE_TOKEN_BYTES = 32;
export const INVITE_TOKEN_LENGTH = { min: 32, max: 255 };

const EMAIL_VISIBLE_PREFIX_LENGTH = 3;

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
