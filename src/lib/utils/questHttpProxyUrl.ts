const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback', 'metadata', 'metadata.google.internal']);

function normalizeIpv4Octet(part: string): number | null {
	if (!/^\d+$/.test(part)) return null;
	const n = Number(part);
	if (!Number.isInteger(n) || n < 0 || n > 255) return null;
	return n;
}

function parseIpv4(host: string): number[] | null {
	const parts = host.split('.');
	if (parts.length !== 4) return null;
	const octets: number[] = [];
	for (const part of parts) {
		if (part.length > 1 && part.startsWith('0')) return null;
		const n = normalizeIpv4Octet(part);
		if (n === null) return null;
		octets.push(n);
	}
	return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
	const [a, b] = octets;
	if (a === 0) return true;
	if (a === 10) return true;
	if (a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 192 && b === 0) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a >= 224) return true;
	return false;
}

function isPrivateIpv6(host: string): boolean {
	const h = host.toLowerCase().replace(/^\[|\]$/g, '');
	if (h === '::' || h === '::1') return true;
	if (h.startsWith('fe80') || h.startsWith('fec0')) return true;
	if (/^f[cd]/.test(h)) return true;
	const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mapped) {
		const octets = parseIpv4(mapped[1]);
		return octets === null || isPrivateIpv4(octets);
	}
	if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(h)) return true;
	return false;
}

export function isValidQuestHttpProxyUrl(raw: string): boolean {
	const s = raw.trim();
	if (!s) return true;

	let u: URL;
	try {
		u = new URL(s);
	} catch {
		return false;
	}

	if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

	const host = u.hostname.toLowerCase();
	if (!host) return false;
	if (BLOCKED_HOSTNAMES.has(host)) return false;
	if (host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;

	if (host.includes(':') || u.hostname.startsWith('[')) return !isPrivateIpv6(host);

	if (/^\d+$/.test(host) || /^0x/i.test(host)) return false;

	const octets = parseIpv4(host);
	if (octets) return !isPrivateIpv4(octets);

	if (/^[\d.]+$/.test(host)) return false;

	return true;
}
