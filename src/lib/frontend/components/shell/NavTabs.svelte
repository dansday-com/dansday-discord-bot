<script lang="ts">
	import type { NavTab } from './types';

	let {
		tabs,
		variant = 'pill',
		arrows = false,
		pulse = false
	}: {
		tabs: NavTab[];
		variant?: 'pill' | 'segment';
		arrows?: boolean;
		pulse?: boolean;
	} = $props();

	let strip: HTMLDivElement | undefined = $state();
	let canLeft = $state(false);
	let canRight = $state(false);

	function update() {
		const el = strip;
		if (!el) return;
		canLeft = el.scrollLeft > 1;
		canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
	}

	function nudge(dir: -1 | 1) {
		const el = strip;
		if (!el) return;
		el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
	}

	$effect(() => {
		tabs;
		requestAnimationFrame(update);
	});

	const ACTIVE = 'from-secondary to-primary bg-linear-to-br text-white shadow-[0_2px_12px_rgba(228,61,18,0.4)]';
	const ARROW =
		'border-base-300 bg-base-200 text-base-content absolute top-1/2 z-2 grid size-7.5 -translate-y-1/2 place-items-center rounded-full border shadow-md transition-opacity';
</script>

<div class="relative {arrows ? '' : 'contents'}">
	{#if arrows}
		<button
			type="button"
			class="{ARROW} left-0 {canLeft ? 'opacity-100' : 'pointer-events-none opacity-0'}"
			aria-label="Scroll categories left"
			tabindex={canLeft ? 0 : -1}
			onclick={() => nudge(-1)}
		>
			<i class="fas fa-chevron-left"></i>
		</button>
	{/if}

	<div
		bind:this={strip}
		onscroll={update}
		class="flex overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden {variant === 'segment'
			? 'border-base-300 bg-base-200 min-w-0 flex-auto gap-[3px] rounded-xl border p-[3px]'
			: 'gap-2'}"
	>
		{#each tabs as tab}
			<a
				href={tab.href}
				data-tab-id={tab.id}
				data-sveltekit-preload-data="hover"
				class="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap {variant === 'segment'
					? 'flex-[1_0_auto] justify-center rounded-lg px-3 py-2 text-[13px] font-semibold'
					: 'border-base-300 rounded-xl border px-3.5 py-2 text-[13px] font-semibold'} {tab.active
					? ACTIVE
					: variant === 'segment'
						? 'text-base-content/70'
						: 'text-base-content/60 bg-base-200'} {tab.active && pulse ? 'animate-item-burst' : ''}"
			>
				{#if tab.icon}<i class="fas {tab.icon}"></i>{/if}{tab.label}
				{#if tab.badge}
					<span class="rounded-full bg-white/25 px-1.5 text-[11px] tabular-nums {tab.badgeBump ? 'animate-item-burst' : ''}">{tab.badge}</span>
				{/if}
			</a>
		{/each}
	</div>

	{#if arrows}
		<button
			type="button"
			class="{ARROW} right-0 {canRight ? 'opacity-100' : 'pointer-events-none opacity-0'}"
			aria-label="Scroll categories right"
			tabindex={canRight ? 0 : -1}
			onclick={() => nudge(1)}
		>
			<i class="fas fa-chevron-right"></i>
		</button>
	{/if}
</div>
