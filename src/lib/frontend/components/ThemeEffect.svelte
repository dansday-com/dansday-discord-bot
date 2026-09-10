<script lang="ts">
	import { effectMeta, effectVariant, normalizeEffect, normalizeSeed, spreadPieces } from '$lib/effects.js';
	import { EFFECT_BEATS, haptic } from '$lib/frontend/haptics.js';
	import { startTilt } from '$lib/frontend/tilt.svelte.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
		frozen?: boolean;
		haptics?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, always = false, frozen = false, haptics = false }: Props = $props();

	const QUAKE_TOWERS = [
		'M8 74 L8 20 L14 20 L14 8 L34 8 L34 20 L40 20 L40 74 Z M18 16 L30 16 L30 12 L18 12 Z',
		'M12 74 L12 30 L18 24 L18 4 L36 4 L36 26 L44 32 L44 74 Z',
		'M6 74 L6 38 L16 38 L16 14 L26 6 L36 14 L36 38 L48 38 L48 74 Z',
		'M14 74 L14 10 L22 2 L30 10 L30 34 L42 34 L42 74 Z'
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

	const THUNDER_SKYLINE = [
		'M0 40 L0 22 L9 22 L9 12 L17 12 L17 26 L26 26 L26 6 L36 6 L36 20 L46 20 L46 14 L55 14 L55 28 L66 28 L66 9 L76 9 L76 24 L86 24 L86 17 L96 17 L96 30 L110 30 L110 40 Z',
		'M0 40 L0 27 L8 27 L8 15 L15 15 L15 3 L24 3 L24 21 L34 21 L34 11 L44 11 L44 25 L54 25 L54 8 L63 8 L63 22 L74 22 L74 13 L84 13 L84 29 L94 29 L94 19 L110 19 L110 40 Z'
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

	const GLASS_CRACKS = [
		['M50 50 L18 12', 'M50 50 L84 20', 'M50 50 L92 62', 'M50 50 L58 96', 'M50 50 L12 78', 'M28 31 L66 34 L74 57 L46 73 L23 58 Z'],
		['M50 50 L10 34', 'M50 50 L46 6', 'M50 50 L88 38', 'M50 50 L76 88', 'M50 50 L20 90', 'M31 40 L62 26 L78 52 L60 79 L30 68 Z']
	];

	const SAND_DUNES = [
		'M0 40 L0 28 Q16 18 32 26 Q48 34 64 22 Q80 12 96 24 Q108 32 120 24 L120 40 Z',
		'M0 40 L0 24 Q14 32 28 22 Q44 10 60 24 Q74 36 88 26 Q104 16 120 28 L120 40 Z'
	];

	const WISH_HILLS = [
		'M0 34 L0 22 Q18 10 36 20 Q54 30 72 16 Q90 4 106 18 Q114 25 120 20 L120 34 Z',
		'M0 34 L0 18 Q16 26 30 16 Q48 4 64 18 Q80 32 96 20 Q108 11 120 22 L120 34 Z'
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

	const TSUNAMI_TOWN = [
		'M0 46 L0 32 L8 32 L8 22 L16 16 L24 22 L24 32 L33 32 L33 20 L43 14 L53 20 L53 32 L62 32 L62 25 L71 25 L71 32 L82 32 L82 18 L91 12 L100 18 L100 32 L110 32 L110 26 L120 26 L120 46 Z',
		'M0 46 L0 28 L10 28 L10 19 L19 13 L28 19 L28 28 L38 28 L38 23 L47 23 L47 28 L57 28 L57 15 L67 9 L77 15 L77 28 L88 28 L88 21 L98 21 L98 28 L108 28 L108 24 L120 24 L120 46 Z'
	];

	const TSUNAMI_FLOTSAM = ['M28 62 L40 58 L41 62 L29 66 Z', 'M56 70 L68 67 L69 71 L57 74 Z', 'M36 78 L44 72 L48 76 L40 82 Z', 'M62 82 L74 79 L75 83 L63 86 Z'];

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
		if (family === 'none') return;
		return startTilt();
	});

	$effect(() => {
		if (!haptics || frozen || !live || family === 'none') return;
		const beat = EFFECT_BEATS[family];
		const node = host;
		if (!beat || !node) return;
		const target = node.querySelector(beat.selector);
		if (!target) return;

		let lastBeat = 0;
		const onIteration = () => {
			const now = Date.now();
			if (now - lastBeat < beat.minGap) return;
			lastBeat = now;
			haptic(beat.pattern);
		};
		target.addEventListener('animationiteration', onIteration);
		return () => target.removeEventListener('animationiteration', onIteration);
	});

	$effect(() => {
		if (family === 'none' || frozen) return;
		if (always || typeof IntersectionObserver === 'undefined') {
			live = true;
			return;
		}
		const node = host;
		if (!node) return;
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
		{#each variant.particles as p}
			<span class="fx-p" style={p}></span>
		{/each}

		{#if family === 'earthquake'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-ground" d="M0 58 L17 53 L33 59 L51 51 L69 57 L85 52 L100 57 L100 100 L0 100 Z" />
			</svg>

			{#each spreadPieces(seed + 41, pieceCount(60 / 74, 0.56, 2, 14, 1.35), 0.3, 0.72, 1.24) as piece, t}
				<svg
					class="fx-tower"
					style="--o-left: {piece.left}%; --o-scale: {piece.scale}; --o-i: {t}; --o-dir: {piece.flip ? 1 : -1}"
					viewBox="0 0 60 74"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={QUAKE_TOWERS[t % QUAKE_TOWERS.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed, pieceCount(120 / 46, 0.34, 3, 14, 0.95), 0.24, 0.88, 1.18) as piece, f}
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

			{#each spreadPieces(seed + 90, pieceCount(1, 0.46, 2, 8, 1.6), 0.44, 0.66, 1.3) as piece, u}
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

			<svg class="fx-rift" viewBox="0 0 40 46" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-chasm" d="M14 1 L21 16 L16 46 L29 46 L24 15 L30 1 Z" />
			</svg>
		{:else if family === 'thunder'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxStorm{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#141824" /><stop offset="62%" stop-color="#232a3a" /><stop offset="100%" stop-color="#0d1017" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxStorm{uid})" />
				<rect class="fx-flash" width="100" height="100" />
			</svg>
			<i class="fx-sheet" style="--h-i: 0"></i>
			<i class="fx-sheet" style="--h-i: 1"></i>

			{#each spreadPieces(seed, pieceCount(110 / 40, 0.26, 3, 16, 1), 0.2, 0.9, 1.25) as piece, i}
				<svg
					class="fx-stormline"
					style="--l-left: {piece.left}%; --l-scale: {piece.scale}; --l-i: {i}"
					viewBox="0 0 110 40"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={THUNDER_SKYLINE[i % THUNDER_SKYLINE.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed + 31, pieceCount(110 / 44, 0.34, 2, 14, 0.86), 0.3, 0.86, 1.2) as piece, i}
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-thunder"
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

			{#each spreadPieces(seed + 77, pieceCount(45 / 100, 1, 2, 6, 3.1), 0.45, 0.85, 1.15) as piece, b}
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
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-rain"
					style="--k-i: 0; --c-left: 18%"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGrain0{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGrain0{uid})" d="M2 26 Q5 14 18 15 Q24 5 38 7 Q51 1 60 9 Q74 5 81 16 Q95 15 97 25 Q99 33 88 33 L10 33 Q0 33 2 26 Z" />
				</svg>
			</div>
		{:else if family === 'snow'}
			<div class="fx-skycloud" style="display: contents">
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-snow"
					style="--k-i: 0; --c-left: 22%"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGsnow0{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGsnow0{uid})" d="M6 29 Q1 18 12 15 Q13 4 26 6 Q33 -4 45 3 Q55 -5 65 4 Q77 1 80 13 Q93 14 92 25 Q94 34 82 34 L14 34 Q4 35 6 29 Z" />
				</svg>
			</div>
		{:else if family === 'blizzard'}
			<div class="fx-skycloud" style="display: contents">
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-blizzard"
					style="--k-i: 0; --c-left: 10%"
					viewBox="0 0 110 44"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="fxGblizzard0{uid}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
						</linearGradient>
					</defs>
					<path fill="url(#fxGblizzard0{uid})" d="M0 27 Q4 14 20 14 Q29 1 47 6 Q64 -3 78 6 Q94 3 100 15 Q112 15 110 25 Q108 32 92 32 L20 32 Q2 33 0 27 Z" />
				</svg>
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

				<path class="fx-swell" style="--v-i: 0" fill="url(#fxSeaBack{uid})" d="M0 100 L0 70 Q22 52 46 58 Q70 64 100 54 L100 100 Z" />
				<path class="fx-swell" style="--v-i: 1" fill="url(#fxSeaBack{uid})" opacity="0.8" d="M0 100 L0 78 Q26 64 52 70 Q78 76 100 66 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 21, pieceCount(120 / 46, 0.3, 3, 16, 1), 0.22, 0.86, 1.2) as piece, i}
				<svg
					class="fx-township"
					style="--t-left: {piece.left}%; --t-scale: {piece.scale}; --t-i: {i}"
					viewBox="0 0 120 46"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={TSUNAMI_TOWN[i % TSUNAMI_TOWN.length]} />
				</svg>
			{/each}

			{#each spreadPieces(seed + 64, pieceCount(1, 0.86, 2, 14, 1.1), 0.26, 0.78, 1.14) as piece, w}
				<svg
					class="fx-breaker-piece"
					style="--w-left: {piece.left}%; --w-h: {piece.scale}; --w-i: {w}"
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<g class="fx-breaker">
						<path
							fill="url(#fxSea{uid})"
							d="M0 100 L0 66 C 10 36, 32 22, 54 30 C 72 37, 78 56, 68 66 C 62 72, 52 70, 50 62 C 48 54, 56 50, 60 56 C 56 44, 40 42, 32 54 C 24 66, 30 82, 44 84 L100 84 L100 100 Z"
						/>
						<path class="fx-curl" d="M54 30 C 72 37, 78 56, 68 66 C 64 70, 57 69, 54 64 C 62 60, 64 48, 56 40 C 51 35, 46 33, 42 33 C 46 30, 50 29, 54 30 Z" />
						<path class="fx-spray" d="M50 28 Q56 20 64 22 Q58 24 56 30 Z" />
						<path class="fx-spray" style="--y-i: 1" d="M38 32 Q40 22 48 20 Q42 26 42 33 Z" />
						<path class="fx-spray" style="--y-i: 2" d="M64 34 Q72 30 78 34 Q70 34 66 40 Z" />
						{#each TSUNAMI_FLOTSAM as chunk, d}
							<path class="fx-flotsam" style="--d-i: {d}" d={chunk} />
						{/each}
					</g>
				</svg>
			{/each}

			<svg class="fx-surge" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
				<path d="M0 22 L0 12 Q9 5 18 11 Q27 17 36 10 Q45 3 54 11 Q63 18 72 11 Q81 4 90 11 Q95 15 100 12 L100 22 Z" />
			</svg>
		{:else if family === 'tornado'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxGale{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#2f3743" /><stop offset="70%" stop-color="#59636f" /><stop offset="100%" stop-color="#3a3128" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxGale{uid})" />
				<path class="fx-scar" d="M0 100 L0 86 Q14 79 27 85 Q40 91 53 84 Q66 77 79 84 Q90 90 100 85 L100 100 Z" />
			</svg>

			{#each spreadPieces(seed + 18, pieceCount(110 / 44, 0.34, 2, 14, 0.88), 0.28, 0.88, 1.22) as piece, i}
				<svg
					class="fx-cloudlet fx-cloud fx-cloud-tornado"
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

			<svg class="fx-vortex" viewBox="0 0 120 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-funnel" d="M6 14 Q60 30 114 14 Q96 44 82 62 Q70 78 64 100 L56 100 Q50 78 38 62 Q24 44 6 14 Z" />
				<path class="fx-band" style="--v-j: 0" d="M14 22 Q60 34 106 22" />
				<path class="fx-band" style="--v-j: 1" d="M26 40 Q60 50 94 40" />
				<path class="fx-band" style="--v-j: 2" d="M36 58 Q60 66 84 58" />
				<path class="fx-band" style="--v-j: 3" d="M46 78 Q60 84 74 78" />
				<ellipse class="fx-dustring" cx="60" cy="97" rx="44" ry="6" />
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
						<stop offset="0%" stop-color="#4ade80" stop-opacity="0" /><stop offset="55%" stop-color="#4ade80" stop-opacity="0.85" />
						<stop offset="100%" stop-color="#a7f3d0" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur1{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#38bdf8" stop-opacity="0" /><stop offset="50%" stop-color="#38bdf8" stop-opacity="0.8" />
						<stop offset="100%" stop-color="#c4b5fd" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur2{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#a78bfa" stop-opacity="0" /><stop offset="48%" stop-color="#a78bfa" stop-opacity="0.7" />
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

				<path class="fx-ridge" d="M0 84 L14 72 L26 80 L40 66 L55 79 L68 70 L82 81 L100 74 L100 100 L0 100 Z" />
			</svg>
		{:else if family === 'rainbow'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-arc" style="--a-i: 0; --a-c: #ff5f6d" d="M 4 92 A 46 46 0 0 1 96 92" />
				<path class="fx-arc" style="--a-i: 1; --a-c: #ff9f45" d="M 8 92 A 42 42 0 0 1 92 92" />
				<path class="fx-arc" style="--a-i: 2; --a-c: #ffd93d" d="M 12 92 A 38 38 0 0 1 88 92" />
				<path class="fx-arc" style="--a-i: 3; --a-c: #4ade80" d="M 16 92 A 34 34 0 0 1 84 92" />
				<path class="fx-arc" style="--a-i: 4; --a-c: #38bdf8" d="M 20 92 A 30 30 0 0 1 80 92" />
				<path class="fx-arc" style="--a-i: 5; --a-c: #4f6ef7" d="M 24 92 A 26 26 0 0 1 76 92" />
				<path class="fx-arc" style="--a-i: 6; --a-c: #a78bfa" d="M 28 92 A 22 22 0 0 1 72 92" />
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
			</svg>
		{:else if family === 'bubbles'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-water" width="100" height="100" />
			</svg>
		{:else if family === 'sparkle'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxBloom{uid}" cx="50%" cy="42%" r="60%">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.5" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxBloom{uid})" />
			</svg>
		{:else if family === 'confetti'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-streamer" style="--r-i: 0" d="M8 0 Q14 12 6 22 Q0 32 10 44" />
				<path class="fx-streamer" style="--r-i: 1" d="M34 0 Q28 10 36 20 Q44 30 34 40" />
				<path class="fx-streamer" style="--r-i: 2" d="M62 0 Q70 11 62 21 Q54 31 64 42" />
				<path class="fx-streamer" style="--r-i: 3" d="M90 0 Q84 13 92 24 Q98 34 88 46" />
			</svg>
		{:else if family === 'holo'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxFoil{uid}" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="#ff8ad4" /><stop offset="22%" stop-color="#ffd76a" />
						<stop offset="44%" stop-color="#7dffb0" /><stop offset="66%" stop-color="#8ad4ff" />
						<stop offset="88%" stop-color="#c08aff" /><stop offset="100%" stop-color="#ff8ad4" />
					</linearGradient>
				</defs>
				<rect class="fx-foil" width="100" height="100" fill="url(#fxFoil{uid})" />
				<g class="fx-foilbands">
					<rect x="-40" y="0" width="10" height="100" /><rect x="-14" y="0" width="5" height="100" />
					<rect x="6" y="0" width="12" height="100" /><rect x="34" y="0" width="6" height="100" />
					<rect x="58" y="0" width="11" height="100" /><rect x="86" y="0" width="7" height="100" />
				</g>
			</svg>
		{:else if family === 'pulse'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-ecg" d="M0 50 L22 50 L26 34 L30 66 L34 42 L38 50 L58 50 L62 30 L66 70 L70 46 L74 50 L100 50" />
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
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<radialGradient id="fxVig{uid}" cx="50%" cy="50%" r="72%">
					<stop offset="55%" stop-color="transparent" stop-opacity="0" />
					<stop offset="100%" stop-color="#000" stop-opacity="0.55" />
				</radialGradient>
				<rect width="100" height="100" fill="url(#fxVig{uid})" />
			</svg>
		{:else if family === 'love'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxLove{uid}" cx="50%" cy="58%" r="68%">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.4" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect class="fx-lovebloom" width="100" height="100" fill="url(#fxLove{uid})" />
			</svg>

			{#each spreadPieces(seed + 5, pieceCount(1, 0.3, 3, 12, 1.4), 0.46, 0.55, 1.35) as piece, i}
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
					<linearGradient id="fxPane{uid}" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.16" />
						<stop offset="50%" stop-color="var(--fx-color-2)" stop-opacity="0.05" />
						<stop offset="100%" stop-color="var(--fx-color)" stop-opacity="0.18" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxPane{uid})" />
				<rect class="fx-glint" width="16" height="100" />
			</svg>

			{#each spreadPieces(seed + 8, pieceCount(1, 0.9, 2, 9, 1.15), 0.2, 0.8, 1.2) as piece, i}
				<svg
					class="fx-fracture"
					style="--x-left: {piece.left}%; --x-scale: {piece.scale}; --x-i: {i}"
					viewBox="0 0 100 100"
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					{#each GLASS_CRACKS[i % GLASS_CRACKS.length] as d, c}
						<path class="fx-crackline" pathLength="100" style="--z-i: {c}" {d} />
					{/each}
					<path class="fx-shard" style="--z-i: 0" d="M50 50 L62 38 L69 52 Z" />
					<path class="fx-shard" style="--z-i: 1" d="M50 50 L38 40 L33 55 Z" />
					<path class="fx-shard" style="--z-i: 2" d="M50 50 L57 65 L43 68 Z" />
				</svg>
			{/each}
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

			{#each spreadPieces(seed + 29, pieceCount(1, 0.14, 3, 10, 1.2), 0.5, 0.7, 1.3) as piece, c}
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
				<defs>
					<linearGradient id="fxAshSky{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#2a1c18" /><stop offset="58%" stop-color="#5c3324" /><stop offset="100%" stop-color="#1b1210" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxAshSky{uid})" />
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
				<path class="fx-lavajet" style="--l-j: 0" d="M56 20 Q52 -2 44 -14" />
				<path class="fx-lavajet" style="--l-j: 1" d="M60 19 Q61 -6 63 -20" />
				<path class="fx-lavajet" style="--l-j: 2" d="M64 20 Q70 -1 79 -12" />
				<path class="fx-lavarun" d="M58 24 L54 46 L60 62 L56 84" />
				<path class="fx-lavarun" style="--l-j: 1" d="M66 25 L72 44 L68 60 L74 84" />
			</svg>
		{:else if family === 'sandstorm'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxSand{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#8a6a3a" /><stop offset="55%" stop-color="#c69a51" /><stop offset="100%" stop-color="#7a5a2f" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxSand{uid})" />
				<rect class="fx-haze" style="--z-j: 0" width="100" height="100" />
				<rect class="fx-haze" style="--z-j: 1" width="100" height="100" />
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

			<svg class="fx-disc" viewBox="0 0 140 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<defs>
					<radialGradient id="fxDisc{uid}" cx="50%" cy="50%" r="50%">
						<stop offset="42%" stop-color="transparent" stop-opacity="0" />
						<stop offset="58%" stop-color="var(--fx-color)" stop-opacity="0.9" />
						<stop offset="78%" stop-color="var(--fx-color-2)" stop-opacity="0.55" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<ellipse class="fx-halo" cx="70" cy="50" rx="66" ry="24" fill="url(#fxDisc{uid})" />
				<ellipse class="fx-lens" cx="70" cy="50" rx="26" ry="26" />
				<circle class="fx-singularity" cx="70" cy="50" r="17" />
			</svg>
		{:else if family === 'eclipse'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxEcl{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#0e1020" /><stop offset="62%" stop-color="#2a2340" /><stop offset="100%" stop-color="#120f1c" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxEcl{uid})" />
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
				<defs>
					<linearGradient id="fxWish{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#070b1c" /><stop offset="64%" stop-color="#152046" /><stop offset="100%" stop-color="#0a0f24" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxWish{uid})" />
				<rect class="fx-wishsky" width="100" height="100" />
			</svg>

			{#each spreadPieces(seed + 47, pieceCount(120 / 34, 0.22, 3, 16, 1), 0.22, 0.88, 1.16) as piece, i}
				<svg
					class="fx-hill"
					style="--y-left: {piece.left}%; --y-scale: {piece.scale}"
					viewBox="0 0 120 34"
					preserveAspectRatio="xMidYMax meet"
					aria-hidden="true"
				>
					<path d={WISH_HILLS[i % WISH_HILLS.length]} />
				</svg>
			{/each}
		{:else if family === 'milkyway'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxGal{uid}" x1="0" y1="1" x2="1" y2="0">
						<stop offset="0%" stop-color="transparent" stop-opacity="0" />
						<stop offset="34%" stop-color="var(--fx-color)" stop-opacity="0.42" />
						<stop offset="52%" stop-color="#ffffff" stop-opacity="0.55" />
						<stop offset="70%" stop-color="var(--fx-color-2)" stop-opacity="0.4" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxLane{uid}" x1="0" y1="1" x2="1" y2="0">
						<stop offset="0%" stop-color="transparent" stop-opacity="0" />
						<stop offset="50%" stop-color="#0a0714" stop-opacity="0.75" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</linearGradient>
				</defs>
				<rect width="100" height="100" fill="#05060f" />
				<path class="fx-galaxyband" fill="url(#fxGal{uid})" d="M-20 108 L18 -8 L62 -8 L24 108 Z" />
				<path class="fx-dustlane" fill="url(#fxLane{uid})" d="M-6 108 L30 -8 L40 -8 L4 108 Z" />
				<rect class="fx-wispsky" width="100" height="100" />
			</svg>
		{:else if family === 'blackhole'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-lensfield" width="100" height="100" />
			</svg>

			<svg class="fx-warp" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
				<defs>
					<linearGradient id="fxJet{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="transparent" stop-opacity="0" />
						<stop offset="42%" stop-color="var(--fx-color-2)" stop-opacity="0.9" />
						<stop offset="100%" stop-color="#ffffff" stop-opacity="0.95" />
					</linearGradient>
				</defs>
				<path class="fx-jet" style="--t-j: 0" fill="url(#fxJet{uid})" d="M46 50 L54 50 L52 -46 L48 -46 Z" />
				<path class="fx-jet" style="--t-j: 1" fill="url(#fxJet{uid})" d="M46 50 L54 50 L52 146 L48 146 Z" />
				<path class="fx-spaghetti" pathLength="100" d="M98 22 Q74 26 62 38 Q54 46 51 50" />
				<circle class="fx-photonring" cx="50" cy="50" r="20" />
				<circle class="fx-eventhorizon" cx="50" cy="50" r="17" />
			</svg>
		{/if}
	</div>
{/if}
