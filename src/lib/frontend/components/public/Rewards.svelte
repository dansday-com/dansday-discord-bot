<script lang="ts">
	import { prefersReducedMotion } from '$lib/frontend/components/dash';
	import { rewardGoalMeta, xpForLevel, type RewardKind, type RewardState } from '$lib/rewards.js';
	import GameModal from './GameModal.svelte';

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
	const KIND_LABEL: Record<RewardKind, string> = { role: 'Role', xp: 'XP', custom: 'Custom reward' };
	const DONE: Record<RewardKind, string> = { role: 'Yours', xp: 'Paid', custom: 'Earned' };
	const EARNED_LINE: Record<RewardKind, string> = {
		role: 'Yours. The bot gave you this role.',
		xp: 'Paid. The XP went straight to your balance.',
		custom: 'Earned. Staff will hand it over to you.'
	};

	const fmt = (n: number) => Number(n || 0).toLocaleString();
	const accent = (r: RewardItem) => r.color ?? 'var(--color-primary)';

	function fill(node: HTMLElement, value: number) {
		const set = (v: number) => (node.style.width = `${v}%`);
		if (prefersReducedMotion()) {
			set(value);
			return { update: set };
		}
		set(0);
		const raf = requestAnimationFrame(() => requestAnimationFrame(() => set(value)));
		return { update: set, destroy: () => cancelAnimationFrame(raf) };
	}

	let openId = $state<number | null>(null);
	const open = $derived(rewards.items.find((r) => r.id === openId) ?? null);

	const unlocked = $derived(rewards.items.filter((r) => r.reached).length);
	const rule = $derived(
		[
			rewards.keep ? 'Once a reward is yours, you keep it.' : 'Drop below a level after a steal or bomb and its reward goes until you climb back.',
			rewards.stack ? '' : 'On the same goal, a higher reward replaces the lower one.'
		]
			.filter(Boolean)
			.join(' ')
	);

	function isDone(r: RewardItem) {
		return r.state === 'earned' || r.state === 'delivered';
	}

	function hours(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m === 0 ? `${fmt(h)} h` : `${fmt(h)} h ${m} min`;
	}

	function toGo(r: RewardItem): string {
		if (r.goal_type === 'level') return `${fmt(Math.max(0, xpForLevel(r.goal, levelReq.baseXp, levelReq.multiplier) - xp))} XP to go`;
		const left = Math.max(0, r.goal - r.current);
		if (r.goal_type === 'chat') return `${fmt(left)} to go`;
		return left >= 60 ? `${fmt(Math.ceil(left / 60))} h to go` : `${left} min to go`;
	}

	function progress(r: RewardItem): string {
		if (r.goal_type === 'level') return `${fmt(xp)} / ${fmt(xpForLevel(r.goal, levelReq.baseXp, levelReq.multiplier))} XP`;
		if (r.goal_type === 'chat') return `${fmt(r.current)} / ${fmt(r.goal)} messages`;
		return `${hours(r.current)} / ${hours(r.goal)}`;
	}

	function pct(r: RewardItem): number {
		if (r.goal_type !== 'level') return Math.max(0, Math.min(100, (r.current / Math.max(1, r.goal)) * 100));
		const to = xpForLevel(r.goal, levelReq.baseXp, levelReq.multiplier);
		return Math.max(0, Math.min(100, (xp / Math.max(1, to)) * 100));
	}

	function status(r: RewardItem): { icon: string; tone: string; line: string } {
		if (r.state === 'delivered') return { icon: 'fa-circle-check', tone: 'text-success', line: 'Delivered. Staff handed this over to you.' };
		if (r.state === 'earned') return { icon: 'fa-circle-check', tone: 'text-success', line: EARNED_LINE[r.kind] };
		if (r.state === 'replaced') return { icon: 'fa-layer-group', tone: 'text-base-content/60', line: 'A higher reward on the same goal took its place.' };
		if (r.state === 'gone')
			return { icon: 'fa-hourglass-end', tone: 'text-base-content/60', line: `All ${fmt(r.limit ?? 0)} were taken before you got there.` };
		if (r.state === 'passed')
			return {
				icon: 'fa-forward',
				tone: 'text-base-content/60',
				line: 'You were already past this goal when it opened. It goes to members who reach it from now on.'
			};
		return { icon: 'fa-lock', tone: 'text-warning', line: `Reach ${r.goal_label} to unlock it. ${toGo(r)}.` };
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
				{@const done = isDone(r)}
				<button
					type="button"
					onclick={() => (openId = r.id)}
					aria-label="{r.name}, {r.goal_label}"
					class="group flex cursor-pointer flex-col gap-2 rounded-xl border px-3 py-2.5 text-left transition-[translate,scale,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-(color:--reward-edge) hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(color:--reward) active:translate-y-0 active:scale-[0.98] {done
						? 'border-success/35 bg-success/8'
						: 'border-base-300 bg-base-content/3'}"
					style="--reward:{accent(r)}; --reward-edge: color-mix(in srgb, {accent(r)} 45%, transparent);"
				>
					<div class="flex w-full items-center gap-3">
						{#if r.image}
							<img
								src={r.image}
								alt=""
								loading="lazy"
								class="size-9 shrink-0 rounded-lg object-cover transition-[filter,opacity] duration-200 {r.reached
									? ''
									: 'opacity-60 grayscale group-hover:opacity-90 group-hover:grayscale-0'}"
							/>
						{:else}
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full text-sm transition-[opacity,scale] duration-200 group-hover:scale-110 {r.reached
									? ''
									: 'opacity-60'}"
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
						<i class="fas fa-chevron-right text-base-content/25 shrink-0 text-[10px] transition-transform duration-200 group-hover:translate-x-0.5"></i>
					</div>

					{#if r.state === 'locked'}
						<div class="flex w-full items-center gap-2">
							<div class="bg-base-content/10 h-1 flex-1 overflow-hidden rounded-full">
								<div class="bg-warning h-full rounded-full transition-[width] duration-700 ease-out" use:fill={pct(r)}></div>
							</div>
							{#if r.left !== null}
								<span class="text-base-content/45 text-[10px] font-bold whitespace-nowrap tabular-nums">{fmt(r.left)} left</span>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</section>

{#if open}
	{@const r = open}
	{@const s = status(r)}
	<GameModal title={r.name} icon={KIND_ICON[r.kind]} state={isDone(r) ? 'win' : 'idle'} onclose={() => (openId = null)}>
		<div class="flex flex-col gap-3.5" style="--reward:{accent(r)}">
			{#if r.image}
				<div class="border-base-300 bg-base-200 relative overflow-hidden rounded-xl border">
					<img src={r.image} alt={r.name} class="animate-pop-in mx-auto max-h-64 w-full object-contain" />
					{#if !r.reached}
						<span class="bg-base-100/90 text-warning absolute top-2 right-2 grid size-8 place-items-center rounded-full shadow-sm">
							<i class="fas fa-lock text-sm"></i>
						</span>
					{/if}
				</div>
			{:else}
				<div
					class="animate-pop-in mx-auto grid size-20 place-items-center rounded-full border text-[32px]"
					style="color: var(--reward); background: color-mix(in srgb, var(--reward) 14%, transparent); border-color: color-mix(in srgb, var(--reward) 35%, transparent);"
				>
					<i class="fas {KIND_ICON[r.kind]}"></i>
				</div>
			{/if}

			<div class="flex flex-wrap justify-center gap-1.5">
				<span class="badge badge-sm border-base-300 bg-base-200 text-base-content/70 h-auto gap-1.5 py-1 font-bold">
					<i class="fas {KIND_ICON[r.kind]}"></i>{KIND_LABEL[r.kind]}
				</span>
				<span class="badge badge-sm border-base-300 bg-base-200 text-base-content/70 h-auto gap-1.5 py-1 font-bold tabular-nums">
					<i class="fas {rewardGoalMeta(r.goal_type).icon}"></i>{r.goal_label}
				</span>
				{#if r.limit !== null}
					<span class="badge badge-sm border-base-300 bg-base-200 text-base-content/70 h-auto gap-1.5 py-1 font-bold tabular-nums">
						<i class="fas fa-users"></i>First {fmt(r.limit)} · {fmt(r.left ?? 0)} left
					</span>
				{/if}
			</div>

			<p class="border-base-300 bg-base-200/60 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold {s.tone}">
				<i class="fas {s.icon} mt-0.5"></i><span class="text-base-content/80">{s.line}</span>
			</p>

			{#if r.state === 'locked'}
				<div>
					<div class="mb-1.5 flex items-baseline justify-between gap-2 text-[11.5px] font-bold tabular-nums">
						<span class="text-base-content/70">{progress(r)}</span>
						<span class="text-base-content/45">{Math.floor(pct(r))}%</span>
					</div>
					<div class="bg-base-content/10 h-2 overflow-hidden rounded-full">
						<div class="bg-warning h-full rounded-full transition-[width] duration-700 ease-out" use:fill={pct(r)}></div>
					</div>
				</div>
			{/if}
		</div>
	</GameModal>
{/if}
