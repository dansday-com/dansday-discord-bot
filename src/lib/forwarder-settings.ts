export function normalizeForwarderSettings(raw: unknown): { forwarders: unknown[] } {
	if (!raw || typeof raw !== 'object') return { forwarders: [] };
	const s = raw as Record<string, unknown>;
	if (Array.isArray(s.forwarders)) return { forwarders: s.forwarders };
	return { forwarders: [] };
}
