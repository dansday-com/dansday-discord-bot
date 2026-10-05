<script lang="ts">
	import { xpForLevel } from '$lib/level-rewards.js';
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t }: SceneScreenProps = $props();

	const BASE_XP = 100;
	const MULTIPLIER = 1.2;
	const levelAt = (xp: number) => {
		let lv = 1;
		while (xp >= xpForLevel(lv + 1, BASE_XP, MULTIPLIER)) lv++;
		return lv;
	};
	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

	const BOARD = { tap: 4900, from: 5200 };
	const CLIMB = { from: 7600, to: 8900, swap: 9200 };
	const TICK = 650;
	const XP_PER_MESSAGE = 15;
	const ROW = 52;
	const MEDALS = ['#d9a528', '#9aa3ad', '#b9783f'];

	const NAV = [
		{ id: 'stats', label: 'Statistics', icon: 'fa-chart-pie' },
		{ id: 'board', label: 'Leaderboard', icon: 'fa-trophy' },
		{ id: 'members', label: 'Members', icon: 'fa-users' }
	];
	const PERIODS = ['All time', 'This month', 'This week'];
	const METRICS = [
		{ label: 'XP', icon: 'fa-star' },
		{ label: 'Chat', icon: 'fa-message' },
		{ label: 'Voice', icon: 'fa-microphone' },
		{ label: 'Invites', icon: 'fa-user-plus' },
		{ label: 'Items', icon: 'fa-store' }
	];

	const board = $derived(t >= BOARD.from);
	const tapped = (at: number) => t >= at && t < at + 520;

	const ticks = $derived(Math.floor(Math.min(t, BOARD.from) / TICK));
	const totalXp = $derived(2418930 + ticks * XP_PER_MESSAGE);
	const messages = $derived(184502 + ticks);

	const climb = $derived.by(() => {
		const p = Math.max(0, Math.min(1, (t - CLIMB.from) / (CLIMB.to - CLIMB.from)));
		return 1 - Math.pow(1 - p, 3);
	});
	const swapped = $derived(t >= CLIMB.swap);

	const rows = $derived([
		{ name: 'Kai', avatar: avatar(0), xp: 18240, slot: 0, rising: false },
		{ name: 'Rin', avatar: avatar(3), xp: 15880, slot: 1, rising: false },
		{ name: 'Nova', avatar: avatar(1), xp: 13020, slot: 2, rising: false },
		{ name: 'Sol', avatar: avatar(5), xp: 10520, slot: swapped ? 4 : 3, rising: false },
		{ name: 'Jun', avatar: avatar(4), xp: 10410 + Math.round(150 * climb), slot: swapped ? 3 : 4, rising: true }
	]);
</script>

