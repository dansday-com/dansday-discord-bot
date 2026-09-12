<script lang="ts">
	import { normalizeEffect, normalizeSeed } from '$lib/effects.js';
	import { createScene, fxVariant, runScene, type FxScene } from '$lib/frontend/fx/engine.js';
	import { BLEND, PROGRAMS } from '$lib/frontend/fx/programs.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
		frozen?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, always = false, frozen = false }: Props = $props();

	const family = $derived(normalizeEffect(effectId));
	const program = $derived(PROGRAMS[family]);

	let host = $state<HTMLDivElement | undefined>();
	let canvas = $state<HTMLCanvasElement | undefined>();
	let live = $state(false);
	let aspect = $state(3.2);
	let boxH = $state(0);
	let scene = $state.raw<FxScene | undefined>(undefined);

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = node.clientWidth || 360;
			const h = node.clientHeight || 112;
			const next = Math.max(0.6, Math.min(7, w / Math.max(1, h)));
			const quantised = Math.round(next * 8) / 8;
			if (quantised !== aspect) aspect = quantised;
			const rows = Math.round(h / 4) * 4;
			if (rows !== boxH) boxH = rows;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
	});

	$effect(() => {
		const node = host;
		if (!node || family === 'none' || frozen) return;
		const parent = node.parentElement;
		if (!parent) return;
		parent.setAttribute('data-fx-host', family);
		return () => {
			parent.removeAttribute('data-fx-host');
			parent.removeAttribute('data-fx-run');
		};
	});

	$effect(() => {
		const parent = host?.parentElement;
		if (!parent) return;
		parent.toggleAttribute('data-fx-run', live && !frozen && family !== 'none');
	});

	$effect(() => {
		if (family === 'none' || frozen) return;
		const node = host;
		const ungated = always;
		if (!node) return;
		if (typeof IntersectionObserver === 'undefined') {
			live = ungated;
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) live = entry.isIntersecting;
			},
			{ rootMargin: '160px' }
		);
		io.observe(node);
		return () => io.disconnect();
	});

	let builtKey = '';

	$effect(() => {
		const el = canvas;
		const prog = program;
		const fam = family;
		const sd = seed;
		const ac = accent;
		const ratio = aspect;
		const height = boxH;
		const seen = live;
		if (!el || !prog || fam === 'none' || !seen) return;
		const key = `${fam}|${sd}|${ac}|${ratio}|${height}`;
		if (key === builtKey && scene) return;
		builtKey = key;
		const built = createScene(el, prog, fxVariant(fam, sd, ac), ratio, height);
		prog.frame(built);
		scene = built;
	});

	$effect(() => {
		const el = canvas;
		const prog = program;
		const sc = scene;
		const running = live;
		const halted = frozen;
		const fam = family;
		if (!el || !prog || !sc || !running || halted) return;
		if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const card = host?.parentElement;
		return runScene(el, prog, sc, fam === 'fire' ? 18 : 24, (scene) => {
			if (scene.out !== undefined) card?.style.setProperty('--fx-cover', scene.out.toFixed(3));
		});
	});
</script>

{#if family !== 'none' && program}
	<div bind:this={host} class="fx fx-{family}" data-fx-seed={normalizeSeed(seed)} aria-hidden="true">
		<canvas bind:this={canvas} class="fx-canvas" style="mix-blend-mode: {BLEND[family] ?? 'screen'}"></canvas>
	</div>
{/if}
