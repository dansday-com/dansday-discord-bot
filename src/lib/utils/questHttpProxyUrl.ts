export function isValidQuestHttpProxyUrl(raw: string): boolean {
	const s = raw.trim();
	if (!s) return true;
	try {
		const u = new URL(s);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}
