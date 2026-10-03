<script lang="ts">
	import { xpForLevel } from '$lib/level-rewards.js';

	type RewardItem = { level: number; name: string; color: string | null; reached: boolean; worn: boolean };

	let {
		rewards,
		xp,
		levelReq
	}: {
		rewards: { keep: boolean; stack: boolean; items: RewardItem[] };
		xp: number;
		levelReq: { baseXp: number; multiplier: number };
	} = $props();

	const fmt = (n: number) => Number(n || 0).toLocaleString();
	const xpAt = (level: number) => xpForLevel(level, levelReq.baseXp, levelReq.multiplier);
	const accent = (r: RewardItem) => r.color ?? 'var(--color-base-content)';

	const unlocked = $derived(rewards.items.filter((r) => r.reached).length);
	const next = $derived(rewards.items.find((r) => !r.reached) ?? null);
	const progress = $derived.by(() => {
		if (!next) return null;
		const from = xpAt([...rewards.items].reverse().find((r) => r.reached)?.level ?? 1);
		const to = xpAt(next.level);
		return { pct: Math.max(0, Math.min(100, ((xp - from) / Math.max(1, to - from)) * 100)), toGo: Math.max(0, to - xp) };
	});
	const rule = $derived(
		[
			rewards.keep ? 'Once a role is yours, you keep it.' : 'Drop below the level after a steal or bomb and the role goes until you climb back.',
			rewards.stack ? '' : 'Each new reward replaces the last.'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<section class="card border-base-300 bg-base-100 border shadow-sm">
	<div class="card-body gap-3 px-[18px] py-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-base-content flex items-center gap-2 text-[15px] font-extrabold">
					<i class="fas fa-trophy text-warning"></i> Level rewards
				</h3>
				<p class="text-base-content/60 mt-1 text-xs">Reach a level to get its role in this server. {rule}</p>
			</div>
			<span class="text-base-content/50 text-xs font-bold tabular-nums">{unlocked}/{rewards.items.length} unlocked</span>
		</div>

		{#if next && progress}
			<div class="flex items-center gap-2.5">
				<div class="bg-base-content/10 h-1.5 flex-1 overflow-hidden rounded-full">
					<div class="bg-warning h-full rounded-full transition-[width] duration-500 ease-out" style="width:{progress.pct}%"></div>
				</div>
				<span class="text-base-content/55 text-[11px] font-bold whitespace-nowrap tabular-nums">
					{fmt(progress.toGo)} XP to {next.name}
				</span>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3">
			{#each rewards.items as r, i (i)}
				<article
					class="flex items-center gap-3 rounded-xl border px-3 py-2.5 {r.worn
						? 'border-success/35 bg-success/8'
						: next && r.level === next.level
							? 'border-warning/45 bg-warning/8'
							: 'border-base-300 bg-base-content/3'}"
					style="--role:{accent(r)}"
				>
					<span
						class="grid size-9 shrink-0 place-items-center rounded-full text-sm {r.reached ? '' : 'opacity-60'}"
						style="color: var(--role); background: color-mix(in srgb, var(--role) 14%, transparent);"
					>
						<i class="fas {r.reached ? 'fa-unlock' : 'fa-lock'}"></i>
					</span>
					<div class="min-w-0 flex-1">
						<strong class="text-base-content block truncate text-sm font-bold">{r.name}</strong>
						<span class="text-base-content/50 block text-[11px] font-semibold tabular-nums">Level {r.level} · {fmt(xpAt(r.level))} XP</span>
					</div>
					{#if r.worn}
						<span class="text-success inline-flex shrink-0 items-center gap-1 text-[11px] font-bold"><i class="fas fa-circle-check"></i> Yours</span>
					{:else if r.reached}
						<span class="text-base-content/40 shrink-0 text-[11px] font-bold">Replaced</span>
					{:else}
						<span class="text-base-content/40 shrink-0 text-[11px] font-bold whitespace-nowrap tabular-nums">{fmt(Math.max(0, xpAt(r.level) - xp))} to go</span>
					{/if}
				</article>
			{/each}
		</div>
	</div>
</section>
