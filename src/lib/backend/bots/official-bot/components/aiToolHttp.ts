export const DEFAULT_TOOL_TIMEOUT_MS = 20_000;

export async function postJson(url, apiKey, body, timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
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
			throw new Error(`HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`);
		}

		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

export default { postJson, DEFAULT_TOOL_TIMEOUT_MS };
