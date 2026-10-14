<script lang="ts">
	import { normalizeEffect, normalizeSeed } from '$lib/effects.js';
	import { createScene, fxVariant, runScene, type FxScene } from '$lib/frontend/fx/engine.js';
	import { BLEND, PROGRAMS } from '$lib/frontend/fx/programs.js';
	import { observeVisibility } from '$lib/frontend/fx/visible.js';
	import '$lib/frontend/fx/fx.css';

	const DEFAULT_ASPECT = 3.2;
	const FALLBACK_WIDTH_PX = 360;
	const FALLBACK_HEIGHT_PX = 112;
	const MIN_ASPECT = 0.6;
	const MAX_ASPECT = 7;
	const ASPECT_STEPS = 8;
	const ROW_STEP_PX = 4;
	const FIRE_FPS = 18;
	const SCENE_FPS = 24;
	const COVER_DECIMALS = 3;

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		frozen?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, frozen = false }: Props = $props();

	const family = $derived(normalizeEffect(effectId));
	const program = $derived(PROGRAMS[family]);

	let host = $state<HTMLDivElement | undefined>();
	let canvas = $state<HTMLCanvasElement | undefined>();
	let isLive = $state(false);
	let aspect = $state(DEFAULT_ASPECT);
	let boxH = $state(0);
	let scene = $state.raw<FxScene | undefined>(undefined);

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') {
			return;
		}
		const measure = () => {
			const w = node.clientWidth || FALLBACK_WIDTH_PX;
			const h = node.clientHeight || FALLBACK_HEIGHT_PX;
			const next = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, w / Math.max(1, h)));
			const quantised = Math.round(next * ASPECT_STEPS) / ASPECT_STEPS;
			if (quantised !== aspect) {
				aspect = quantised;
			}
			const rows = Math.round(h / ROW_STEP_PX) * ROW_STEP_PX;
			if (rows !== boxH) {
				boxH = rows;
			}
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
	});

	$effect(() => {
		const node = host;
		if (!node || family === 'none' || frozen) {
			return;
		}
		const parent = node.parentElement;
		if (!parent) {
			return;
		}
		parent.setAttribute('data-fx-host', family);
		return () => {
			parent.removeAttribute('data-fx-host');
			parent.removeAttribute('data-fx-run');
		};
	});

	$effect(() => {
		const parent = host?.parentElement;
		if (!parent) {
			return;
		}
		parent.toggleAttribute('data-fx-run', isLive && !frozen && family !== 'none');
	});

	$effect(() => {
		if (family === 'none' || frozen) {
			return;
		}
		const node = host;
		if (!node) {
			return;
		}
		return observeVisibility(node, (visible) => {
			isLive = visible;
		});
	});

	let builtKey = '';
	let builtEl: HTMLCanvasElement | null = null;

	$effect(() => {
		const el = canvas;
		const prog = program;
		const fam = family;
		const sd = seed;
		const ac = accent;
		const ratio = aspect;
		const height = boxH;
		const seen = isLive;
		if (!el || !prog || fam === 'none' || !seen) {
			return;
		}
		const key = `${fam}|${sd}|${ac}|${ratio}|${height}`;
		if (key === builtKey && scene && builtEl === el) {
			return;
		}
		builtKey = key;
		builtEl = el;
		const built = createScene(el, prog, fxVariant(fam, sd, ac), ratio, height);
		prog.frame(built);
		scene = built;
	});

	$effect(() => {
		if (isLive || frozen) {
			return;
		}
		const el = canvas;
		if (!el || builtKey === '') {
			return;
		}
		scene = undefined;
		builtKey = '';
		builtEl = null;
		el.width = 0;
		el.height = 0;
	});

	$effect(() => {
		const el = canvas;
		const prog = program;
		const sc = scene;
		const running = isLive;
		const halted = frozen;
		const fam = family;
		if (!el || !prog || !sc || !running || halted) {
			return;
		}
		if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		const card = host?.parentElement;
		return runScene(el, prog, sc, fam === 'fire' ? FIRE_FPS : SCENE_FPS, (scene) => {
			if (scene.out !== undefined) {
				card?.style.setProperty('--fx-cover', scene.out.toFixed(COVER_DECIMALS));
			}
		});
	});
</script>

{#if family !== 'none' && program}
	<div bind:this={host} class="fx fx-{family}" data-fx-seed={normalizeSeed(seed)} aria-hidden="true">
		<canvas bind:this={canvas} class="fx-canvas" style="mix-blend-mode: {BLEND[family] ?? 'screen'}"></canvas>
	</div>
{/if}
