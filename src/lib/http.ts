export const HTTP = {
	OK: 200,
	ACCEPTED: 202,
	PARTIAL_CONTENT: 206,
	MULTIPLE_CHOICES: 300,
	MOVED_PERMANENTLY: 301,
	FOUND: 302,
	SEE_OTHER: 303,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	PAYLOAD_TOO_LARGE: 413,
	RANGE_NOT_SATISFIABLE: 416,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	NETWORK_TIMEOUT: 599
} as const;

const STATUS_CLASS_SIZE = 100;

function statusClass(status: number) {
	return Math.floor(status / STATUS_CLASS_SIZE) * STATUS_CLASS_SIZE;
}

export function isHttpSuccess(status: number) {
	return statusClass(status) === HTTP.OK;
}

export function isHttpServerError(status: number) {
	return statusClass(status) === HTTP.INTERNAL_ERROR;
}

export function isHttpError(status: number) {
	return statusClass(status) === HTTP.BAD_REQUEST || isHttpServerError(status);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	const body: unknown = await request.json().catch(() => null);
	return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function optionalText(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

export function numberField(value: unknown): number {
	return typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
}

export function numberFieldOr(value: unknown, fallback: number): number {
	if (value == null) {
		return fallback;
	}
	if (typeof value !== 'number' && typeof value !== 'string') {
		return Number.NaN;
	}
	return Number(value) || fallback;
}

export function positiveIntegerField(value: unknown): number | null {
	const parsed = numberField(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
