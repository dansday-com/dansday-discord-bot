import type { AggregatedPanelStats } from './aggregate.js';

export type LiveServerSample = { name: string; xp: number };
export type LiveGainBatch = { id: number; items: number[] };

const ENDPOINT = '/api/statistics/global';
const RETRY_MS = 8000;

export function createLiveGlobalStatistics(initial: AggregatedPanelStats) {
	let totals = $state(initial);
	let servers = $state<LiveServerSample[]>([]);
	let live = $state(false);
	let updatedAt = $state(0);
	let gains = $state<LiveGainBatch | null>(null);

	let seq = 0;
	let source: EventSource | null = null;
	let retry: ReturnType<typeof setTimeout> | null = null;

	function apply(payload: { totals?: AggregatedPanelStats; servers?: LiveServerSample[]; gains?: number[]; updated_at?: number }) {
		if (!payload?.totals) return;

		totals = payload.totals;
		servers = Array.isArray(payload.servers) ? payload.servers : [];
		updatedAt = Number(payload.updated_at) || Date.now();
		live = true;

		const items = (Array.isArray(payload.gains) ? payload.gains : []).map((xp) => Number(xp) || 0).filter((xp) => xp > 0);
		if (items.length) gains = { id: ++seq, items };
	}

	function open() {
		if (typeof EventSource === 'undefined') return;
		source = new EventSource(ENDPOINT);
		source.onmessage = (event) => {
			try {
				apply(JSON.parse(event.data));
			} catch (_) {}
		};
		source.onerror = () => {
			live = false;
			source?.close();
			source = null;
			if (!retry) retry = setTimeout(() => ((retry = null), open()), RETRY_MS);
		};
	}

	return {
		get totals() {
			return totals;
		},
		get servers() {
			return servers;
		},
		get live() {
			return live;
		},
		get updatedAt() {
			return updatedAt;
		},
		get gains() {
			return gains;
		},
		connect() {
			open();
			return () => {
				if (retry) clearTimeout(retry);
				retry = null;
				source?.close();
				source = null;
				live = false;
			};
		}
	};
}
