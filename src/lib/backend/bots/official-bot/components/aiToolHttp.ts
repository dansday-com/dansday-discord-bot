export const DEFAULT_TOOL_TIMEOUT_MS = 20_000;
const ERROR_DETAIL_PREVIEW_LENGTH = 200;

export function resolveToolUrl(rawUrl: string, path: string) {
	const trimmed = String(rawUrl ?? '')
		.trim()
		.replace(/\/+$/, '');
	if (!trimmed) {
		return '';
	}
	return trimmed.endsWith(path) ? trimmed : `${trimmed}${path}`;
}

type ToolEndpoint = { url: string; apiKey: string };

export async function postJson({ url, apiKey }: ToolEndpoint, body: unknown, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify(body),
			signal: controller.signal
		});

		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw Object.assign(new Error(`HTTP ${res.status}${detail ? ` ${detail.slice(0, ERROR_DETAIL_PREVIEW_LENGTH)}` : ''}`), {
				status: res.status,
				body: detail
			});
		}

		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

export default { postJson, resolveToolUrl, DEFAULT_TOOL_TIMEOUT_MS };
