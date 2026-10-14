const USERNAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 255;

export function sanitizeString(input: unknown, maxLength = 255) {
	if (typeof input !== 'string') {
		return '';
	}
	let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
	sanitized = sanitized.trim();
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}
	return sanitized;
}

export function sanitizeUsername(username: unknown) {
	if (typeof username !== 'string') {
		return '';
	}
	return username
		.trim()
		.replace(/[^a-zA-Z]/g, '')
		.substring(0, USERNAME_MAX_LENGTH);
}

export function sanitizeEmail(email: unknown) {
	if (typeof email !== 'string') {
		return '';
	}
	return email.trim().toLowerCase().substring(0, EMAIL_MAX_LENGTH);
}

type LengthRange = { minLength: number; maxLength: number };

export function validateInputLength(
	input: unknown,
	fieldName: string,
	{ minLength, maxLength }: LengthRange
): { valid: true; error?: undefined } | { valid: false; error: string } {
	if (typeof input !== 'string') {
		return { valid: false, error: `${fieldName} must be a string` };
	}
	if (input.length < minLength) {
		return { valid: false, error: `${fieldName} must be at least ${minLength} characters long` };
	}
	if (input.length > maxLength) {
		return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
	}
	return { valid: true };
}
