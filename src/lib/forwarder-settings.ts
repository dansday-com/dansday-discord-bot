export function normalizeForwarderSettings(raw: unknown): { forwarders: unknown[]; enabled?: boolean } {
	if (!raw || typeof raw !== 'object') return { forwarders: [] };
	const s = raw as Record<string, unknown>;
	const forwarders = Array.isArray(s.forwarders) ? s.forwarders : [];
	const enabled = typeof s.enabled === 'boolean' ? s.enabled : undefined;
	return enabled === undefined ? { forwarders } : { forwarders, enabled };
}
