<script lang="ts">
	import { xpForLevel, type RewardKind, type RewardState } from '$lib/rewards.js';

	type RewardItem = {
		id: number;
		goal_type: string;
		goal: number;
		goal_label: string;
		kind: RewardKind;
		name: string;
		color: string | null;
		image: string | null;
		state: RewardState;
		reached: boolean;
		current: number;
		limit: number | null;
		left: number | null;
	};

	let {
		rewards,
		xp,
		levelReq
	}: {
		rewards: { keep: boolean; stack: boolean; items: RewardItem[] };
		xp: number;
		levelReq: { baseXp: number; multiplier: number };
	} = $props();

	const KIND_ICON: Record<RewardKind, string> = { role: 'fa-user-tag', xp: 'fa-bolt', custom: 'fa-gift' };
	const DONE: Record<RewardKind, string> = { role: 'Yours', xp: 'Paid', custom: 'Earned' };

	const fmt = (n: number) => Number(n || 0).toLocaleString();
	const accent = (r: RewardItem) => r.color ?? 'var(--color-primary)';

	const unlocked = $derived(rewards.items.filter((r) => r.reached).length);
	const rule = $derived(
		[
			rewards.keep ? 'Once a reward is yours, you keep it.' : 'Drop below a level after a steal or bomb and its reward goes until you climb back.',
			rewards.stack ? '' : 'On the same goal, a higher reward replaces the lower one.'
		]
			.filter(Boolean)
			.join(' ')
	);

	function toGo(r: RewardItem): string {
		if (r.goal_type === 'level') return `${fmt(Math.max(0, xpForLevel(r.goal, levelReq.baseXp, levelReq.multiplier) - xp))} XP to go`;
		const left = Math.max(0, r.goal - r.current);
		if (r.goal_type === 'chat') return `${fmt(left)} to go`;
		return left >= 60 ? `${fmt(Math.ceil(left / 60))} h to go` : `${left} min to go`;
	}

	function pct(r: RewardItem): number {
		if (r.goal_type !== 'level') return Math.max(0, Math.min(100, (r.current / Math.max(1, r.goal)) * 100));
		const to = xpForLevel(r.goal, levelReq.baseXp, levelReq.multiplier);
		return Math.max(0, Math.min(100, (xp / Math.max(1, to)) * 100));
	}
</script>

<section class="card border-base-300 bg-base-100 border shadow-sm">
	<div class="card-body gap-3 px-[18px] py-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-base-content flex items-center gap-2 text-[15px] font-extrabold">
					<i class="fas fa-trophy text-warning"></i> Rewards
				</h3>
				<p class="text-base-content/60 mt-1 text-xs">Reach a goal to get its reward in this server. {rule}</p>
			</div>
			<span class="text-base-content/50 text-xs font-bold tabular-nums">{unlocked}/{rewards.items.length} unlocked</span>
		</div>

		<div class="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3">
			{#each rewards.items as r (r.id)}
				{@const done = r.state === 'earned' || r.state === 'delivered'}
				<article
					class="flex flex-col gap-2 rounded-xl border px-3 py-2.5 {done ? 'border-success/35 bg-success/8' : 'border-base-300 bg-base-content/3'}"
					style="--reward:{accent(r)}"
				>
					<div class="flex items-center gap-3">
						{#if r.image}
							<img src={r.image} alt="" loading="lazy" class="size-9 shrink-0 rounded-lg object-cover {r.reached ? '' : 'opacity-60 grayscale'}" />
						{:else}
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full text-sm {r.reached ? '' : 'opacity-60'}"
								style="color: var(--reward); background: color-mix(in srgb, var(--reward) 14%, transparent);"
							>
								<i class="fas {r.reached ? KIND_ICON[r.kind] : 'fa-lock'}"></i>
							</span>
						{/if}
						<div class="min-w-0 flex-1">
							<strong class="text-base-content block truncate text-sm font-bold">{r.name}</strong>
							<span class="text-base-content/50 block truncate text-[11px] font-semibold tabular-nums">
								{r.goal_label}{#if r.limit !== null}
									· first {fmt(r.limit)}{/if}
							</span>
						</div>
						{#if r.state === 'delivered'}
							<span class="text-success inline-flex shrink-0 items-center gap-1 text-[11px] font-bold"><i class="fas fa-circle-check"></i> Delivered</span>
						{:else if r.state === 'earned'}
							<span class="text-success inline-flex shrink-0 items-center gap-1 text-[11px] font-bold"><i class="fas fa-circle-check"></i> {DONE[r.kind]}</span>
						{:else if r.state === 'replaced'}
							<span class="text-base-content/40 shrink-0 text-[11px] font-bold">Replaced</span>
						{:else if r.state === 'gone'}
							<span class="text-base-content/40 shrink-0 text-[11px] font-bold">All taken</span>
						{:else if r.state === 'passed'}
							<span class="text-base-content/40 shrink-0 text-[11px] font-bold">Missed</span>
						{:else}
							<span class="text-base-content/40 shrink-0 text-[11px] font-bold whitespace-nowrap tabular-nums">{toGo(r)}</span>
						{/if}
					</div>

					{#if r.state === 'locked'}
						<div class="flex items-center gap-2">
							<div class="bg-base-content/10 h-1 flex-1 overflow-hidden rounded-full">
								<div class="bg-warning h-full rounded-full transition-[width] duration-500 ease-out" style="width:{pct(r)}%"></div>
							</div>
							{#if r.left !== null}
								<span class="text-base-content/45 text-[10px] font-bold whitespace-nowrap tabular-nums">{fmt(r.left)} left</span>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</div>
</section>
