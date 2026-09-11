<script lang="ts">
	import { normalizeEffect, normalizeSeed } from '$lib/effects.js';
	import { createScene, fxVariant, runScene } from '$lib/frontend/fx/engine.js';
	import { PROGRAMS } from '$lib/frontend/fx/programs.js';

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

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = node.clientWidth || 360;
			const h = node.clientHeight || 112;
			aspect = Math.max(0.6, Math.min(7, w / Math.max(1, h)));
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
		if (!node) return;
		if (typeof IntersectionObserver === 'undefined') {
			live = true;
			return;
		}
		live = always;
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) live = entry.isIntersecting;
			},
			{ rootMargin: '160px' }
		);
		io.observe(node);
		return () => io.disconnect();
	});

	$effect(() => {
		const el = canvas;
		const prog = program;
		if (!el || !prog || family === 'none') return;
		const variant = fxVariant(family, seed, accent);
		const scene = createScene(el, prog, variant, aspect);
		prog.frame(scene);
		if (!live || frozen) return;
		if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return runScene(el, prog, scene, family === 'fire' ? 18 : 24);
	});
</script>

{#if family !== 'none' && program}
	<div bind:this={host} class="fx fx-{family}" data-fx-seed={normalizeSeed(seed)} aria-hidden="true">
		<canvas bind:this={canvas} class="fx-canvas"></canvas>
	</div>
{/if}
