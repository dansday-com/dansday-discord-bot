<script lang="ts">
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	let { t }: SceneScreenProps = $props();

	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

	const FILL = { from: 300, to: 1900 };
	const CLAIM = { press: 2700, done: 3100 };
	const STREAK = { from: 5600, to: 8600 };
	const CHECKIN = { press: 10000, done: 10400 };
	const LOGIN_DAY_XP = [1000, 2500, 5000, 9000, 15000, 25000, 50000];
	const TODAY = 4;
	const RING = 2 * Math.PI * 26;

	const tapped = (at: number) => t >= at && t < at + 520;

	const minutes = $derived.by(() => {
		const p = Math.max(0, Math.min(1, (t - FILL.from) / (FILL.to - FILL.from)));
		return Math.round(38 + 7 * p);
	});
	const claimed = $derived(t >= CLAIM.done);
	const streak = $derived(t >= STREAK.from ? 7 : 6);
	const celebrating = $derived(t >= STREAK.from && t < STREAK.to);
	const checkedIn = $derived(t >= CHECKIN.done);

	const tasks = $derived([
		{
			difficulty: 'medium',
			tone: '#c8911a',
			accent: '#1f8a4c',
			icon: 'fa-microphone',
			description: 'Spend 45 minutes in voice',
			label: 'Voice time',
			progress: minutes,
			goal: 45,
			unit: 'min',
			reward: { icon: 'fa-star', tone: '#c8911a', title: '+1,150 XP', note: 'Reward' },
			claimable: true
		},
		{
			difficulty: 'hard',
			tone: '#c0392b',
			accent: '#c0392b',
			icon: 'fa-hand',
			description: 'Successfully steal from 2 members',
			label: 'Pickpocket',
			progress: 1,
			goal: 2,
			unit: '',
			reward: { icon: 'fa-shield', tone: '#1d6f8a', title: 'Shield', note: 'Shield · worth 600 XP' },
			claimable: false
		}
	]);
</script>

