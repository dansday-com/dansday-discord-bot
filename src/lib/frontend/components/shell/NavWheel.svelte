<script lang="ts">
	import { fade } from 'svelte/transition';
	import { afterNavigate } from '$app/navigation';
	import { scrollLocked } from '../../scrollLock.js';
	import type { NavTab } from './types';

	let {
		tabs,
		subTabs = null,
		label = 'Menu'
	}: {
		tabs: NavTab[];
		subTabs?: NavTab[] | null;
		label?: string;
	} = $props();

	let open = $state(false);

	const current = $derived(tabs.find((t) => t.active) ?? tabs[0]);

	afterNavigate(() => {
		open = false;
	});

	const INNER = 0.3;
	const LABEL = 0.79;
	const GAP = 0.012;
	const STEPS = 8;

	const rad = (deg: number) => (deg * Math.PI) / 180;
	const pad = (r: number) => (Math.asin(GAP / r) * 180) / Math.PI;
	const at = (r: number, deg: number) => `${(50 + 50 * r * Math.cos(rad(deg))).toFixed(2)}% ${(100 - 100 * r * Math.sin(rad(deg))).toFixed(2)}%`;
	const arc = (r: number, from: number, to: number) => Array.from({ length: STEPS + 1 }, (_, k) => at(r, from + ((to - from) * k) / STEPS));

	const wedges = $derived.by(() => {
		const span = 180 / tabs.length;
		return tabs.map((tab, i) => {
			const start = 180 - i * span;
			const end = start - span;
			const mid = rad(start - span / 2);
			return {
				tab,
				clip: `polygon(${[...arc(1, start - pad(1), end + pad(1)), ...arc(INNER, end + pad(INNER), start - pad(INNER))].join(', ')})`,
				left: 50 + 50 * LABEL * Math.cos(mid),
				top: 100 - 100 * LABEL * Math.sin(mid)
			};
		});
	});

	const ACTIVE = 'from-secondary to-primary bg-linear-to-br text-white';
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && (open = false)} />

<div class="sm:hidden" data-nav-wheel>
	{#if open}
		<div use:scrollLocked transition:fade={{ duration: 140 }} class="fixed inset-0 z-50">
			<button type="button" class="bg-base-content/45 absolute inset-0 size-full backdrop-blur-[4px]" aria-label="Close menu" onclick={() => (open = false)}
			></button>

			<nav
				id="nav-wheel"
				aria-label={label}
				class="pointer-events-none absolute bottom-11 left-1/2 flex w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-3.5"
			>
				{#if subTabs?.length}
					<div data-lenis-prevent class="motion-safe:animate-fade-up flex max-h-[calc(100dvh-17rem)] flex-wrap justify-center gap-2 overflow-y-auto">
						{#each subTabs as tab}
							<a
								href={tab.href}
								data-sveltekit-preload-data="hover"
								aria-current={tab.active ? 'page' : undefined}
								class="border-base-300 pointer-events-auto inline-flex items-center gap-[7px] rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap {tab.active
									? ACTIVE
									: 'text-base-content/70 bg-base-200'}"
								onclick={() => (open = false)}
							>
								{#if tab.icon}<i class="fas {tab.icon}"></i>{/if}{tab.label}
							</a>
						{/each}
					</div>
				{/if}

				<div
					class="motion-safe:animate-wheel-open relative aspect-2/1 origin-bottom text-[length:min(9.5px,2.65vw)] drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
				>
					{#each wedges as wedge}
						<a
							href={wedge.tab.href}
							data-sveltekit-preload-data="hover"
							aria-current={wedge.tab.active ? 'page' : undefined}
							class="pointer-events-auto absolute inset-0 active:brightness-95 {wedge.tab.active ? ACTIVE : 'text-base-content/80 bg-base-200'}"
							style="clip-path: {wedge.clip}"
							onclick={() => (open = false)}
						>
							<span
								class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[0.5em] leading-none font-bold whitespace-nowrap"
								style="left: {wedge.left}%; top: {wedge.top}%"
							>
								{#if wedge.tab.icon}<i class="fas {wedge.tab.icon} text-[1.8em]"></i>{/if}
								{wedge.tab.label}
								{#if wedge.tab.badge}
									<span
										class="absolute top-full mt-[0.4em] rounded-full px-[0.6em] py-[0.2em] text-[0.95em] tabular-nums {wedge.tab.active
											? 'bg-white/25'
											: 'bg-base-content/10'}"
									>
										{wedge.tab.badge}
									</span>
								{/if}
							</span>
						</a>
					{/each}
				</div>
			</nav>
		</div>
	{/if}

	<button
		type="button"
		data-tab-id={current?.id}
		aria-label={open ? 'Close menu' : label}
		aria-expanded={open}
		aria-controls="nav-wheel"
		class="ring-canvas fixed bottom-4 left-1/2 z-50 grid size-14 -translate-x-1/2 place-items-center rounded-full shadow-[0_10px_24px_-6px_color-mix(in_srgb,var(--color-primary)_75%,transparent)] ring-4 transition-transform active:scale-95 {ACTIVE}"
		onclick={() => (open = !open)}
	>
		{#if open}
			<i class="fas fa-xmark text-xl"></i>
		{:else}
			<span class="flex flex-col items-center gap-0.5 leading-none">
				<i class="fas fa-chevron-up text-[8px] opacity-75"></i>
				{#if current?.icon}<i class="fas {current.icon} text-lg"></i>{/if}
			</span>
			{#if current?.badge}
				<span
					class="border-base-300 bg-base-100 text-base-content absolute -top-1.5 left-[62%] rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-bold whitespace-nowrap tabular-nums shadow-sm {current.badgeBump
						? 'motion-safe:animate-pop-in'
						: ''}"
				>
					{current.badge}
				</span>
			{/if}
		{/if}
	</button>
</div>
