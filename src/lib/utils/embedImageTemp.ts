import { existsSync, readdirSync, unlinkSync } from 'fs';
import { basename, join } from 'path';

const uploadsDir = join(process.cwd(), 'data', 'embed-images');

const MAX_AGE_MS = 30 * 60 * 1000;

function uploadTimestampMs(filename: string): number | null {
	const base = basename(filename).replace(/\.[^.]+$/, '');
	const parts = base.split('-');

	if (parts[0] === 'global' && parts.length === 4) {
		const ts = Number(parts[2]);
		return Number.isFinite(ts) ? ts : null;
	}

	if (parts.length >= 3) {
		const ts = Number(parts[1]);
		return Number.isFinite(ts) ? ts : null;
	}
	if (parts.length === 2) {
		const ts = Number(parts[0]);
		return Number.isFinite(ts) ? ts : null;
	}
	return null;
}

export function pruneExpiredEmbedImages(): void {
	if (!existsSync(uploadsDir)) return;
	let names: string[];
	try {
		names = readdirSync(uploadsDir);
	} catch {
		return;
	}
	const now = Date.now();
	for (const name of names) {
		const ts = uploadTimestampMs(name);
		if (ts == null) continue;
		if (now - ts <= MAX_AGE_MS) continue;
		try {
			unlinkSync(join(uploadsDir, name));
		} catch {}
	}
}