<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex h-10 shrink-0 items-center px-3">
		<span class="bg-base-300/70 text-base-content/70 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[12px]">
			<i class="fas fa-lock text-[9px]"></i>dansday.dev
		</span>
	</div>

	<div class="from-primary relative isolate mx-3 mt-1 flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl bg-linear-to-br to-[#7a1e06] px-3.5 py-3">
		<img src={avatar(2)} alt="" class="size-10 shrink-0 rounded-full ring-2 ring-white/60" loading="lazy" />
		<div class="min-w-0 flex-1">
			<p class="flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] text-white/60 uppercase"><i class="fas fa-fire"></i>Daily streak</p>
			<p class="truncate text-[13px] font-extrabold text-white">Mira</p>
			<p class="text-[19px] leading-tight font-extrabold text-white tabular-nums">
				<span class="tasks-bump inline-block" class:tasks-bumped={tapped(STREAK.from)}>{streak}</span><span class="ml-1 text-[11px] font-bold text-white/70"
					>DAYS</span
				>
			</p>
			<div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/20">
				<div class="tasks-bar h-full rounded-full bg-linear-to-r from-[#5eead4] to-[#fbbf24]" style="width: {streak >= 7 ? 100 : 86}%"></div>
			</div>
			<p class="mt-1 flex justify-between gap-2 text-[9.5px] font-semibold text-white/65">
				<span class="whitespace-nowrap">{streak >= 7 ? '23 to ⚡ One month' : '1 to 🔥 One week'}</span><span class="shrink-0 whitespace-nowrap">Best 12</span>
			</p>
		</div>
		<div class="flex shrink-0 flex-col items-center gap-2 border-l border-white/15 pl-3 leading-tight">
			<span class="text-center"
				><b class="block text-[15px] font-extrabold text-white tabular-nums">3/3</b><span class="text-[8.5px] font-bold text-white/60 uppercase">Freezes</span
				></span
			>
			<span class="text-center"
				><b class="block text-[15px] font-extrabold text-white tabular-nums">+{streak * 2}%</b><span class="text-[8.5px] font-bold text-white/60 uppercase"
					>Reward XP</span
				></span
			>
		</div>
	</div>

	<section class="border-base-300 bg-base-100 mx-3 mt-2 shrink-0 rounded-[14px] border px-2.5 py-1.5">
		<p class="text-base-content flex items-center justify-between gap-2 text-[11.5px] font-extrabold">
			<span class="flex items-center gap-1.5"><i class="fas fa-gift text-warning"></i>Daily check-in</span>
			<span class="text-base-content/55 text-[10px] font-bold">{checkedIn ? 'Claimed' : `Tap day ${TODAY} to claim`}</span>
		</p>
		<div class="mt-1.5 grid grid-cols-7 gap-1">
			{#each LOGIN_DAY_XP as xp, i (i)}
				{@const day = i + 1}
				{@const done = day < TODAY || (day === TODAY && checkedIn)}
				{@const current = day === TODAY && !checkedIn}
				<span
					class="relative flex flex-col items-center gap-0.5 overflow-hidden rounded-lg border py-1 {current
						? 'border-warning/50 from-warning/16 to-error/12 bg-linear-to-br'
						: day === 7
							? 'border-error/45 from-warning/12 to-error/14 bg-linear-to-br'
							: 'border-base-300'}"
				>
					<span class="text-base-content/40 text-[7.5px] font-extrabold tracking-[0.4px] uppercase">Day {day}</span>
					<span class="text-[12px] leading-none {done ? 'text-success' : day === 7 ? 'text-error' : 'text-warning'}">
						<i class="fas {done ? 'fa-circle-check' : day === 7 ? 'fa-crown' : 'fa-gift'}"></i>
					</span>
					<span class="text-base-content/55 text-[8px] font-bold tabular-nums">{done ? `${xp / 1000}k` : '?'}</span>
					{#if day === TODAY && tapped(CHECKIN.press)}<span class="tasks-ripple"></span>{/if}
				</span>
			{/each}
		</div>
	</section>

	<div class="mx-3 mt-2 flex shrink-0 items-center gap-1.5">
		<span class="from-secondary to-primary flex items-center gap-1.5 rounded-lg bg-linear-to-br px-2.5 py-1 text-[11px] font-bold text-white">
			<i class="fas fa-sun text-[10px]"></i>Daily<span class="rounded-full bg-white/25 px-1.5 text-[9.5px] tabular-nums">{claimed ? 18 : 17}/18</span>
		</span>
		<span class="border-base-300 bg-base-100 text-base-content/60 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold">
			<i class="fas fa-calendar-week text-[10px]"></i>Weekly<span class="bg-base-content/10 rounded-full px-1.5 text-[9.5px] tabular-nums">6/18</span>
		</span>
		<span class="text-base-content/40 ml-auto flex items-center gap-1 text-[10px] font-bold tabular-nums"><i class="fas fa-rotate"></i>05:12:44</span>
	</div>

	<div class="mx-3 mt-2 flex shrink-0 flex-col gap-1.5">
		{#each tasks as task (task.label)}
			{@const complete = task.progress >= task.goal}
			{@const done = task.claimable && claimed}
			<article
				class="border-base-300 bg-base-100 rounded-[14px] border border-l-[3px] px-2.5 py-1.5 {done ? 'opacity-60' : ''}"
				style="--accent: {task.accent}; border-left-color: {task.accent}"
			>
				<header class="flex items-center gap-2.5">
					<span class="relative grid size-10 shrink-0 place-items-center">
						<svg viewBox="0 0 60 60" class="absolute inset-0 size-full" aria-hidden="true">
							<circle cx="30" cy="30" r="26" fill="none" stroke="var(--color-base-content)" stroke-opacity="0.1" stroke-width="5" />
							<circle
								cx="30"
								cy="30"
								r="26"
								fill="none"
								stroke="var(--accent)"
								stroke-width="5"
								stroke-linecap="round"
								stroke-dasharray="{(RING * Math.min(1, task.progress / task.goal)).toFixed(1)} {RING.toFixed(1)}"
								transform="rotate(-90 30 30)"
							/>
						</svg>
						<i class="fas {task.icon} text-base-content/70 relative text-[11px]"></i>
					</span>
					<span class="flex min-w-0 flex-col items-start gap-0.5">
						<span
							class="rounded-full border px-1.5 py-px text-[8px] font-extrabold tracking-[0.7px] uppercase"
							style="--d: {task.tone}; color: var(--d); background: color-mix(in srgb, var(--d) 12%, transparent); border-color: color-mix(in srgb, var(--d) 30%, transparent)"
							>{task.difficulty}</span
						>
						<span class="text-base-content text-[12px] leading-tight font-bold">{task.description}</span>
						<span class="text-base-content/40 text-[10px] font-semibold">{task.label}</span>
					</span>
				</header>
				<div class="mt-1.5 flex items-center gap-2">
					<span class="bg-base-content/10 h-1.5 flex-1 overflow-hidden rounded-full">
						<span class="block h-full rounded-full" style="width: {Math.min(100, (task.progress / task.goal) * 100)}%; background: var(--accent)"></span>
					</span>
					<span class="text-base-content/55 text-[10px] font-bold whitespace-nowrap tabular-nums">{task.progress}/{task.goal} {task.unit}</span>
				</div>
				<footer class="border-base-300 mt-1.5 flex items-center justify-between gap-2 border-t border-dashed pt-1">
					<span class="flex min-w-0 items-center gap-2">
						<i class="fas {task.reward.icon} shrink-0 text-[14px]" style="color: {task.reward.tone}"></i>
						<span class="min-w-0">
							<strong class="text-base-content block truncate text-[11px] font-bold">{task.reward.title}</strong>
							<span class="text-base-content/50 block truncate text-[9.5px] font-semibold">{task.reward.note}</span>
						</span>
					</span>
					{#if done}
						<span class="text-success flex shrink-0 items-center gap-1 text-[11px] font-bold"><i class="fas fa-circle-check"></i>Claimed</span>
					{:else if complete && task.claimable}
						<span
							class="tasks-press bg-success relative flex h-7 shrink-0 items-center gap-1 overflow-hidden rounded-lg px-2.5 text-[11px] font-extrabold text-white"
							class:tasks-pressed={tapped(CLAIM.press)}
						>
							<i class="fas fa-gift"></i>Claim
							{#if tapped(CLAIM.press)}<span class="tasks-ripple"></span>{/if}
						</span>
					{:else}
						<span class="text-base-content/40 shrink-0 text-[10px] font-bold whitespace-nowrap">{fmt(task.goal - task.progress)} to go</span>
					{/if}
				</footer>
			</article>
		{/each}
	</div>

	<div class="tasks-overlay absolute inset-0 bg-black/40" class:tasks-overlay-on={celebrating}></div>

	<div
		class="tasks-modal border-base-300 bg-base-100 absolute top-1/2 left-1/2 w-[80%] rounded-2xl border px-4 pt-5 pb-4 text-center shadow-2xl"
		class:tasks-modal-on={celebrating}
	>
		<span class="block text-[34px] leading-none">🔥</span>
		<p class="text-base-content mt-2 text-[17px] font-extrabold tracking-tight">One week</p>
		<p class="text-base-content/60 mt-1 text-[12px]">7-day streak. Every task now pays +14% XP.</p>
	</div>
</div>

<style>
	.tasks-press {
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.tasks-pressed {
		transform: scale(0.95);
	}

	.tasks-bar {
		transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.tasks-bump {
		transition: transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.tasks-bumped {
		transform: scale(1.35);
	}

	.tasks-ripple {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 48px;
		height: 48px;
		margin: -24px 0 0 -24px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.5);
		pointer-events: none;
		animation: tasks-ripple 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes tasks-ripple {
		from {
			opacity: 0.6;
			transform: scale(0.4);
		}
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	.tasks-overlay {
		opacity: 0;
		transition: opacity 240ms ease;
	}

	.tasks-overlay-on {
		opacity: 1;
	}

	.tasks-modal {
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.95);
		transition:
			opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.tasks-modal-on {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		.tasks-press,
		.tasks-bar,
		.tasks-bump,
		.tasks-overlay,
		.tasks-modal {
			transition: none;
		}

		.tasks-ripple {
			animation: none;
			opacity: 0;
		}
	}
</style>
