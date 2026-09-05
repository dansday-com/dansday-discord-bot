import db, { getMaxPublicXpEventId, listPublicXpEventsAfter } from '../../../database.js';
import { resolvePublicStatisticsSnapshot } from './stream.js';
import { aggregatePanelStatistics, type AggregatedPanelStats } from './aggregate.js';
import type { PublicPageStats } from './shape.js';

export type GlobalStatisticsSnapshot = {
	totals: AggregatedPanelStats;
	gains: number[];
	updated_at: number;
};

type Listener = (snapshot: GlobalStatisticsSnapshot) => void;

const POLL_MS = 5_000;
const SERVER_LIST_TTL_MS = 60_000;
const SNAPSHOT_FRESH_MS = 20_000;
const REFRESH_PER_POLL = 25;
const MAX_SERVERS = 200;
const MAX_GAINS = 40;

const latest = new Map<number, PublicPageStats>();
const stamps = new Map<number, number>();

let serverList: { id: number; name: string }[] = [];
let serverListAt = 0;
let cursor = 0;
let lastEventId = 0;

async function listServers() {
	if (serverList.length && Date.now() - serverListAt < SERVER_LIST_TTL_MS) return serverList;

	let rows: any[] = [];
	try {
		rows = await (db as any).listPublicServers();
	} catch (_) {
		return serverList;
	}
	if (!Array.isArray(rows)) return serverList;

	serverList = rows
		.filter((r: any) => !r?.deleted_at)
		.slice(0, MAX_SERVERS)
		.map((r: any) => ({ id: Number(r.id), name: String(r.name || 'Server') }));
	serverListAt = Date.now();

	const ids = new Set(serverList.map((s) => s.id));
	for (const id of [...latest.keys()]) {
		if (!ids.has(id)) {
			latest.delete(id);
			stamps.delete(id);
		}
	}

	return serverList;
}

async function refresh(ids: number[]) {
	await Promise.all(
		ids.map(async (id) => {
			try {
				const snapshot = await resolvePublicStatisticsSnapshot(id);
				if (!snapshot?.stats) return;
				latest.set(id, snapshot.stats);
				stamps.set(id, Date.now());
			} catch (_) {}
		})
	);
}

async function collectGains(): Promise<number[]> {
	try {
		if (lastEventId <= 0) {
			lastEventId = await getMaxPublicXpEventId();
			return [];
		}
		const events = await listPublicXpEventsAfter(lastEventId, MAX_GAINS);
		if (!events.length) return [];
		lastEventId = events[events.length - 1].id;
		return events.map((event) => event.xp);
	} catch (_) {
		return [];
	}
}

export async function resolveGlobalStatistics(): Promise<GlobalStatisticsSnapshot> {
	const [servers, gains] = await Promise.all([listServers(), collectGains()]);

	const unseen = servers.filter((s) => !latest.has(s.id)).map((s) => s.id);
	if (unseen.length) {
		await refresh(unseen);
	} else if (servers.length) {
		const due: number[] = [];
		for (let n = 0; n < servers.length && due.length < REFRESH_PER_POLL; n++) {
			const server = servers[(cursor + n) % servers.length];
			if (Date.now() - (stamps.get(server.id) || 0) >= SNAPSHOT_FRESH_MS) due.push(server.id);
		}
		cursor = (cursor + Math.max(1, due.length)) % servers.length;
		if (due.length) await refresh(due);
	}

	const stats = servers.map((s) => latest.get(s.id) ?? null);

	return { totals: aggregatePanelStatistics(stats), gains, updated_at: Date.now() };
}

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastSnapshot: GlobalStatisticsSnapshot | null = null;
let lastJson: string | null = null;

function emit(snapshot: GlobalStatisticsSnapshot) {
	for (const fn of listeners) {
		try {
			fn(snapshot);
		} catch (_) {}
	}
}

async function poll() {
	if (listeners.size === 0) return;
	let snapshot: GlobalStatisticsSnapshot;
	try {
		snapshot = await resolveGlobalStatistics();
	} catch (_) {
		return;
	}
	const json = JSON.stringify(snapshot.totals);
	lastSnapshot = snapshot;
	if (json === lastJson && snapshot.gains.length === 0) return;
	lastJson = json;
	emit(snapshot);
}

export function subscribeGlobalStatistics(fn: Listener): () => void {
	listeners.add(fn);

	if (lastSnapshot && Date.now() - lastSnapshot.updated_at < POLL_MS * 2) {
		try {
			fn({ ...lastSnapshot, gains: [] });
		} catch (_) {}
	} else {
		resolveGlobalStatistics()
			.then((snapshot) => {
				lastSnapshot = snapshot;
				lastJson = JSON.stringify(snapshot.totals);
				emit(snapshot);
			})
			.catch(() => {});
	}

	if (!timer) timer = setInterval(() => void poll(), POLL_MS);

	return () => {
		listeners.delete(fn);
		if (listeners.size === 0 && timer) {
			clearInterval(timer);
			timer = null;
		}
	};
}
