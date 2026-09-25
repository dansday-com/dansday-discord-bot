export function normalizeForwarderSettings(raw: unknown): { forwarders: unknown[]; enabled?: boolean } {
	if (!raw || typeof raw !== 'object') return { forwarders: [] };
	const s = raw as Record<string, unknown>;
	const forwarders = Array.isArray(s.forwarders) ? s.forwarders : [];
	const enabled = typeof s.enabled === 'boolean' ? s.enabled : undefined;
	return enabled === undefined ? { forwarders } : { forwarders, enabled };
}

export function normalizeForwarderKeywords(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const keywords: string[] = [];
	for (const entry of raw) {
		const value = String(entry ?? '').trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		keywords.push(value);
	}
	return keywords;
}

export function forwarderKeywordHaystack(content: unknown, embeds: unknown): string {
	const parts: string[] = [];
	if (typeof content === 'string' && content) parts.push(content);
	if (Array.isArray(embeds)) {
		for (const embed of embeds) {
			if (!embed || typeof embed !== 'object') continue;
			const e = embed as Record<string, any>;
			if (typeof e.title === 'string') parts.push(e.title);
			if (typeof e.description === 'string') parts.push(e.description);
			if (typeof e.author?.name === 'string') parts.push(e.author.name);
			if (typeof e.footer?.text === 'string') parts.push(e.footer.text);
			if (Array.isArray(e.fields)) {
				for (const field of e.fields) {
					if (typeof field?.name === 'string') parts.push(field.name);
					if (typeof field?.value === 'string') parts.push(field.value);
				}
			}
		}
	}
	return parts.join('\n').toLowerCase();
}

export function forwarderKeywordsMatch(keywords: unknown, haystack: string): boolean {
	const list = normalizeForwarderKeywords(keywords);
	if (list.length === 0) return true;
	if (!haystack) return false;
	return list.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
