/** Stored forwarder config: single list (legacy used `production` / `testing` / `mode`). */
export function normalizeForwarderSettings(raw: unknown): { forwarders: unknown[] } {
	if (!raw || typeof raw !== 'object') return { forwarders: [] };
	const s = raw as Record<string, unknown>;
	if (Array.isArray(s.forwarders)) return { forwarders: s.forwarders };
	if (Array.isArray(s.production)) return { forwarders: s.production };
	return { forwarders: [] };
}