<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex h-10 shrink-0 items-center px-3">
		<span class="bg-base-300/70 text-base-content/70 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[12px]">
			<i class="fas fa-lock text-[9px]"></i>night-owls.dansday.dev
		</span>
	</div>

	<div class="mx-3 mt-1 flex shrink-0 items-center gap-2.5">
		<span class="from-secondary to-primary grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br text-[14px] font-extrabold text-white">N</span>
		<span class="min-w-0 flex-1">
			<span class="text-base-content block truncate text-[13.5px] leading-tight font-extrabold">Night Owls</span>
			<span class="text-base-content/60 block text-[10.5px]">1,284 members</span>
		</span>
		<span class="border-primary/35 bg-primary/15 text-primary flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold">
			<span class="bg-primary size-1.5 animate-pulse rounded-full"></span>Live
		</span>
	</div>

	<div class="border-base-300 bg-base-200 mx-3 mt-2.5 flex shrink-0 gap-1 rounded-xl border p-1">
		{#each NAV as item (item.id)}
			{@const on = item.id === (board ? 'board' : 'stats')}
			<span
				class="relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-lg py-1.5 text-[11px] font-bold {on
					? 'bg-base-100 text-base-content shadow-sm'
					: 'text-base-content/55'}"
			>
				<i class="fas {item.icon} text-[10px]"></i>{item.label}
				{#if item.id === 'board' && tapped(BOARD.tap)}<span class="public-ripple"></span>{/if}
			</span>
		{/each}
	</div>

	{#snippet card(icon: string, title: string, tone: string, label: string, value: string, head: string, pct: number, left: string, right: string)}
		<article class="border-base-300 bg-base-100 rounded-[14px] border px-3 py-2.5">
			<p class="text-base-content flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.04em] uppercase">
				<i class="fas {icon}" style="color: {tone}"></i>{title}
			</p>
			<p class="mt-1.5 flex items-baseline justify-between gap-2">
				<span class="text-base-content text-[19px] leading-tight font-extrabold tabular-nums">{value}</span>
				<span class="text-base-content/55 text-[9.5px] font-bold tracking-[0.06em] uppercase">{label}</span>
			</p>
			<p class="text-base-content/55 mt-1.5 text-[9.5px] font-bold">{head}</p>
			<div class="bg-base-300 mt-1 h-1.5 overflow-hidden rounded-full">
				<span class="block h-full rounded-full" style="width: {pct}%; background: {tone}"></span>
			</div>
			<p class="text-base-content/60 mt-1.5 flex justify-between gap-2 text-[10px] font-semibold tabular-nums"><span>{left}</span><span>{right}</span></p>
		</article>
	{/snippet}

	{#if !board}
		<div class="public-in mx-3 mt-2.5 flex shrink-0 flex-col gap-2">
			<div class="grid grid-cols-3 gap-1.5">
				{#each [{ icon: 'fa-users', label: 'Members', value: '1,284' }, { icon: 'fa-star', label: 'Total XP', value: fmt(totalXp) }, { icon: 'fa-microphone', label: 'Voice min', value: '96,410' }] as stat (stat.label)}
					<span class="border-base-300 bg-base-100 flex min-w-0 flex-col gap-0.5 rounded-xl border px-2 py-1.5">
						<span class="text-base-content/55 flex items-center gap-1 text-[8.5px] font-bold tracking-[0.06em] uppercase">
							<i class="fas {stat.icon}"></i>{stat.label}
						</span>
						<span class="text-base-content truncate text-[12px] font-extrabold tabular-nums">{stat.value}</span>
					</span>
				{/each}
			</div>
			{@render card('fa-star', 'Leveling', '#d9a528', 'Total XP', fmt(totalXp), 'Average vs peak level', 23, `Messages ${fmt(messages)}`, 'Highest level 61')}
			{@render card('fa-bag-shopping', 'Items', '#d35400', 'Items bought', '3,907', 'Heist outcomes', 72, 'Landed 412', 'Caught 163')}
			{@render card('fa-dice', 'Minigames', '#d6536d', 'Games played', '2,564', 'Game mix', 75, 'Gamble 1,920', 'Tower 644')}
		</div>
	{:else}
		<div class="public-in mx-3 mt-2.5 flex shrink-0 flex-col gap-1.5">
			<div class="flex gap-1.5">
				{#each PERIODS as period, i (period)}
					<span
						class="rounded-lg border px-2.5 py-1 text-[10.5px] font-bold {i === 0
							? 'border-primary/40 bg-primary/10 text-primary'
							: 'border-base-300 bg-base-100 text-base-content/60'}">{period}</span
					>
				{/each}
			</div>
			<div class="flex gap-1.5 overflow-hidden">
				{#each METRICS as metric, i (metric.label)}
					<span
						class="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-bold {i === 0
							? 'from-secondary to-primary border-transparent bg-linear-to-br text-white'
							: 'border-base-300 bg-base-100 text-base-content/60'}"
					>
						<i class="fas {metric.icon} text-[9px]"></i>{metric.label}
					</span>
				{/each}
			</div>
			<ol class="relative mt-1" style="height: {rows.length * ROW}px">
				{#each rows as row (row.name)}
					{@const lit = row.rising && t >= CLIMB.from}
					<li
						class="public-row absolute inset-x-0 top-0 flex h-[46px] items-center gap-2.5 rounded-xl border px-2.5 {lit
							? 'border-primary/45 bg-primary/8'
							: 'border-base-300 bg-base-100'}"
						style="transform: translateY({row.slot * ROW}px); z-index: {row.rising ? 1 : 0}"
					>
						<span class="w-6 shrink-0 text-center text-[12px] font-extrabold tabular-nums" style="color: {MEDALS[row.slot] ?? 'inherit'}">#{row.slot + 1}</span>
						<img src={row.avatar} alt="" class="size-8 shrink-0 rounded-full" loading="lazy" />
						<span class="min-w-0 flex-1">
							<span class="text-base-content block truncate text-[12.5px] leading-tight font-bold">{row.name}</span>
							<span class="text-base-content/60 block text-[10.5px]">Lvl {levelAt(row.xp)}</span>
						</span>
						{#if row.rising && swapped}
							<span class="text-success flex shrink-0 items-center gap-0.5 text-[10px] font-extrabold"><i class="fas fa-caret-up"></i>1</span>
						{/if}
						<span class="text-base-content shrink-0 text-[12.5px] font-extrabold tabular-nums"
							>{fmt(row.xp)}<span class="text-base-content/55 ml-1 text-[9px] font-bold">XP</span></span
						>
					</li>
				{/each}
			</ol>
		</div>
	{/if}
</div>

<style>
	.public-in {
		animation: public-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes public-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.public-row {
		transition:
			transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
			background-color 240ms ease,
			border-color 240ms ease;
	}

	.public-ripple {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 48px;
		height: 48px;
		margin: -24px 0 0 -24px;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--color-primary) 30%, transparent);
		pointer-events: none;
		animation: public-ripple 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes public-ripple {
		from {
			opacity: 0.6;
			transform: scale(0.4);
		}
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.public-in,
		.public-ripple {
			animation: none;
		}

		.public-ripple {
			opacity: 0;
		}

		.public-row {
			transition: none;
		}
	}
</style>
