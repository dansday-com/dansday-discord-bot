<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { GLOBE_PLACES, type GlobePlace } from './countries.js';
	import type { LiveGainBatch } from '$lib/frontend/public/statistics/liveGlobal.svelte.js';
	import { BRAND_PRIMARY } from '$lib/brand.js';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import { attemptSync } from '$lib/utils/attempt.js';
	import { GlobeView, type GlobePulse } from './globe.js';

	type Props = { gains: LiveGainBatch | null; avoid?: (HTMLElement | null)[] };
	type Pulse = GlobePulse;

	let { gains, avoid = [] }: Props = $props();

	let canvasHost: HTMLDivElement | null = $state(null);
	let stage: HTMLDivElement | null = $state(null);
	let hasWebgl = $state(true);
	let pulses = $state<Pulse[]>([]);

	const labelEls: Record<number, HTMLElement | undefined> = {};
	const labelSizes = new Map<number, { w: number; h: number }>();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));
	const amount = (pulse: Pulse) => `+${fmt(pulse.xp)} XP`;

	const PULSE_MS = 5600;
	const MAX_RIGS = 8;
	const MAX_PER_BATCH = 5;
	const RECENT_PLACES_KEPT = 8;
	const RANDOM_PLACE_TRIES = 12;
	const PULSE_STAGGER_MS = 260;
	const PULSE_JITTER_MS = 180;
	const IDLE_FALLBACK_MS = 300;
	const NARROW_PIXEL_RATIO_CAP = 1.25;
	const PIXEL_RATIO_CAP = 1.5;
	const POINTER_CENTER_FRACTION = 0.5;
	const REDUCED_PRUNE_INTERVAL_MS = 1400;
	const NARROW_FRAME_GAP_MS = 32;

	let seq = 0;
	const recent: string[] = [];
	let dispose: (() => void) | null = null;
	let requestFrame: (() => void) | null = null;
	let pickFacing: ((exclude: string[]) => GlobePlace | null) | null = null;
	let isOnScreen = true;

	function remember(place: GlobePlace): GlobePlace {
		recent.push(place.name);
		if (recent.length > RECENT_PLACES_KEPT) {
			recent.shift();
		}
		return place;
	}

	function pickPlace(): GlobePlace {
		const facing = pickFacing?.(recent);
		if (facing) {
			return remember(facing);
		}
		for (let i = 0; i < RANDOM_PLACE_TRIES; i++) {
			const place = GLOBE_PLACES[Math.floor(Math.random() * GLOBE_PLACES.length)];
			if (!recent.includes(place.name)) {
				return remember(place);
			}
		}
		return GLOBE_PLACES[Math.floor(Math.random() * GLOBE_PLACES.length)];
	}

	function spawn(xp: number, delay = 0) {
		if (!(xp > 0)) {
			return;
		}
		pulses = [...pulses, { id: ++seq, place: pickPlace(), xp, born: performance.now() + delay }].slice(-MAX_RIGS);
		requestFrame?.();
	}

	$effect(() => {
		const batch = gains;
		if (!batch?.items.length) {
			return;
		}
		untrack(() => {
			batch.items.slice(-MAX_PER_BATCH).forEach((xp, index) => spawn(xp, index * PULSE_STAGGER_MS + Math.random() * PULSE_JITTER_MS));
		});
	});

	function waitForStart(isReduced: boolean) {
		return new Promise<void>((resolve) => {
			if (!isReduced) {
				dispose = onFirstInteraction(resolve);
				return;
			}
			if ('requestIdleCallback' in window) {
				requestIdleCallback(() => resolve(), { timeout: 2500 });
			} else {
				setTimeout(resolve, IDLE_FALLBACK_MS);
			}
		});
	}

	async function createView(isReduced: boolean, isNarrow: boolean): Promise<GlobeView | null> {
		const THREE = await import('three').catch(() => null);
		if (!THREE) {
			hasWebgl = false;
			return null;
		}
		if (!canvasHost) {
			return null;
		}

		const rendererResult = attemptSync(() => new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }));
		if (!rendererResult.ok) {
			hasWebgl = false;
			return null;
		}
		const renderer = rendererResult.value;

		renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? NARROW_PIXEL_RATIO_CAP : PIXEL_RATIO_CAP));
		renderer.setClearAlpha(0);
		canvasHost.appendChild(renderer.domElement);
		renderer.domElement.style.cssText = isReduced
			? 'width:100%;height:100%;display:block'
			: 'width:100%;height:100%;display:block;opacity:0;transition:opacity 0.9s ease-out';

		return new GlobeView(THREE, { renderer, maxRigs: MAX_RIGS, pulseMs: PULSE_MS, isReduced });
	}

	function readToken(token: string, fallback: string) {
		const value = getComputedStyle(canvasHost as HTMLElement)
			.getPropertyValue(token)
			.trim();
		return /^(#|rgb)/i.test(value) ? value : fallback;
	}

	function loadCoastlines(view: GlobeView) {
		fetch('/geo/coastlines.json')
			.then((res) => (res.ok ? res.json() : null))
			.then((arcs: number[][] | null) => {
				if (!arcs?.length) {
					return;
				}
				view.addCoastlines(arcs);
				requestFrame?.();
			})
			.catch(() => {});
	}

	function drawFrame(view: GlobeView, now: number) {
		const active = pulses;
		const expired = view.render(now, active);
		const { placements, hidden } = view.layoutLabels(now, active, { stage, avoid, elements: labelEls, sizes: labelSizes });

		for (const el of hidden) {
			el.style.opacity = '0';
		}
		for (const place of placements) {
			place.el.style.transform = `translate(${Math.round(place.x)}px, ${Math.round(place.y)}px) translateY(-100%)`;
			place.el.style.opacity = String(place.opacity);
		}

		if (expired.length) {
			for (const id of expired) {
				labelSizes.delete(id);
			}
			pulses = pulses.filter((pulse) => !expired.includes(pulse.id));
		}
	}

	function observe(view: GlobeView, host: HTMLDivElement): () => void {
		const onPointer = (event: PointerEvent) => {
			view.pointTo(
				(event.clientX / Math.max(1, window.innerWidth) - POINTER_CENTER_FRACTION) * 2,
				(event.clientY / Math.max(1, window.innerHeight) - POINTER_CENTER_FRACTION) * 2
			);
		};
		window.addEventListener('pointermove', onPointer, { passive: true });

		const resize = () => {
			const { clientWidth: w, clientHeight: h } = host;
			if (!w || !h) {
				return;
			}
			view.resize(w, h);
			requestFrame?.();
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		const io = new IntersectionObserver(
			(entries) => {
				isOnScreen = entries.some((entry) => entry.isIntersecting);
				if (isOnScreen) {
					requestFrame?.();
				}
			},
			{ threshold: 0 }
		);
		io.observe(host);

		const themeWatch = new MutationObserver(() => {
			view.paint(readToken, BRAND_PRIMARY);
			requestFrame?.();
		});
		themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

		return () => {
			window.removeEventListener('pointermove', onPointer);
			ro.disconnect();
			io.disconnect();
			themeWatch.disconnect();
		};
	}

	function startReducedLoop(view: GlobeView): () => void {
		let isPending = false;
		requestFrame = () => {
			if (isPending) {
				return;
			}
			isPending = true;
			requestAnimationFrame((now) => {
				isPending = false;
				drawFrame(view, now);
			});
		};
		const slow = setInterval(() => {
			const now = performance.now();
			if (pulses.some((pulse) => now - pulse.born > PULSE_MS)) {
				pulses = pulses.filter((pulse) => now - pulse.born <= PULSE_MS);
				requestFrame?.();
			}
		}, REDUCED_PRUNE_INTERVAL_MS);
		requestFrame();
		return () => clearInterval(slow);
	}

	function startMotionLoop(view: GlobeView, minGap: number): () => void {
		let raf = 0;
		let last = -Infinity;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			if (!isOnScreen || document.hidden || now - last < minGap) {
				return;
			}
			last = now;
			drawFrame(view, now);
		};
		requestFrame = () => {};
		raf = requestAnimationFrame((now) => {
			tick(now);
			view.canvas.style.opacity = '1';
		});
		return () => cancelAnimationFrame(raf);
	}

	onMount(async () => {
		const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const isNarrow = window.matchMedia('(max-width: 640px)').matches;

		await waitForStart(isReduced);
		dispose = null;

		const view = await createView(isReduced, isNarrow);
		if (!view || !canvasHost) {
			return;
		}

		view.paint(readToken, BRAND_PRIMARY);
		loadCoastlines(view);
		const unobserve = observe(view, canvasHost);
		pickFacing = (exclude: string[]) => view.pickFacing(exclude);
		const stopLoop = isReduced ? startReducedLoop(view) : startMotionLoop(view, isNarrow ? NARROW_FRAME_GAP_MS : 0);

		dispose = () => {
			stopLoop();
			unobserve();
			view.dispose();
			requestFrame = null;
			pickFacing = null;
		};
	});

	onDestroy(() => {
		dispose?.();
		dispose = null;
	});
</script>

{#if hasWebgl}
	<div class="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden" aria-hidden="true">
		<div bind:this={stage} class="absolute inset-0">
			<div bind:this={canvasHost} class="absolute inset-0"></div>
			{#each pulses as pulse (pulse.id)}
				<div
					bind:this={labelEls[pulse.id]}
					class="pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform motion-safe:transition-opacity motion-safe:duration-200"
				>
					<div class="border-base-300 bg-base-100/85 rounded-sm border px-2 py-1.5 backdrop-blur-[2px]">
						<p class="text-base-content/55 text-[8.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase 2xl:text-[10px]">
							{pulse.place.name}
						</p>
						<p class="text-primary mt-1 text-[11.5px] leading-none font-black whitespace-nowrap tabular-nums 2xl:text-[14px]">
							{amount(pulse)}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
