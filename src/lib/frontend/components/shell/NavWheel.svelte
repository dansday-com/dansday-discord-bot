<script lang="ts">
	import { fade } from 'svelte/transition';
	import { afterNavigate, goto, preloadData } from '$app/navigation';
	import { scrollLocked } from '../../scrollLock.js';
	import type { NavTab } from './types';

	let { tabs, label = 'Menu' }: { tabs: NavTab[]; label?: string } = $props();

	let open = $state(false);
	let hover = $state<string | null>(null);
	let preview = $state<number | null>(null);

	let pointer: number | null = null;
	let wasOpen = false;
	let releasedAt = -Infinity;
	let restTimer: ReturnType<typeof setTimeout> | undefined;
	let restX = 0;
	let restY = 0;

	const currentIndex = $derived(
		Math.max(
			0,
			tabs.findIndex((t) => t.active)
		)
	);
	const current = $derived(tabs[currentIndex]);
	const shownIndex = $derived(preview ?? currentIndex);
	const chips = $derived(tabs[shownIndex]?.children ?? []);

	const REST_MS = 130;
	const REST_RADIUS = 10;
	const CLICK_GUARD_MS = 400;

	function close() {
		clearTimeout(restTimer);
		pointer = null;
		open = false;
		hover = null;
		preview = null;
	}

	afterNavigate(close);

	function keyOf(el: EventTarget | null): string | null {
		return (el as Element | null)?.closest?.<HTMLElement>('[data-wheel]')?.dataset.wheel ?? null;
	}

	function hrefOf(key: string | null): string | null {
		if (!key) return null;
		const i = Number(key.slice(1));
		if (key[0] === 's') return tabs[i]?.href ?? null;
		if (key[0] === 'c') return chips[i]?.href ?? null;
		return null;
	}

	function track(x: number, y: number) {
		const key = keyOf(document.elementFromPoint(x, y));
		if (key === hover && Math.hypot(x - restX, y - restY) <= REST_RADIUS) return;
		hover = key;
		restX = x;
		restY = y;
		clearTimeout(restTimer);
		if (!hrefOf(key)) return;
		restTimer = setTimeout(() => {
			const href = hrefOf(key);
			if (key?.[0] === 's') preview = Number(key.slice(1));
			if (href) preloadData(href);
		}, REST_MS);
	}

	function press(e: PointerEvent) {
		if (pointer !== null || !keyOf(e.target)) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		pointer = e.pointerId;
		wasOpen = open;
		open = true;
		track(e.clientX, e.clientY);
	}

	function move(e: PointerEvent) {
		if (e.pointerId === pointer) track(e.clientX, e.clientY);
	}

	function release(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		releasedAt = e.timeStamp;
		clearTimeout(restTimer);
		const key = keyOf(document.elementFromPoint(e.clientX, e.clientY));
		const href = hrefOf(key);
		if (href) {
			close();
			goto(href);
		} else if (key === 'orb' && !wasOpen) {
			hover = null;
		} else {
			close();
		}
	}

	function cancel(e: PointerEvent) {
		if (e.pointerId !== pointer) return;
		pointer = null;
		clearTimeout(restTimer);
		hover = null;
	}

	function handled(e: MouseEvent): boolean {
		return e.timeStamp - releasedAt < CLICK_GUARD_MS;
	}

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
	const TOUCH = 'touch-none select-none [-webkit-touch-callout:none] *:pointer-events-none';
</script>

<svelte:window
	onkeydown={(e) => open && e.key === 'Escape' && close()}
	onpointerdown={press}
	onpointermove={move}
	onpointerup={release}
	onpointercancel={cancel}
	oncontextmenu={(e) => keyOf(e.target) && e.preventDefault()}
/>

<div class="sm:hidden">
	{#if open}
		<div use:scrollLocked transition:fade={{ duration: 140 }} class="fixed inset-0 z-50">
			<button type="button" class="bg-base-content/45 absolute inset-0 size-full touch-none backdrop-blur-[4px]" aria-label="Close menu" onclick={close}
			></button>

			<nav
				id="nav-wheel"
				aria-label={label}
				class="pointer-events-none absolute bottom-11 left-1/2 flex w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col gap-3.5"
			>
				{#key shownIndex}
					{#if chips.length}
						<div data-lenis-prevent class="motion-safe:animate-fade-up flex max-h-[calc(100dvh-17rem)] flex-wrap justify-center gap-2 overflow-y-auto">
							{#each chips as tab, i}
								<a
									href={tab.href}
									data-wheel="c{i}"
									data-sveltekit-preload-data="hover"
									draggable="false"
									aria-current={tab.active ? 'page' : undefined}
									class="pointer-events-auto inline-flex items-center gap-[7px] rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-[scale] duration-150 {TOUCH} {hover ===
									`c${i}`
										? 'border-primary bg-base-100 text-primary scale-105'
										: tab.active
											? `border-base-300 ${ACTIVE}`
											: 'border-base-300 text-base-content/70 bg-base-200'}"
									onclick={(e) => handled(e) && e.preventDefault()}
								>
									{#if tab.icon}<i class="fas {tab.icon}"></i>{/if}{tab.label}
								</a>
							{/each}
						</div>
					{/if}
				{/key}

				<div
					class="motion-safe:animate-wheel-open relative aspect-2/1 origin-bottom text-[length:min(9.5px,2.65vw)] drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
				>
					{#each wedges as wedge, i}
						{@const lit = hover === `s${i}` || preview === i}
						<a
							href={wedge.tab.href}
							data-wheel="s{i}"
							data-sveltekit-preload-data="hover"
							draggable="false"
							aria-current={wedge.tab.active ? 'page' : undefined}
							class="pointer-events-auto absolute inset-0 origin-bottom transition-[scale] duration-150 {TOUCH} {lit ? 'scale-105' : ''} {wedge.tab.active
								? ACTIVE
								: lit
									? 'bg-base-100 text-primary'
									: 'text-base-content/80 bg-base-200'}"
							style="clip-path: {wedge.clip}"
							onclick={(e) => handled(e) && e.preventDefault()}
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
		data-wheel="orb"
		data-tab-id={current?.id}
		aria-label={open ? 'Close menu' : label}
		aria-expanded={open}
		aria-controls="nav-wheel"
		class="ring-canvas fixed bottom-4 left-1/2 z-50 grid size-14 -translate-x-1/2 place-items-center rounded-full shadow-[0_10px_24px_-6px_color-mix(in_srgb,var(--color-primary)_75%,transparent)] ring-4 transition-transform active:scale-95 {TOUCH} {ACTIVE}"
		onclick={(e) => !handled(e) && (open ? close() : (open = true))}
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
