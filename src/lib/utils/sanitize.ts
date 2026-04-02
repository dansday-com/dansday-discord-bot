export function sanitizeString(input: unknown, maxLength = 255) {
	if (typeof input !== 'string') return '';
	let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
	sanitized = sanitized.trim();
	if (sanitized.length > maxLength) sanitized = sanitized.substring(0, maxLength);
	return sanitized;
}

export function sanitizeUsername(username: unknown) {
	if (typeof username !== 'string') return '';
	return username
		.trim()
		.replace(/[^a-zA-Z]/g, '')
		.substring(0, 50);
}

export function sanitizeEmail(email: unknown) {
	if (typeof email !== 'string') return '';
	return email.trim().toLowerCase().substring(0, 255);
}

export function sanitizeInteger(input: unknown, min: number | null = null, max: number | null = null): number | null {
	const num = parseInt(String(input), 10);
	if (Number.isNaN(num)) return null;
	if (min !== null && num < min) return null;
	if (max !== null && num > max) return null;
	return num;
}

export function validateInputLength(input: unknown, fieldName: string, minLength: number, maxLength: number) {
	if (typeof input !== 'string') return { valid: false, error: `${fieldName} must be a string` };
	if (input.length < minLength) return { valid: false, error: `${fieldName} must be at least ${minLength} characters long` };
	if (input.length > maxLength) return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters` };
	return { valid: true };
}
