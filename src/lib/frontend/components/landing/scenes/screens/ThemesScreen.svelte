<script lang="ts">
	import { onMount } from 'svelte';
	import { EFFECT_SPIN_COST, effectMeta } from '$lib/effects.js';
	import { avatar } from '../scripts/common.js';
	import type { SceneScreenProps } from '../types.js';

	type Effect = typeof import('$lib/frontend/components/ThemeEffect.svelte').default;

	let { t }: SceneScreenProps = $props();

	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

	const SPIN = { press: 1800, open: 2100, land: 5200, close: 7200 };
	const PAINT = { hero: 7200, row: 9600, card: 10200 };
	const REEL = ['glitch', 'sparkle', 'fire', 'sakura', 'love', 'blackhole', 'autumn', 'pulse', 'aurora'].map((id) => effectMeta(id)!);
	const WON = REEL[REEL.length - 1];
	const SEED = 7;
	const ACCENT = '#c0330f';
	const START_XP = 4432;
	const CELL = 44;

	let Effect = $state<Effect | null>(null);
	onMount(() => {
		import('$lib/frontend/components/ThemeEffect.svelte').then((m) => (Effect = m.default));
	});

	const tapped = (at: number) => t >= at && t < at + 520;
	const modalOpen = $derived(t >= SPIN.open && t < SPIN.close);
	const landed = $derived(t >= SPIN.land);
	const xp = $derived(landed ? START_XP - EFFECT_SPIN_COST : START_XP);

	const reelOffset = $derived.by(() => {
		const p = Math.max(0, Math.min(1, (t - SPIN.open) / (SPIN.land - SPIN.open)));
		return (1 - Math.pow(1 - p, 3)) * (REEL.length - 1) * CELL;
	});
</script>

