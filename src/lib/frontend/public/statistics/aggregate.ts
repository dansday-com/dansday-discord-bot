import type { PublicPageStats } from './shape.js';

const MAX_FIELDS = [
	'leveling_max_level',
	'items_biggest_steal',
	'minigames_biggest_win',
	'streams_peak_viewers',
	'quests_active',
	'roblox_items_watched'
] as const;
const AVG_FIELDS = ['leveling_avg_level', 'staff_avg_rating'] as const;

export type AggregatedPanelStats = PublicPageStats & { servers_counted: number };

export function aggregatePanelStatistics(snapshots: (PublicPageStats | null | undefined)[]): AggregatedPanelStats {
	const rows = snapshots.filter(Boolean) as PublicPageStats[];
	const keys = new Set<string>();
	for (const row of rows) for (const k of Object.keys(row)) keys.add(k);

	const out: Record<string, number> = {};
	for (const key of keys) out[key] = 0;

	const maxSet = new Set<string>(MAX_FIELDS);
	const avgSet = new Set<string>(AVG_FIELDS);
	const avgWeights: Record<string, { sum: number; weight: number }> = {};

	for (const row of rows) {
		for (const key of keys) {
			const val = Number((row as Record<string, unknown>)[key]) || 0;
			if (maxSet.has(key)) {
				out[key] = Math.max(out[key], val);
			} else if (avgSet.has(key)) {
				const weight = key === 'staff_avg_rating' ? Number(row.staff_reviews) || 0 : Number(row.members_with_levels) || 0;
				const acc = (avgWeights[key] ??= { sum: 0, weight: 0 });
				acc.sum += val * weight;
				acc.weight += weight;
			} else {
				out[key] += val;
			}
		}
	}

	for (const [key, acc] of Object.entries(avgWeights)) {
		out[key] = acc.weight > 0 ? acc.sum / acc.weight : 0;
	}

	return { ...(out as unknown as PublicPageStats), servers_counted: rows.length };
}
