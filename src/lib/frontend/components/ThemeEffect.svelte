<script lang="ts">
	import { effectMeta, effectVariant, normalizeEffect, normalizeSeed, spreadPieces } from '$lib/effects.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
		frozen?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, always = false, frozen = false }: Props = $props();

	const QUAKE_SLABS = [
		'M0 40 L0 26 L18 12 L34 22 L36 40 Z M40 40 L44 18 L62 8 L70 24 L68 40 Z M74 40 L80 20 L96 14 L100 28 L100 40 Z',
		'M0 40 L2 20 L20 10 L30 26 L28 40 Z M34 40 L40 14 L58 6 L66 22 L62 40 Z M70 40 L78 24 L94 18 L100 32 L100 40 Z'
	];

	const QUAKE_FISSURES = [
		{ left: '1%', paths: ['M4 46 L16 30 L8 18 L20 6', 'M16 30 L38 25 L52 12', 'M38 25 L44 40'] },
		{ left: '21%', paths: ['M110 46 L96 32 L104 20 L92 8', 'M96 32 L74 27 L60 14', 'M74 27 L68 41'] },
		{ left: '41%', paths: ['M58 46 L52 28 L64 17 L56 3', 'M52 28 L28 24 L12 11', 'M64 17 L88 13 L104 4'] },
		{ left: '60%', paths: ['M22 46 L30 33 L20 21 L32 9', 'M30 33 L56 31 L76 20 L96 26', 'M76 20 L84 6'] },
		{ left: '79%', paths: ['M86 46 L78 31 L88 19 L80 5', 'M78 31 L52 29 L34 18', 'M52 29 L46 42'] }
	];

	const THUNDER_BOLTS = [
		{ main: 'M26 2 L15 38 L25 38 L9 98 L19 44 L9 44 L21 2 Z', forks: ['M20 20 L7 31', 'M17 52 L29 64'] },
		{ main: 'M22 3 L12 34 L21 34 L7 92 L16 40 L7 40 L18 3 Z', forks: ['M15 25 L29 36', 'M12 58 L2 71'] },
		{ main: 'M30 4 L19 42 L28 42 L12 96 L22 48 L12 48 L25 4 Z', forks: ['M24 24 L36 34', 'M16 62 L28 75', 'M20 40 L8 48'] },
		{ main: 'M20 2 L10 36 L19 36 L5 90 L14 42 L5 42 L16 2 Z', forks: ['M13 28 L25 39'] }
	];

	const THUNDER_CLOUDS = [
		'M4 34 Q0 22 12 20 Q9 8 24 7 Q31 -3 48 3 Q64 -5 74 6 Q90 4 92 16 Q104 15 103 26 Q105 34 92 34 Z',
		'M4 30 Q2 19 14 18 Q19 8 32 10 Q44 2 54 11 Q68 9 70 20 Q82 20 81 29 Q82 34 71 34 L10 34 Q3 34 4 30 Z',
		'M2 33 Q-2 20 10 17 Q14 5 30 8 Q40 -4 56 4 Q72 -3 82 9 Q97 9 99 21 Q108 24 104 32 Q100 36 88 34 L8 34 Q0 36 2 33 Z'
	];

	const RAINBOW_CLOUDS = [
		{
			left: '2%',
			side: 'fx-cloud-left',
			d: 'M3 34 Q0 21 13 20 Q18 8 33 11 Q46 2 58 12 Q74 10 78 21 Q92 21 91 30 Q92 37 80 37 L11 37 Q1 37 3 34 Z'
		},
		{
			left: '72%',
			side: 'fx-cloud-right',
			d: 'M6 33 Q2 20 16 19 Q23 6 38 10 Q52 1 64 13 Q80 12 84 22 Q98 23 96 31 Q97 37 85 37 L14 37 Q4 37 6 33 Z'
		}
	];

	const LENS_ARCS = [
		'M 6 50 Q 160 -22 314 50',
		'M 14 50 Q 160 122 306 50',
		'M 30 50 Q 160 -8 290 50',
		'M 38 50 Q 160 108 282 50',
		'M 118 50 A 42 42 0 0 1 202 50',
		'M 122 50 A 38 38 0 0 0 198 50',
		'M 62 22 Q 160 62 258 22',
		'M 62 78 Q 160 38 258 78'
	];

	const VOID_DRAWIN = [
		'M-16 4 C 40 22, 104 40, 150 48',
		'M336 8 C 280 24, 216 42, 170 49',
		'M-16 96 C 44 78, 106 60, 150 52',
		'M336 92 C 276 76, 214 58, 170 51',
		'M-16 50 C 44 50, 104 50, 148 50',
		'M336 50 C 276 50, 216 50, 172 50',
		'M160 -12 C 160 12, 160 32, 160 46',
		'M160 112 C 160 88, 160 68, 160 54',
		'M60 -12 C 88 16, 124 38, 150 47',
		'M260 -12 C 232 16, 196 38, 170 47',
		'M60 112 C 88 84, 124 62, 150 53',
		'M260 112 C 232 84, 196 62, 170 53'
	];

	const SAKURA_BOUGHS = [
		'M0 4 Q22 10 38 8 Q56 6 70 14 Q86 22 104 20 Q114 19 120 24 L120 16 Q108 13 96 14 Q80 15 66 8 Q50 0 30 2 Q14 3 0 0 Z M38 8 L34 22 M70 14 L76 30 M96 14 L92 27',
		'M0 10 Q18 4 34 6 Q52 8 66 18 Q82 28 100 24 Q112 21 120 14 L120 6 Q106 14 94 16 Q78 18 64 9 Q48 -1 28 0 Q12 1 0 2 Z M34 6 L30 21 M66 18 L70 34 M100 24 L104 38'
	];

	const SAKURA_BLOSSOMS = [
		[16, 9, 2.6],
		[38, 13, 3.1],
		[54, 8, 2.3],
		[72, 18, 3],
		[88, 14, 2.5],
		[104, 23, 2.8],
		[30, 24, 2.2],
		[62, 30, 2.6]
	];

	const MEADOW_TUFTS = [
		'M0 30 L4 14 L7 30 L10 9 L13 30 L17 17 L21 30 L26 6 L30 30 L35 15 L39 30 L45 11 L49 30 L55 18 L59 30 L66 8 L70 30 L77 16 L81 30 L88 10 L92 30 L99 19 L103 30 L110 12 L114 30 L120 20 L120 30 Z',
		'M0 30 L5 18 L9 30 L14 7 L18 30 L24 16 L28 30 L34 10 L38 30 L44 20 L48 30 L54 8 L58 30 L65 17 L69 30 L76 6 L80 30 L87 19 L91 30 L98 11 L102 30 L109 21 L113 30 L120 14 L120 30 Z'
	];

	const SILK_GLINTS = [
		[14, 26, 1.1],
		[38, 44, 0.9],
		[59, 30, 1.2],
		[76, 58, 1],
		[28, 70, 0.85],
		[91, 40, 1.05],
		[48, 84, 0.95]
	];

	const SILK_SASHES = [
		'M-8 26 Q18 12 42 24 Q66 36 92 20 Q104 13 112 18 L112 25 Q102 21 92 27 Q66 43 42 31 Q18 19 -8 33 Z',
		'M-8 50 Q16 37 40 49 Q64 61 90 45 Q102 38 112 43 L112 51 Q100 47 90 53 Q64 69 40 57 Q16 45 -8 58 Z',
		'M-8 74 Q20 62 44 74 Q68 86 94 70 Q104 64 112 69 L112 77 Q102 73 94 79 Q68 95 44 83 Q20 71 -8 84 Z'
	];

	const CRYSTAL_SPIKES = [
		['M12 52 L18 14 L24 52 Z', 'M24 52 L32 2 L40 52 Z', 'M40 52 L46 20 L52 52 Z', 'M2 52 L8 30 L14 52 Z'],
		['M8 52 L14 22 L20 52 Z', 'M20 52 L28 6 L36 52 Z', 'M36 52 L44 16 L50 52 Z', 'M48 52 L54 32 L60 52 Z']
	];

	const NEON_TUBES = [
		'M8 30 Q8 10 20 10 Q32 10 32 20 Q32 30 44 30 Q56 30 56 14',
		'M10 12 L26 12 L18 28 L34 28 L26 12 L46 12 M50 12 L50 30',
		'M12 28 Q12 12 24 12 Q36 12 36 28 M44 10 L44 30 M44 20 L58 20'
	];

	const AUTUMN_TREES = [
		{
			trunk: 'M56 64 L58 40 L54 30 L58 28 L60 38 L62 26 L66 28 L62 42 L64 64 Z',
			crown: 'M60 6 Q84 8 90 24 Q104 30 94 42 Q80 50 60 46 Q40 50 26 42 Q16 30 30 24 Q36 8 60 6 Z'
		},
		{
			trunk: 'M58 64 L60 44 L52 32 L57 31 L62 40 L68 30 L72 33 L64 45 L66 64 Z',
			crown: 'M60 10 Q80 6 88 20 Q102 26 92 38 Q78 48 60 44 Q42 48 28 38 Q18 26 32 20 Q40 6 60 10 Z'
		}
	];

	const SAND_DUNES = [
		'M0 40 L0 28 Q16 18 32 26 Q48 34 64 22 Q80 12 96 24 Q108 32 120 24 L120 40 Z',
		'M0 40 L0 24 Q14 32 28 22 Q44 10 60 24 Q74 36 88 26 Q104 16 120 28 L120 40 Z'
	];

	const WISH_HILLS = [
		'M0 34 L0 22 Q18 10 36 20 Q54 30 72 16 Q90 4 106 18 Q114 25 120 20 L120 34 Z',
		'M0 34 L0 18 Q16 26 30 16 Q48 4 64 18 Q80 32 96 20 Q108 11 120 22 L120 34 Z'
	];

	const RAIN_CLOUDS = [
		'fxGrain0{uid}',
		'M2 26 Q5 14 18 15 Q24 5 38 7 Q51 1 60 9 Q74 5 81 16 Q95 15 97 25 Q99 33 88 33 L10 33 Q0 33 2 26 Z',
		'M4 28 Q0 15 14 14 Q21 3 36 7 Q52 -1 64 9 Q80 7 85 19 Q97 21 95 29 Q95 36 83 35 L14 35 Q2 35 4 28 Z',
		'M2 30 Q-1 17 12 16 Q19 4 34 8 Q49 0 62 10 Q78 8 84 20 Q96 22 94 30 Q94 37 81 36 L12 36 Q0 36 2 30 Z'
	];

	const SNOW_CLOUDS = [
		'fxGsnow0{uid}',
		'M6 29 Q1 18 12 15 Q13 4 26 6 Q33 -4 45 3 Q55 -5 65 4 Q77 1 80 13 Q93 14 92 25 Q94 34 82 34 L14 34 Q4 35 6 29 Z',
		'M4 28 Q0 15 14 14 Q21 3 36 7 Q52 -1 64 9 Q80 7 85 19 Q97 21 95 29 Q95 36 83 35 L14 35 Q2 35 4 28 Z',
		'M2 30 Q-1 17 12 16 Q19 4 34 8 Q49 0 62 10 Q78 8 84 20 Q96 22 94 30 Q94 37 81 36 L12 36 Q0 36 2 30 Z'
	];

	const BLIZZARD_CLOUDS = [
		'fxGblizzard0{uid}',
		'M0 27 Q4 14 20 14 Q29 1 47 6 Q64 -3 78 6 Q94 3 100 15 Q112 15 110 25 Q108 32 92 32 L20 32 Q2 33 0 27 Z',
		'M4 28 Q0 15 14 14 Q21 3 36 7 Q52 -1 64 9 Q80 7 85 19 Q97 21 95 29 Q95 36 83 35 L14 35 Q2 35 4 28 Z',
		'M2 30 Q-1 17 12 16 Q19 4 34 8 Q49 0 62 10 Q78 8 84 20 Q96 22 94 30 Q94 37 81 36 L12 36 Q0 36 2 30 Z'
	];

	const TORNADO_CLOUDS = [
		'M4 26 Q1 14 16 13 Q22 2 38 6 Q55 -2 67 8 Q85 6 89 18 Q99 20 97 28 Q97 35 86 35 L63 35 Q59 42 50 42 Q41 42 37 35 L12 35 Q2 35 4 26 Z',
		'M2 28 Q-1 15 13 14 Q20 3 35 7 Q50 -1 63 9 Q79 7 84 19 Q96 21 94 29 Q94 36 82 36 L14 36 Q0 36 2 28 Z',
		'M6 25 Q2 12 18 12 Q26 0 42 5 Q58 -3 70 7 Q88 5 92 17 Q104 19 101 28 Q100 36 88 35 L16 35 Q4 35 6 25 Z'
	];

	const TORNADO_DEBRIS = [
		'M2 10 L20 6 L22 11 L4 15 Z',
		'M4 4 L18 8 L14 20 L6 17 Z',
		'M12 2 L21 12 L11 21 L3 12 Z',
		'M3 9 L21 9 L21 13 L3 13 Z',
		'M6 3 L19 6 L17 14 L9 18 Z'
	];

	const METEOR_CRUST = [
		'M0 34 L0 24 L11 17 L21 23 L32 12 L44 20 L55 9 L67 19 L78 11 L90 21 L101 14 L110 22 L120 16 L120 34 Z',
		'M0 34 L0 19 L10 25 L20 14 L30 22 L41 11 L52 21 L63 13 L74 23 L86 15 L97 24 L108 17 L120 25 L120 34 Z'
	];

	const METEOR_EJECTA = [
		'M50 44 L46 30 L50 33 L53 28 L52 42 Z',
		'M50 44 L38 34 L44 35 L40 29 L48 41 Z',
		'M50 44 L62 33 L57 35 L62 28 L53 41 Z',
		'M50 44 L34 42 L41 40 L33 36 L47 43 Z',
		'M50 44 L67 41 L60 40 L69 35 L54 43 Z'
	];

	const TSUNAMI_FLOTSAM = ['M28 62 L40 58 L41 62 L29 66 Z', 'M56 70 L68 67 L69 71 L57 74 Z', 'M36 78 L44 72 L48 76 L40 82 Z', 'M62 82 L74 79 L75 83 L63 86 Z'];

	const FRONT_FAMILIES = new Set(['fire', 'thunder', 'neon', 'blackhole', 'volcano', 'glass']);

	const family = $derived(normalizeEffect(effectId));
	const variant = $derived(effectVariant(family, seed, accent));
	const dotted = $derived(effectMeta(family)?.particles === true);
	const uid = $derived(`${family}${normalizeSeed(seed)}`);

	let host = $state<HTMLDivElement | undefined>();
	let live = $state(false);
	let scale = $state(1);
	let boxH = $state(0);
	let boxW = $state(0);

	function pieceCount(aspect: number, heightFrac: number, min: number, max: number, overlap = 0.92): number {
		const height = (boxH || 120) * heightFrac;
		const width = Math.max(8, height * aspect * overlap);
		return Math.max(min, Math.min(max, Math.ceil((boxW || 360) / width)));
	}

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const h = node.clientHeight || 0;
			boxH = h;
			boxW = node.clientWidth || 0;
			scale = Math.max(0.55, Math.min(2.4, h / 150));
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
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) live = entry.isIntersecting;
			},
			{ rootMargin: '200px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	});
</script>

{#if family !== 'none'}
	<div
		bind:this={host}
		class="fx fx-{family} {dotted ? 'fx-dots' : ''} {live && !frozen ? 'fx-live' : ''}"
		style="{variant.style}; --fx-s: {scale}; --fx-h: {boxH || 120}px; --fx-w: {boxW || 360}px"
		aria-hidden="true"
	>
		{#if family === 'fire'}
			<span class="fx-flamebed">
				{#each variant.particles as p}
					<span class="fx-p" style={p}></span>
				{/each}
			</span>
		{:else}
			{#each variant.particles as p}
				<span class="fx-p" style={p}></span>
			{/each}
		{/if}

		{#if family === 'earthquake'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-ground" d="M0 58 L17 53 L33 59 L51 51 L69 57 L85 52 L100 57 L100 100 L0 100 Z" />
			</svg>

			{#each spreadPieces(seed, pieceCount(120 / 46, 0.42, 4, 18, 0.8), 0.24, 0.88, 1.18) as piece, f}
				<svg
					class="fx-fissure"
					style="--s-left: {piece.left}%; --s-scale: {piece.scale}"
					viewBox="0 0 120 46"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					{#each QUAKE_FISSURES[f % QUAKE_FISSURES.length].paths as d, i}
						<path class="fx-crack" pathLength="100" style="--c-i: {f * 3 + i}" {d} />
					{/each}
				</svg>
			{/each}

			{#each spreadPieces(seed + 90, pieceCount(1, 0.52, 3, 12, 1.25), 0.44, 0.66, 1.3) as piece, u}
				<svg
					class="fx-plume"
					style="--u-left: {piece.left}%; --u-scale: {piece.scale}; --u-i: {u}"
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<ellipse cx="34" cy="72" rx="24" ry="19" />
					<ellipse cx="58" cy="62" rx="28" ry="23" />
					<ellipse cx="44" cy="44" rx="21" ry="18" />
					<ellipse cx="68" cy="34" rx="16" ry="14" />
				</svg>
			{/each}

			{#each spreadPieces(seed + 63, pieceCount(100 / 40, 0.3, 3, 8, 1.3), 0.3, 0.8, 1.26) as piece, v}
				<svg
					class="fx-slab"
					style="--v-left: {piece.left}%; --v-scale: {piece.scale}; --v-i: {v}; --v-dir: {piece.flip ? 1 : -1}"
					viewBox="0 0 100 40"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={QUAKE_SLABS[v % QUAKE_SLABS.length]} />
				</svg>
			{/each}

			<svg class="fx-rift" viewBox="0 0 40 46" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-chasm" d="M14 1 L21 16 L16 46 L29 46 L24 15 L30 1 Z" />
			</svg>
		{:else if family === 'thunder'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-flash" width="100" height="100" />
			</svg>
			<span class="fx-rainzone">
				<i class="fx-sheet" style="--h-i: 0"></i>
				<i class="fx-sheet" style="--h-i: 1"></i>
			</span>

			{#each spreadPieces(seed + 31, pieceCount(110 / 44, 0.34, 2, 14, 0.86), 0.3, 0.86, 1.2) as piece, i}
				<svg
					class="fx-cloudlet fx-cloud"
					style="--k-i: {i}; --c-left: {piece.left}%; --c-scale: {piece.scale}"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGthunder{i}{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#4a5160" /><stop offset="100%" stop-color="#12151d" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGthunder{i}{uid})" d={THUNDER_CLOUDS[i % THUNDER_CLOUDS.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed + 77, pieceCount(45 / 100, 0.72, 3, 10, 1.8), 0.45, 0.78, 1) as piece, b}
				<svg
					class="fx-bolt-piece"
					style="--b-left: {piece.left}%; --b-scale: {piece.scale}"
					viewBox="0 0 45 100"
					preserveAspectRatio="xMidYMin meet"
					aria-hidden="true"
				>
					<ellipse class="fx-scorch" style="--s-i: {b}" cx="10" cy="96" rx="17" ry="4" />
					<path class="fx-strike" style="--s-i: {b}" d={THUNDER_BOLTS[b % THUNDER_BOLTS.length].main} />
					{#each THUNDER_BOLTS[b % THUNDER_BOLTS.length].forks as fork, f}
						<path class="fx-fork" style="--s-i: {b}; --f-i: {f}" pathLength="100" d={fork} />
					{/each}
				</svg>
			{/each}
		{:else if family === 'rain'}
			<div class="fx-skycloud" style="display: contents">
				{#each spreadPieces(seed + 202, pieceCount(110 / 44, 0.34, 2, 14, 0.84), 0.3, 0.86, 1.22) as piece, i}
					<svg
						class="fx-cloudlet fx-cloud"
						style="--k-i: {i}; --c-left: {piece.left}%; --c-scale: {piece.scale}"
						viewBox="0 0 110 44"
						preserveAspectRatio="xMidYMid meet"
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="fxGrain{i}{uid}" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
							</linearGradient>
						</defs>
						<path fill="url(#fxGrain{i}{uid})" d={RAIN_CLOUDS[i % RAIN_CLOUDS.length]} />
					</svg>
				{/each}
			</div>
		{:else if family === 'snow'}
			<div class="fx-skycloud" style="display: contents">
				{#each spreadPieces(seed + 214, pieceCount(110 / 44, 0.34, 2, 14, 0.84), 0.3, 0.86, 1.22) as piece, i}
					<svg
						class="fx-cloudlet fx-cloud"
						style="--k-i: {i}; --c-left: {piece.left}%; --c-scale: {piece.scale}"
						viewBox="0 0 110 44"
						preserveAspectRatio="xMidYMid meet"
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="fxGsnow{i}{uid}" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
							</linearGradient>
						</defs>
						<path fill="url(#fxGsnow{i}{uid})" d={SNOW_CLOUDS[i % SNOW_CLOUDS.length]} />
					</svg>
				{/each}
			</div>
		{:else if family === 'blizzard'}
			<div class="fx-skycloud" style="display: contents">
				{#each spreadPieces(seed + 226, pieceCount(110 / 44, 0.34, 2, 14, 0.84), 0.3, 0.86, 1.22) as piece, i}
					<svg
						class="fx-cloudlet fx-cloud"
						style="--k-i: {i}; --c-left: {piece.left}%; --c-scale: {piece.scale}"
						viewBox="0 0 110 44"
						preserveAspectRatio="xMidYMid meet"
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="fxGblizzard{i}{uid}" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
							</linearGradient>
						</defs>
						<path fill="url(#fxGblizzard{i}{uid})" d={BLIZZARD_CLOUDS[i % BLIZZARD_CLOUDS.length]} />
					</svg>
				{/each}
			</div>
		{:else if family === 'tsunami'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxSea{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#5fd8ff" /><stop offset="55%" stop-color="#1f7fc4" /><stop offset="100%" stop-color="#0b3f6b" />
					</linearGradient>
					<linearGradient id="fxSeaBack{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#3fa8dd" /><stop offset="100%" stop-color="#0a3358" />
					</linearGradient>
				</defs>

				<path class="fx-swell" style="--v-i: 0" fill="url(#fxSeaBack{uid})" d="M-30 100 L-30 72 Q-2 52 24 58 Q52 65 78 55 Q104 46 130 56 L130 100 Z" />
				<path
					class="fx-swell"
					style="--v-i: 1"
					fill="url(#fxSeaBack{uid})"
					opacity="0.8"
					d="M-30 100 L-30 80 Q0 64 28 70 Q58 77 86 67 Q110 59 130 68 L130 100 Z"
				/>
			</svg>

			{#each spreadPieces(seed + 64, pieceCount(1.45, 0.92, 3, 7, 1.5), 0.18, 0.88, 0.92) as piece, w}
				<svg
					class="fx-breaker-piece"
					style="--w-left: {piece.left}%; --w-h: {(0.3 + (piece.left / 100) * 0.6).toFixed(3)}; --w-i: {w}; --w-delay: {piece.delay}s"
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<g class="fx-breaker">
						<path
							fill="url(#fxSea{uid})"
							d="M-30 100 C -10 92, 0 78, 12 52 C 22 30, 46 18, 74 20 C 92 22, 100 50, 92 68 C 86 80, 68 82, 62 72 C 57 63, 66 53, 74 58 C 70 46, 54 40, 42 50 C 30 60, 28 80, 38 92 C 48 100, 78 100, 118 96 C 132 94, 140 98, 146 100 Z"
						/>
						<path class="fx-curl" d="M74 20 C 92 22, 100 50, 92 68 C 87 78, 76 80, 70 73 C 80 67, 84 52, 75 43 C 68 36, 60 34, 53 35 C 60 26, 64 19, 74 20 Z" />
						<path class="fx-spray" d="M50 28 Q56 20 64 22 Q58 24 56 30 Z" />
						<path class="fx-spray" style="--y-i: 1" d="M38 32 Q40 22 48 20 Q42 26 42 33 Z" />
						<path class="fx-spray" style="--y-i: 2" d="M64 34 Q72 30 78 34 Q70 34 66 40 Z" />
						{#each TSUNAMI_FLOTSAM as chunk, d}
							<path class="fx-flotsam" style="--d-i: {d}" d={chunk} />
						{/each}
					</g>
				</svg>
			{/each}

			<svg class="fx-whitewater" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
				<path style="--f-j: 0" d="M-12 34 L-12 18 Q-4 8 5 16 Q14 24 23 14 Q32 4 41 15 Q50 26 59 15 Q68 4 77 16 Q86 24 95 14 Q104 6 112 16 L112 34 Z" />
				<path style="--f-j: 1" d="M-12 34 L-12 24 Q-2 15 8 23 Q18 31 28 21 Q38 11 48 22 Q58 33 68 22 Q78 11 88 23 Q100 33 112 23 L112 34 Z" />
			</svg>

			<svg class="fx-surge" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
				<path d="M-12 22 L-12 12 Q-3 5 6 11 Q15 17 24 10 Q33 3 42 11 Q51 18 60 11 Q69 4 78 11 Q87 17 96 10 Q104 5 112 12 L112 22 Z" />
			</svg>
		{:else if family === 'tornado'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-scar" d="M0 100 L0 86 Q14 79 27 85 Q40 91 53 84 Q66 77 79 84 Q90 90 100 85 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 18, pieceCount(110 / 44, 0.34, 2, 14, 0.88), 0.28, 0.88, 1.22) as piece, i}
				<svg
					class="fx-cloudlet fx-cloud"
					style="--k-i: {i}; --c-left: {piece.left}%; --c-scale: {piece.scale}"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGtornado{i}{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#98a2ae" /><stop offset="100%" stop-color="#454e59" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGtornado{i}{uid})" d={TORNADO_CLOUDS[i % TORNADO_CLOUDS.length]} />
				</svg>
			{/each}

			<svg class="fx-vortex" viewBox="0 0 200 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-funnel" d="M4 12 Q100 34 196 12 Q166 44 140 64 Q116 82 106 100 L94 100 Q84 82 60 64 Q34 44 4 12 Z" />
				<path class="fx-band" style="--v-j: 0" d="M18 22 Q100 40 182 22" />
				<path class="fx-band" style="--v-j: 1" d="M44 42 Q100 58 156 42" />
				<path class="fx-band" style="--v-j: 2" d="M66 62 Q100 76 134 62" />
				<path class="fx-band" style="--v-j: 3" d="M84 82 Q100 92 116 82" />
				<ellipse class="fx-dustring" cx="100" cy="97" rx="82" ry="7" />
			</svg>

			{#each spreadPieces(seed + 55, pieceCount(1, 0.16, 5, 18, 0.5), 0.5, 0.6, 1.5) as piece, d}
				<svg
					class="fx-flung"
					style="--g-left: {piece.left}%; --g-scale: {piece.scale}; --g-i: {d}; --g-dir: {piece.flip ? 1 : -1}; --g-delay: {piece.delay}s"
					viewBox="0 0 24 24"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path d={TORNADO_DEBRIS[d % TORNADO_DEBRIS.length]} />
				</svg>
			{/each}
		{:else if family === 'meteor'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxHorizon{uid}" cx="50%" cy="100%" r="70%">
						<stop offset="0%" stop-color="var(--fx-color-2)" stop-opacity="0.62" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect class="fx-nightsky fx-nightsky-soft" width="100" height="100" />
				<rect width="100" height="42" y="58" fill="url(#fxHorizon{uid})" />
				<rect class="fx-scorchsky" width="100" height="100" />
			</svg>

			{#each spreadPieces(seed + 12, pieceCount(120 / 34, 0.2, 3, 16, 1), 0.18, 0.92, 1.16) as piece, i}
				<svg
					class="fx-crustline"
					style="--r-left: {piece.left}%; --r-scale: {piece.scale}"
					viewBox="0 0 120 34"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={METEOR_CRUST[i % METEOR_CRUST.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed + 58, pieceCount(100 / 52, 0.42, 2, 7, 1.5), 0.4, 0.72, 1.3) as piece, i}
				<svg
					class="fx-impact-piece"
					style="--i-left: {piece.left}%; --i-scale: {piece.scale}; --i-i: {i}"
					viewBox="0 0 100 52"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<ellipse class="fx-crater" cx="50" cy="46" rx="27" ry="6" />
					<ellipse class="fx-shock" style="--k-j: 0" cx="50" cy="46" rx="27" ry="6" />
					<ellipse class="fx-shock" style="--k-j: 1" cx="50" cy="46" rx="27" ry="6" />
					<path class="fx-burst" d="M50 46 L44 22 L50 30 L56 20 L54 32 L64 26 L56 38 Z" />
					{#each METEOR_EJECTA as chunk, e}
						<path class="fx-ejecta" style="--e-i: {e}" d={chunk} />
					{/each}
				</svg>
			{/each}
		{:else if family === 'aurora'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxAur0{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#4ade80" stop-opacity="0" /><stop offset="46%" stop-color="#4ade80" stop-opacity="0.34" /><stop
							offset="62%"
							stop-color="#4ade80"
							stop-opacity="0.18"
						/>
						<stop offset="100%" stop-color="#a7f3d0" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur1{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#38bdf8" stop-opacity="0" /><stop offset="44%" stop-color="#38bdf8" stop-opacity="0.3" /><stop
							offset="60%"
							stop-color="#38bdf8"
							stop-opacity="0.15"
						/>
						<stop offset="100%" stop-color="#c4b5fd" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur2{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#a78bfa" stop-opacity="0" /><stop offset="42%" stop-color="#a78bfa" stop-opacity="0.26" /><stop
							offset="58%"
							stop-color="#a78bfa"
							stop-opacity="0.13"
						/>
						<stop offset="100%" stop-color="#f0abfc" stop-opacity="0" />
					</linearGradient>
				</defs>

				<rect class="fx-nightsky" width="100" height="100" />
				<g class="fx-stars">
					<circle cx="12" cy="14" r="0.5" /><circle cx="31" cy="8" r="0.4" /><circle cx="49" cy="17" r="0.55" />
					<circle cx="67" cy="9" r="0.4" /><circle cx="83" cy="19" r="0.5" /><circle cx="94" cy="11" r="0.35" />
					<circle cx="22" cy="26" r="0.35" /><circle cx="58" cy="29" r="0.4" /><circle cx="76" cy="32" r="0.3" />
				</g>

				<path class="fx-ribbon" style="--n-i: 0" fill="url(#fxAur0{uid})" d="M-10 22 Q10 8 30 20 T70 16 T110 26 L110 74 Q90 60 70 70 T30 66 T-10 76 Z" />
				<path class="fx-ribbon" style="--n-i: 1" fill="url(#fxAur1{uid})" d="M-10 30 Q14 14 34 28 T74 22 T110 34 L110 70 Q86 58 66 66 T26 62 T-10 72 Z" />
				<path class="fx-ribbon" style="--n-i: 2" fill="url(#fxAur2{uid})" d="M-10 38 Q8 24 32 36 T68 30 T110 40 L110 66 Q88 56 64 62 T24 58 T-10 68 Z" />

				<g class="fx-polestar">
					<circle cx="9" cy="12" r="0.7" /><circle cx="21" cy="6" r="0.5" /><circle cx="37" cy="14" r="0.6" />
					<circle cx="52" cy="8" r="0.75" /><circle cx="64" cy="18" r="0.5" /><circle cx="79" cy="10" r="0.65" />
					<circle cx="88" cy="21" r="0.55" /><circle cx="96" cy="7" r="0.6" />
				</g>
				<path class="fx-corona-veil" d="M-10 6 Q16 26 42 10 Q68 -6 96 14 Q106 21 110 16 L110 46 Q96 38 78 46 Q52 58 28 44 Q6 32 -10 42 Z" />
				<path class="fx-auroraray" style="--w-j: 0" d="M12 4 L18 62" />
				<path class="fx-auroraray" style="--w-j: 1" d="M31 0 L34 58" />
				<path class="fx-auroraray" style="--w-j: 2" d="M49 6 L52 66" />
				<path class="fx-auroraray" style="--w-j: 3" d="M67 2 L70 60" />
				<path class="fx-auroraray" style="--w-j: 4" d="M84 8 L88 64" />
				<path class="fx-ridge" d="M-6 88 L10 74 L24 82 L40 66 L56 80 L70 70 L84 82 L106 75 L106 106 L-6 106 Z" />
				<path class="fx-ridgesnow" d="M-6 88 L10 74 L24 82 L40 66 L56 80 L70 70 L84 82 L106 75 L106 80 L84 88 L70 77 L56 86 L40 73 L24 87 L10 80 L-6 94 Z" />
				<path class="fx-auroraglow" d="M0 62 Q26 52 52 62 Q78 72 100 60 L100 100 L0 100 Z" />
			</svg>
		{:else if family === 'rainbow'}
			<svg class="fx-bow" viewBox="0 0 200 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-arc" pathLength="100" style="--a-i: 0; --a-c: #ff5f6d" d="M 4 100 A 96 96 0 0 1 196 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 1; --a-c: #ff9f45" d="M 10 100 A 90 90 0 0 1 190 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 2; --a-c: #ffd93d" d="M 16 100 A 84 84 0 0 1 184 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 3; --a-c: #4ade80" d="M 22 100 A 78 78 0 0 1 178 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 4; --a-c: #38bdf8" d="M 28 100 A 72 72 0 0 1 172 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 5; --a-c: #4f6ef7" d="M 34 100 A 66 66 0 0 1 166 100" />
				<path class="fx-arc" pathLength="100" style="--a-i: 6; --a-c: #a78bfa" d="M 40 100 A 60 60 0 0 1 160 100" />
			</svg>
			{#each RAINBOW_CLOUDS as puff, c}
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-low {puff.side}"
					style="--k-i: {c}; --c-left: {puff.left}"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGbow{c}{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#f2f6fb" /><stop offset="100%" stop-color="#b9c6d6" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGbow{c}{uid})" d={puff.d} />
				</svg>
			{/each}
		{:else if family === 'fire' || family === 'ember'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxHeat{uid}" x1="0" y1="1" x2="0" y2="0">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.85" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</linearGradient>
				</defs>
				<rect class="fx-heat" y="52" width="100" height="48" fill="url(#fxHeat{uid})" />
				<path class="fx-emberbed" d="M0 100 L0 92 Q12 87 24 92 Q36 97 48 91 Q60 85 72 91 Q84 97 96 92 Q98 91 100 92 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 196, pieceCount(60 / 100, 0.5, 2, 8, 1.5), 0.46, 0.6, 1.4) as piece, i}
				<svg
					class="fx-smokewisp"
					style="--m-left: {piece.left}%; --m-scale: {piece.scale}; --m-i: {i}"
					viewBox="0 0 60 100"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d="M30 100 Q18 78 28 60 Q38 44 26 28 Q18 16 30 0 Q44 14 34 30 Q26 46 36 62 Q46 80 30 100 Z" />
				</svg>
			{/each}
		{:else if family === 'bubbles'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-water" width="100" height="100" />
				<path class="fx-waterline" d="M0 0 L0 10 Q11 16 22 10 Q33 4 44 10 Q55 16 66 10 Q77 4 88 10 Q94 13 100 10 L100 0 Z" />
			</svg>

			{#each spreadPieces(seed + 212, pieceCount(1, 0.3, 2, 8, 1.7), 0.5, 0.55, 1.4) as piece, i}
				<svg
					class="fx-bubblepop"
					style="--o-left: {piece.left}%; --o-top: {8 + ((i * 37) % 40)}%; --o-scale: {piece.scale}; --o-j: {i}"
					viewBox="0 0 40 40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<circle class="fx-popshell" cx="20" cy="20" r="14" />
					<circle class="fx-popdrop" cx="20" cy="20" r="3" />
				</svg>
			{/each}
		{:else if family === 'sparkle'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-dustveil" x="-30" y="-25" width="160" height="150" />
			</svg>

			{#each spreadPieces(seed + 188, pieceCount(1, 0.44, 2, 7, 1.7), 0.5, 0.6, 1.4) as piece, i}
				<svg
					class="fx-starburst"
					style="--y-left: {piece.left}%; --y-top: {10 + ((i * 39) % 58)}%; --y-scale: {piece.scale}; --y-i: {i}"
					viewBox="0 0 40 40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path
						class="fx-burstarm"
						d="M20 0 Q23 16 20 20 Q17 16 20 0 Z M40 20 Q24 23 20 20 Q24 17 40 20 Z M20 40 Q17 24 20 20 Q23 24 20 40 Z M0 20 Q16 17 20 20 Q16 23 0 20 Z"
					/>
					<circle class="fx-burstcore" cx="20" cy="20" r="2.6" />
				</svg>
			{/each}
		{:else if family === 'confetti'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-streamer" style="--r-i: 0" d="M8 0 Q14 12 6 22 Q0 32 10 44" />
				<path class="fx-streamer" style="--r-i: 1" d="M34 0 Q28 10 36 20 Q44 30 34 40" />
				<path class="fx-streamer" style="--r-i: 2" d="M62 0 Q70 11 62 21 Q54 31 64 42" />
				<path class="fx-streamer" style="--r-i: 3" d="M90 0 Q84 13 92 24 Q98 34 88 46" />
			</svg>

			{#each spreadPieces(seed + 204, pieceCount(1, 0.4, 2, 7, 1.6), 0.5, 0.6, 1.4) as piece, i}
				<svg
					class="fx-popburst"
					style="--b-left: {piece.left}%; --b-top: {12 + ((i * 43) % 54)}%; --b-scale: {piece.scale}; --b-j: {i}"
					viewBox="0 0 40 40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<circle class="fx-popring" cx="20" cy="20" r="16" />
					<path class="fx-popbit" d="M20 4 L22 12 L18 12 Z M36 20 L28 22 L28 18 Z M20 36 L18 28 L22 28 Z M4 20 L12 18 L12 22 Z" />
				</svg>
			{/each}
		{:else if family === 'holo'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxFoil{uid}" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="#ff8ad4" /><stop offset="22%" stop-color="#ffd76a" />
						<stop offset="44%" stop-color="#7dffb0" /><stop offset="66%" stop-color="#8ad4ff" />
						<stop offset="88%" stop-color="#c08aff" /><stop offset="100%" stop-color="#ff8ad4" />
					</linearGradient>
				</defs>
				<rect class="fx-foil" x="-30" y="-25" width="160" height="150" fill="url(#fxFoil{uid})" />
				<rect class="fx-holoscan" x="-6" y="0" width="22" height="100" />
				<g class="fx-hologrid">
					<path d="M0 16 H100 M0 34 H100 M0 52 H100 M0 70 H100 M0 88 H100" />
					<path d="M16 0 V100 M34 0 V100 M52 0 V100 M70 0 V100 M88 0 V100" />
				</g>
				<g class="fx-foilbands">
					<rect x="-40" y="0" width="10" height="100" /><rect x="-14" y="0" width="5" height="100" />
					<rect x="6" y="0" width="12" height="100" /><rect x="34" y="0" width="6" height="100" />
					<rect x="58" y="0" width="11" height="100" /><rect x="86" y="0" width="7" height="100" />
				</g>
			</svg>
		{:else if family === 'pulse'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<g class="fx-gridline">
					<path d="M0 20 H100 M0 35 H100 M0 50 H100 M0 65 H100 M0 80 H100" />
					<path d="M12 0 V100 M30 0 V100 M48 0 V100 M66 0 V100 M84 0 V100" />
				</g>
				<rect class="fx-bpmflash" x="-30" y="-25" width="160" height="150" />
				<path class="fx-ecgghost" pathLength="100" d="M0 50 L22 50 L26 34 L30 66 L34 42 L38 50 L58 50 L62 30 L66 70 L70 46 L74 50 L100 50" />
				<path class="fx-ecg" pathLength="100" d="M0 50 L22 50 L26 34 L30 66 L34 42 L38 50 L58 50 L62 30 L66 70 L70 46 L74 50 L100 50" />
			</svg>
		{:else if family === 'glitch'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<g class="fx-tear">
					<rect class="fx-tear-r" style="--t-i: 0" y="18" width="100" height="7" />
					<rect class="fx-tear-c" style="--t-i: 1" y="44" width="100" height="4" />
					<rect class="fx-tear-r" style="--t-i: 2" y="63" width="100" height="9" />
					<rect class="fx-tear-c" style="--t-i: 3" y="82" width="100" height="5" />
				</g>
			</svg>
		{:else if family === 'scanlines' || family === 'grain'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none"> </svg>
		{:else if family === 'love'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxLove{uid}" cx="50%" cy="58%" r="68%">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.4" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<path class="fx-loveribbon" d="M-8 74 Q18 58 42 70 Q66 82 92 64 Q102 58 110 62 L110 72 Q100 68 92 74 Q66 92 42 80 Q18 68 -8 84 Z" />
				<rect class="fx-lovebloom" x="-30" y="-25" width="160" height="150" fill="url(#fxLove{uid})" />
			</svg>

			{#each spreadPieces(seed + 220, pieceCount(1, 0.2, 3, 12, 1.5), 0.5, 0.5, 1.4) as piece, i}
				<svg
					class="fx-sparkheart"
					style="--h-left: {piece.left}%; --h-top: {14 + ((i * 41) % 58)}%; --h-scale: {piece.scale}; --h-j: {i}"
					viewBox="0 0 24 24"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
				</svg>
			{/each}

			{#each spreadPieces(seed + 5, pieceCount(32 / 30, 0.3, 3, 12, 1.4), 0.46, 0.55, 1.3) as piece, i}
				<svg
					class="fx-heartglow"
					style="--q-left: {piece.left}%; --q-scale: {piece.scale}; --q-i: {i}; --q-delay: {piece.delay}s"
					viewBox="0 0 32 30"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path d="M16 29 C 2 19, 0 11, 5 6 C 10 1, 16 5, 16 9 C 16 5, 22 1, 27 6 C 32 11, 30 19, 16 29 Z" />
				</svg>
			{/each}
		{:else if family === 'glass'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxGlassTint{uid}" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.2" />
						<stop offset="52%" stop-color="var(--fx-color-2)" stop-opacity="0.06" />
						<stop offset="100%" stop-color="var(--fx-color)" stop-opacity="0.22" />
					</linearGradient>
				</defs>
				<rect class="fx-glasstint" width="100" height="100" fill="url(#fxGlassTint{uid})" />
			</svg>
		{:else if family === 'bullethole'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxWall{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#6d6455" /><stop offset="100%" stop-color="#3c362d" />
					</linearGradient>
				</defs>
				<rect class="fx-wallface" width="100" height="100" fill="url(#fxWall{uid})" />
				<rect class="fx-muzzle" width="100" height="100" />
			</svg>

			{#each spreadPieces(seed + 14, pieceCount(1, 0.34, 3, 11, 1.5), 0.5, 0.6, 1.4) as piece, i}
				<svg
					class="fx-hole"
					style="--n-left: {piece.left}%; --n-top: {8 + ((i * 37) % 66)}%; --n-scale: {piece.scale}; --n-i: {i}"
					viewBox="0 0 40 40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<circle class="fx-spall" cx="20" cy="20" r="15" />
					<circle class="fx-pit" cx="20" cy="20" r="6" />
					<path class="fx-splinter" pathLength="100" style="--z-i: 0" d="M20 14 L14 4" />
					<path class="fx-splinter" pathLength="100" style="--z-i: 1" d="M26 20 L37 16" />
					<path class="fx-splinter" pathLength="100" style="--z-i: 2" d="M20 26 L25 38" />
					<path class="fx-splinter" pathLength="100" style="--z-i: 3" d="M14 20 L3 25" />
				</svg>
			{/each}

			{#each spreadPieces(seed + 29, pieceCount(14 / 24, 0.14, 3, 10, 1.2), 0.5, 0.7, 1.3) as piece, c}
				<svg
					class="fx-casing"
					style="--j-left: {piece.left}%; --j-scale: {piece.scale}; --j-i: {c}; --j-delay: {piece.delay}s; --j-dir: {piece.flip ? 1 : -1}"
					viewBox="0 0 14 24"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path d="M3 1 L11 1 L12 18 Q7 23 2 18 Z" />
				</svg>
			{/each}
		{:else if family === 'volcano'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-ashsky" width="100" height="100" />
				<path class="fx-lavaflow" d="M0 100 L0 92 Q16 88 30 93 Q46 98 60 92 Q76 86 88 92 Q95 95 100 92 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 23, pieceCount(1, 0.42, 2, 8, 1.5), 0.42, 0.6, 1.3) as piece, i}
				<svg
					class="fx-ashpuff"
					style="--a-left: {piece.left}%; --a-scale: {piece.scale}; --a-i: {i}"
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<ellipse cx="38" cy="70" rx="26" ry="21" />
					<ellipse cx="62" cy="56" rx="30" ry="25" />
					<ellipse cx="48" cy="34" rx="22" ry="19" />
				</svg>
			{/each}

			<svg class="fx-cone" viewBox="0 0 120 84" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-conebody" d="M0 84 L34 22 Q46 12 60 14 Q74 12 86 22 L120 84 Z" />
				<path class="fx-vent" d="M40 22 Q60 30 80 22 Q60 18 40 22 Z" />
				<path class="fx-lavajet" pathLength="100" style="--l-j: 0" d="M56 20 Q52 -2 44 -14" />
				<path class="fx-lavajet" pathLength="100" style="--l-j: 1" d="M60 19 Q61 -6 63 -20" />
				<path class="fx-lavajet" pathLength="100" style="--l-j: 2" d="M64 20 Q70 -1 79 -12" />
				<path class="fx-lavarun" pathLength="100" d="M58 24 L54 46 L60 62 L56 84" />
				<path class="fx-lavarun" pathLength="100" style="--l-j: 1" d="M66 25 L72 44 L68 60 L74 84" />
			</svg>
		{:else if family === 'sandstorm'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-haze" style="--z-j: 0" x="-30" y="-25" width="160" height="150" />
				<rect class="fx-haze" style="--z-j: 1" x="-30" y="-25" width="160" height="150" />
			</svg>

			{#each spreadPieces(seed + 36, pieceCount(120 / 40, 0.26, 3, 16, 1), 0.24, 0.86, 1.2) as piece, i}
				<svg
					class="fx-dune"
					style="--m-left: {piece.left}%; --m-scale: {piece.scale}"
					viewBox="0 0 120 40"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={SAND_DUNES[i % SAND_DUNES.length]} />
				</svg>
			{/each}

			<i class="fx-dustwall"></i>
		{:else if family === 'void'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-starfield" width="100" height="100" />
			</svg>

			<svg class="fx-maw" viewBox="0 0 320 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<defs>
					<radialGradient id="fxMaw{uid}" cx="50%" cy="50%" r="52%">
						<stop offset="0%" stop-color="#02010a" stop-opacity="0.98" />
						<stop offset="58%" stop-color="#05021a" stop-opacity="0.9" />
						<stop offset="82%" stop-color="var(--fx-color)" stop-opacity="0.35" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				{#each VOID_DRAWIN as line, v}
					<path class="fx-drawin" style="--n-j: {v}" pathLength="100" d={line} />
				{/each}
				<path
					class="fx-mawcore"
					fill="url(#fxMaw{uid})"
					d="M160 6 C 214 8, 268 20, 300 38 C 316 48, 314 60, 292 70 C 250 88, 200 96, 160 94 C 120 96, 70 88, 28 70 C 6 60, 4 48, 20 38 C 52 20, 106 8, 160 6 Z"
				/>
				<path
					class="fx-mawrim"
					d="M160 6 C 214 8, 268 20, 300 38 C 316 48, 314 60, 292 70 C 250 88, 200 96, 160 94 C 120 96, 70 88, 28 70 C 6 60, 4 48, 20 38 C 52 20, 106 8, 160 6 Z"
				/>
			</svg>
		{:else if family === 'eclipse'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-eclipsesky" width="100" height="100" />
			</svg>

			<svg class="fx-corona" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<defs>
					<radialGradient id="fxCor{uid}" cx="50%" cy="50%" r="50%">
						<stop offset="46%" stop-color="transparent" stop-opacity="0" />
						<stop offset="52%" stop-color="var(--fx-color)" stop-opacity="0.95" />
						<stop offset="72%" stop-color="var(--fx-color)" stop-opacity="0.28" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<circle class="fx-flare" cx="50" cy="50" r="49" fill="url(#fxCor{uid})" />
				<circle class="fx-occluder" cx="50" cy="50" r="23" />
			</svg>
		{:else if family === 'fallingstar'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-wishsky" width="100" height="100" />
				<path class="fx-horizonridge" d="M0 100 L0 82 Q9 74 19 80 Q28 86 38 78 Q48 70 57 79 Q67 88 76 79 Q86 70 94 78 Q97 81 100 79 L100 100 Z" />
			</svg>

			<svg class="fx-starchart" viewBox="0 0 120 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<g class="fx-constellation">
					<circle cx="5" cy="14" r="0.9" /><circle cx="21" cy="7" r="0.7" /><circle cx="33" cy="18" r="1" />
					<circle cx="62" cy="10" r="0.8" /><circle cx="77" cy="20" r="0.9" /><circle cx="92" cy="8" r="0.7" />
					<circle cx="105" cy="22" r="0.85" /><circle cx="47" cy="26" r="0.6" />
					<path d="M5 14 L21 7 L33 18 M62 10 L77 20 L92 8 L105 22" />
				</g>
			</svg>
			<svg class="fx-moonpiece" viewBox="0 0 30 30" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<path class="fx-moonrise" d="M21 17 A11 11 0 1 1 13 6 A8.6 8.6 0 1 0 21 17 Z" />
			</svg>
		{:else if family === 'milkyway'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-wispsky" width="100" height="100" />
			</svg>

			<svg class="fx-galaxy" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
				<defs>
					<linearGradient id="fxGal{uid}" gradientUnits="userSpaceOnUse" x1="143.5" y1="24.6" x2="156.5" y2="75.4">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0" />
						<stop offset="16%" stop-color="var(--fx-color)" stop-opacity="0.26" />
						<stop offset="34%" stop-color="#ffffff" stop-opacity="0.5" />
						<stop offset="45%" stop-color="#160e28" stop-opacity="0.55" />
						<stop offset="54%" stop-color="#160e28" stop-opacity="0.42" />
						<stop offset="66%" stop-color="#ffffff" stop-opacity="0.44" />
						<stop offset="84%" stop-color="var(--fx-color-2)" stop-opacity="0.24" />
						<stop offset="100%" stop-color="var(--fx-color-2)" stop-opacity="0" />
					</linearGradient>
				</defs>
				<path class="fx-galaxyband" fill="url(#fxGal{uid})" d="M-30 69 L330 -23 L330 31 L-30 123 Z" />
			</svg>
		{:else if family === 'blackhole'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-lensfield" width="100" height="100" />
			</svg>

			<svg class="fx-warp" viewBox="0 0 320 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<defs>
					<linearGradient id="fxJet{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="transparent" stop-opacity="0" />
						<stop offset="42%" stop-color="var(--fx-color-2)" stop-opacity="0.9" />
						<stop offset="100%" stop-color="#ffffff" stop-opacity="0.95" />
					</linearGradient>
					<radialGradient id="fxHorizon{uid}" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stop-color="#01010a" stop-opacity="0.98" />
						<stop offset="62%" stop-color="#01010a" stop-opacity="0.86" />
						<stop offset="100%" stop-color="#01010a" stop-opacity="0" />
					</radialGradient>
					<linearGradient id="fxDoppler{uid}" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stop-color="var(--fx-color-2)" stop-opacity="0.28" />
						<stop offset="46%" stop-color="var(--fx-color)" stop-opacity="0.72" />
						<stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
					</linearGradient>
				</defs>

				{#each LENS_ARCS as arc, a}
					<path class="fx-lensarc" style="--a-j: {a}" pathLength="100" d={arc} />
				{/each}

				<ellipse class="fx-accretion" cx="160" cy="50" rx="150" ry="13" fill="url(#fxDoppler{uid})" />
				<ellipse class="fx-accretion fx-accretion-back" cx="160" cy="50" rx="118" ry="26" fill="url(#fxDoppler{uid})" />

				<path class="fx-jet" style="--t-j: 0" fill="url(#fxJet{uid})" d="M156 50 L164 50 L162 2 L158 2 Z" />
				<path class="fx-jet" style="--t-j: 1" fill="url(#fxJet{uid})" d="M156 50 L164 50 L162 98 L158 98 Z" />
				{#each [0, 1, 2, 3] as k}
					<circle class="fx-jetknot" style="--k-n: {k}" cx="160" cy="50" r="2.2" />
				{/each}

				<path class="fx-spaghetti" pathLength="100" d="M318 14 Q250 24, 206 38 Q176 47, 163 50" />
				<circle class="fx-photonring" cx="160" cy="50" r="20" />
				<circle class="fx-eventhorizon" cx="160" cy="50" r="19" fill="url(#fxHorizon{uid})" />
			</svg>
		{:else if family === 'autumn'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-duskglow" width="100" height="100" />
				<path class="fx-litter" d="M0 100 L0 94 Q11 90 22 94 Q33 98 44 93 Q55 88 66 93 Q77 98 88 93 Q94 90 100 94 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 71, pieceCount(120 / 64, 0.5, 3, 14, 1.05), 0.28, 0.72, 1.28) as piece, i}
				<svg
					class="fx-canopy"
					style="--w-left: {piece.left}%; --w-scale: {piece.scale}; --w-i: {i}"
					viewBox="0 0 120 64"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path class="fx-trunk" d={AUTUMN_TREES[i % AUTUMN_TREES.length].trunk} />
					<path class="fx-crown" d={AUTUMN_TREES[i % AUTUMN_TREES.length].crown} />
				</svg>
			{/each}

			<i class="fx-gustwave"></i>
		{:else if family === 'sakura'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-dawnwash" width="100" height="100" />
				<path class="fx-petaldrift" d="M0 100 L0 95 Q13 91 25 95 Q37 99 49 94 Q61 89 73 94 Q86 99 100 95 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 83, pieceCount(120 / 54, 0.4, 3, 14, 1.05), 0.26, 0.74, 1.3) as piece, i}
				<svg
					class="fx-branch"
					style="--r-left: {piece.left}%; --r-scale: {piece.scale}; --r-i: {i}"
					viewBox="0 0 120 54"
					preserveAspectRatio="xMidYMin meet"
					aria-hidden="true"
				>
					<path class="fx-bough" d={SAKURA_BOUGHS[i % SAKURA_BOUGHS.length]} />
					{#each SAKURA_BLOSSOMS as spot, b}
						<circle class="fx-blossom" style="--b-i: {b}" cx={spot[0]} cy={spot[1]} r={spot[2]} />
					{/each}
				</svg>
			{/each}
		{:else if family === 'fireflies'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-duskmeadow" width="100" height="100" />
			</svg>

			{#each spreadPieces(seed + 96, pieceCount(120 / 30, 0.2, 3, 16, 1), 0.2, 0.86, 1.2) as piece, i}
				<svg
					class="fx-grassline"
					style="--g-left: {piece.left}%; --g-scale: {piece.scale}"
					viewBox="0 0 120 30"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={MEADOW_TUFTS[i % MEADOW_TUFTS.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed + 108, pieceCount(20 / 30, 0.28, 2, 7, 2.2), 0.42, 0.7, 1.3) as piece, i}
				<svg
					class="fx-lantern"
					style="--n-left: {piece.left}%; --n-scale: {piece.scale}; --n-i: {i}; --n-delay: {piece.delay}s"
					viewBox="0 0 20 30"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<path class="fx-lanternglow" d="M4 6 Q10 0 16 6 L18 21 Q10 28 2 21 Z" />
					<path class="fx-lanternribs" d="M2 12 H18 M3 18 H17" />
				</svg>
			{/each}
		{:else if family === 'silk'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxSash{uid}" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0" />
						<stop offset="18%" stop-color="var(--fx-color)" stop-opacity="0.34" />
						<stop offset="40%" stop-color="var(--fx-color-2)" stop-opacity="0.62" />
						<stop offset="62%" stop-color="var(--fx-color)" stop-opacity="0.4" />
						<stop offset="86%" stop-color="var(--fx-color)" stop-opacity="0.18" />
						<stop offset="100%" stop-color="var(--fx-color)" stop-opacity="0" />
					</linearGradient>
				</defs>
				{#each SILK_SASHES as sash, i}
					<path class="fx-sash" style="--h-i: {i}" fill="url(#fxSash{uid})" d={sash} />
				{/each}
				<g class="fx-thread">
					<path d="M-6 22 Q28 12 62 24 Q88 33 110 22" />
					<path d="M-6 38 Q26 28 58 40 Q86 50 110 38" />
					<path d="M-6 54 Q30 44 64 56 Q90 65 110 54" />
					<path d="M-6 70 Q24 60 56 72 Q84 82 110 70" />
					<path d="M-6 86 Q30 76 66 88 Q92 96 110 86" />
				</g>
				<g class="fx-weave">
					<path d="M6 -8 Q9 40 6 108 M26 -8 Q29 40 26 108 M46 -8 Q49 40 46 108 M66 -8 Q69 40 66 108 M86 -8 Q89 40 86 108" />
				</g>
				{#each SILK_GLINTS as g, i}
					<circle class="fx-silkglint" style="--g-j: {i}" cx={g[0]} cy={g[1]} r={g[2]} />
				{/each}
				<path class="fx-silkfold" d="M-6 18 Q30 6 66 20 Q92 30 110 18 L110 34 Q90 44 66 34 Q30 20 -6 32 Z" />
				<rect class="fx-sheenline" width="6" height="100" />
			</svg>
		{:else if family === 'crystal'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-facetlight" style="--f-j: 0" x="-30" y="-25" width="160" height="150" />
				<rect class="fx-facetlight" style="--f-j: 1" x="-30" y="-25" width="160" height="150" />
			</svg>

			{#each spreadPieces(seed + 154, pieceCount(60 / 52, 0.4, 3, 14, 1.1), 0.3, 0.66, 1.34) as piece, i}
				<svg
					class="fx-cluster {piece.flip ? 'fx-cluster-top' : ''}"
					style="--u-left: {piece.left}%; --u-scale: {piece.scale}; --u-i: {i}"
					viewBox="0 0 60 52"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					{#each CRYSTAL_SPIKES[i % CRYSTAL_SPIKES.length] as d, k}
						<path class="fx-shardface" style="--k-j: {k}" {d} />
					{/each}
				</svg>
			{/each}
		{:else if family === 'neon'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-brickwall" width="100" height="100" />
			</svg>

			{#each spreadPieces(seed + 166, pieceCount(64 / 40, 0.44, 2, 9, 1.25), 0.3, 0.7, 1.3) as piece, i}
				<svg
					class="fx-neonsign"
					style="--t-left: {piece.left}%; --t-top: {14 + ((i * 43) % 40)}%; --t-scale: {piece.scale}; --t-i: {i}"
					viewBox="0 0 64 40"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<ellipse class="fx-neonpool" cx="32" cy="20" rx="31" ry="19" />
					<path class="fx-tube" d={NEON_TUBES[i % NEON_TUBES.length]} />
					<path class="fx-tubecore" d={NEON_TUBES[i % NEON_TUBES.length]} />
				</svg>
			{/each}
		{/if}
	</div>
	{#if FRONT_FAMILIES.has(family)}
		<div
			class="fx-front fx-front-{family} {live && !frozen ? 'fx-live' : ''}"
			style="{variant.style}; --fx-s: {scale}; --fx-h: {boxH || 120}px; --fx-w: {boxW || 360}px"
			aria-hidden="true"
		>
			{#if family === 'fire' || family === 'volcano'}
				<span class="fx-blaze">
					{#each spreadPieces(seed + 177, pieceCount(1, 0.34, 8, 34, 0.26), 0.7, 0.5, 1.6) as piece, i}
						<span class="fx-lick" style="--l-left: {piece.left}%; --l-scale: {piece.scale}; --l-delay: {piece.delay}s; --l-i: {i}"></span>
					{/each}
				</span>
				<span class="fx-blazeheat"></span>
				<span class="fx-char"></span>
			{:else if family === 'glass'}
				{#each spreadPieces(seed + 8, pieceCount(1, 1, 2, 7, 1.15), 0.16, 1, 1) as piece, i}
					<span class="fx-facet" style="--x-left: {piece.left}%; --x-i: {i}"></span>
				{/each}
				<span class="fx-glasspane"></span>
				<span class="fx-glint"></span>
			{:else if family === 'thunder'}
				<span class="fx-blank"></span>
			{:else if family === 'neon'}
				<span class="fx-rim"></span>
			{:else if family === 'blackhole'}
				<span class="fx-eventedge"></span>
			{/if}
		</div>
	{/if}
{/if}