{#snippet paint(at: number)}
	{#if Effect && t >= at}<Effect effect={WON.id} seed={SEED} accent={ACCENT} />{/if}
{/snippet}

{#snippet rowPaint(at: number)}
	{#if t >= at}
		<span
			class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-[color-mix(in_srgb,var(--row-accent)_20%,transparent)] to-transparent"
			aria-hidden="true"
		></span>
		<span class="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[3px] bg-(--row-accent)" aria-hidden="true"></span>
		{@render paint(at)}
	{/if}
{/snippet}

<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="flex h-10 shrink-0 items-center px-3">
		<span class="bg-base-300/70 text-base-content/70 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[12px]">
			<i class="fas fa-lock text-[9px]"></i>dansday.dev
		</span>
	</div>

	<div class="from-primary relative isolate mx-3 mt-1 flex h-24 shrink-0 items-center gap-3 overflow-hidden rounded-2xl bg-linear-to-br to-[#7a1e06] px-3.5">
		{@render paint(PAINT.hero)}
		<img src={avatar(2)} alt="" class="relative size-10 shrink-0 rounded-full ring-2 ring-white/60" loading="lazy" />
		<div class="relative min-w-0 flex-1">
			<p class="flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] text-white/60 uppercase"><i class="fas fa-wallet"></i>Wallet</p>
			<p class="truncate text-[13px] font-extrabold text-white">Mira</p>
			<p class="text-[19px] leading-tight font-extrabold text-white tabular-nums">
				{fmt(xp)}<span class="ml-1 text-[11px] font-bold text-white/70">XP</span>
			</p>
		</div>
		<div class="relative flex shrink-0 flex-col items-center border-l border-white/15 pl-3 leading-tight">
			<b class="block text-[15px] font-extrabold text-white tabular-nums">#9</b><span class="text-[8.5px] font-bold text-white/60 uppercase">Rank</span>
		</div>
	</div>

	<section class="border-base-300 bg-base-100 mx-3 mt-2.5 shrink-0 rounded-[14px] border px-3 py-2.5">
		<p class="text-base-content flex items-center justify-between gap-2 text-[11.5px] font-extrabold">
			<span class="flex items-center gap-1.5"><i class="fas fa-wand-magic-sparkles text-base-content/45"></i>Effect</span>
			<span class="flex items-center gap-1.5 text-[11px] {t >= PAINT.hero ? 'text-primary' : 'text-base-content/50'}">
				{#if t >= PAINT.hero}<i class="fas {WON.icon}"></i>{WON.label}{:else}None{/if}
			</span>
		</p>
		<span
			class="themes-press relative mt-2 flex h-8 items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-[11.5px] font-extrabold text-white"
			class:themes-pressed={tapped(SPIN.press)}
		>
			<i class="fas fa-dice"></i>Spin · {fmt(EFFECT_SPIN_COST)} XP
			{#if tapped(SPIN.press)}<span class="themes-ripple"></span>{/if}
		</span>
		<p class="text-base-content/55 mt-1.5 text-[10px] leading-snug">Every spin rolls a fresh effect and a one-of-a-kind variant.</p>
	</section>

	<p class="text-base-content/45 mx-3 mt-3 shrink-0 text-[9.5px] font-extrabold tracking-[0.08em] uppercase">Leaderboard</p>
	<div
		class="border-base-300 bg-base-100 relative isolate mx-3 mt-1.5 flex h-[46px] shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border px-2.5"
		style="--row-accent: {ACCENT}"
	>
		{@render rowPaint(PAINT.row)}
		<span class="text-base-content/60 relative w-6 shrink-0 text-center text-[12px] font-extrabold tabular-nums">#9</span>
		<img src={avatar(2)} alt="" class="relative size-8 shrink-0 rounded-full" loading="lazy" />
		<span class="relative min-w-0 flex-1">
			<span class="text-base-content block truncate text-[12.5px] leading-tight font-bold">Mira</span>
			<span class="text-base-content/60 block text-[10.5px]">Lvl 12</span>
		</span>
		<span class="text-base-content relative shrink-0 text-[12.5px] font-extrabold tabular-nums"
			>{fmt(xp)}<span class="text-base-content/55 ml-1 text-[9px] font-bold">XP</span></span
		>
	</div>

	<p class="text-base-content/45 mx-3 mt-3 shrink-0 text-[9.5px] font-extrabold tracking-[0.08em] uppercase">Members</p>
	<div
		class="border-base-300 bg-base-100 relative isolate mx-3 mt-1.5 flex h-[60px] shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border px-2.5"
		style="--row-accent: {ACCENT}"
	>
		{@render rowPaint(PAINT.card)}
		<img src={avatar(2)} alt="" class="relative size-10 shrink-0 rounded-full" loading="lazy" />
		<span class="relative min-w-0 flex-1">
			<span class="text-base-content block truncate text-[12.5px] leading-tight font-bold">Mira</span>
			<span
				class="border-primary/30 bg-primary/10 text-base-content mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9.5px] font-semibold"
			>
				<i class="fas fa-circle text-primary text-[5px]"></i>Night Owl
			</span>
		</span>
		<span class="text-base-content/60 relative shrink-0 text-[10.5px] font-bold">Lvl 12</span>
	</div>

	<div class="themes-overlay absolute inset-0 bg-black/40" class:themes-overlay-on={modalOpen}></div>

	<div
		class="themes-modal border-base-300 bg-base-200 absolute top-1/2 left-1/2 w-[82%] rounded-2xl border px-4 pt-4 pb-4 text-center shadow-2xl"
		class:themes-modal-on={modalOpen}
	>
		<p class="text-base-content flex items-center justify-center gap-1.5 text-[13px] font-extrabold">
			<i class="fas fa-wand-magic-sparkles text-[#d9a528]"></i>Effect spin
		</p>
		<div class="border-base-300 bg-base-100 relative mt-3 overflow-hidden rounded-xl border {landed ? 'border-[#d9a528]' : ''}" style="height: {CELL}px">
			<ul style="transform: translateY(-{reelOffset}px)">
				{#each REEL as item (item.id)}
					<li
						class="flex items-center justify-center gap-2 text-[15px] font-extrabold {landed && item === WON ? 'text-primary' : 'text-base-content/75'}"
						style="height: {CELL}px"
					>
						<i class="fas {item.icon} text-[13px]"></i>{item.label}
					</li>
				{/each}
			</ul>
		</div>
		<p class="mt-2.5 text-[11.5px] font-bold {landed ? 'text-success' : 'text-base-content/55'}">
			{landed ? `${WON.label} is yours. −${fmt(EFFECT_SPIN_COST)} XP` : 'Rolling…'}
		</p>
	</div>
</div>

<style>
	.themes-press {
		transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.themes-pressed {
		transform: scale(0.96);
	}

	.themes-ripple {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 48px;
		height: 48px;
		margin: -24px 0 0 -24px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.5);
		pointer-events: none;
		animation: themes-ripple 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes themes-ripple {
		from {
			opacity: 0.6;
			transform: scale(0.4);
		}
		to {
			opacity: 0;
			transform: scale(2.2);
		}
	}

	.themes-overlay {
		opacity: 0;
		transition: opacity 240ms ease;
	}

	.themes-overlay-on {
		opacity: 1;
	}

	.themes-modal {
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.95);
		transition:
			opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.themes-modal-on {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		.themes-press,
		.themes-overlay,
		.themes-modal {
			transition: none;
		}

		.themes-ripple {
			animation: none;
			opacity: 0;
		}
	}
</style>
