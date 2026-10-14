import { getContext, setContext } from 'svelte';
import type { loadTasksShared } from '$lib/backend/public/tasks/index.js';

const KEY = 'items';

export type AssetSummary = { invested: number; value: number; pnl: number; pnlPct: number; count: number };

export type TaskStreak = Awaited<ReturnType<typeof loadTasksShared>>['streak'];

export type AccountContext = {
	fmt: (n: unknown) => string;
	canAfford: (item: Record<string, unknown>) => boolean;
	isBuffActive: (effectType: string) => boolean;
	effectIcon: (effectType: string) => string;
	effectLabel: (effectType: string) => string;
	actionVerb: (effectType: string) => { label: string; icon: string };
	flyToBag: (fromEl: HTMLElement | null, iconClass: string) => void;
	setLiveXp: (n: number) => void;
	setBusy: (id: number | null) => void;
	setBurst: (id: number | null) => void;
	setAssetSummary: (summary: AssetSummary | null) => void;
	setTaskSummary: (streak: TaskStreak | null) => void;
	invalidateAll: () => Promise<void>;
	remainingLabel: (untilMs: number) => string;
	readonly busy: number | null;
	readonly burstId: number | null;
	readonly now: number;
	readonly liveXp: number;
	readonly luckPercent: number;
	readonly bagCapacity: number;
	readonly bagStock: number;
	readonly bagFull: boolean;
	readonly hash: string;
	readonly readOnly: boolean;
	readonly serverSlug: string;
};

export function setAccountContext(context: AccountContext): void {
	setContext(KEY, context);
}

export function accountContext(): AccountContext {
	return getContext<AccountContext>(KEY);
}
