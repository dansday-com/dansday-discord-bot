import { sanitizeUsername, sanitizeEmail, validateInputLength } from '$lib/utils/index.js';
import { USERNAME_MIN_LENGTH } from '$lib/accounts.js';

export const BCRYPT_SALT_ROUNDS = 12;

export async function validateRegistrationInputs(username: string, email: string, password: string) {
	const errors: string[] = [];

	const sanitizedUsername = sanitizeUsername(username);
	if (!sanitizedUsername || sanitizedUsername.length < USERNAME_MIN_LENGTH) {
		errors.push('Username must be at least 3 characters long');
	} else if (!/^[a-zA-Z]+$/.test(sanitizedUsername)) {
		errors.push('Username can only contain uppercase and lowercase letters');
	} else {
		const r = validateInputLength(sanitizedUsername, 'Username', { minLength: USERNAME_MIN_LENGTH, maxLength: 50 });
		if (!r.valid) {
			errors.push(r.error);
		}
	}

	const sanitizedEmail = sanitizeEmail(email);
	if (!sanitizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
		errors.push('Valid email is required');
	} else {
		const r = validateInputLength(sanitizedEmail, 'Email', { minLength: 5, maxLength: 255 });
		if (!r.valid) {
			errors.push(r.error);
		}
	}

	if (!password || typeof password !== 'string') {
		errors.push('Password is required');
	} else {
		const r = validateInputLength(password, 'Password', { minLength: 6, maxLength: 128 });
		if (!r.valid) {
			errors.push(r.error);
		}
	}

	return { valid: errors.length === 0, errors, sanitizedUsername: sanitizedUsername || '', sanitizedEmail: sanitizedEmail || '' };
}
