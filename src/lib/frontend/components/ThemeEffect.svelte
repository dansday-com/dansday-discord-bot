<script lang="ts">
	import { effectMeta, effectVariant, normalizeEffect, normalizeSeed } from '$lib/effects.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
		frozen?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, always = false, frozen = false }: Props = $props();

	const QUAKE_FISSURES = [
		{ left: '1%', paths: ['M4 46 L16 30 L8 18 L20 6', 'M16 30 L38 25 L52 12', 'M38 25 L44 40'] },
		{ left: '21%', paths: ['M110 46 L96 32 L104 20 L92 8', 'M96 32 L74 27 L60 14', 'M74 27 L68 41'] },
		{ left: '41%', paths: ['M58 46 L52 28 L64 17 L56 3', 'M52 28 L28 24 L12 11', 'M64 17 L88 13 L104 4'] },
		{ left: '60%', paths: ['M22 46 L30 33 L20 21 L32 9', 'M30 33 L56 31 L76 20 L96 26', 'M76 20 L84 6'] },
		{ left: '79%', paths: ['M86 46 L78 31 L88 19 L80 5', 'M78 31 L52 29 L34 18', 'M52 29 L46 42'] }
	];

	const THUNDER_BOLTS = [
		{
			left: '11%',
			paths: [
				{ d: 'M22 26 L13 52 L23 52 L8 92 L17 58 L7 58 L18 26 Z' },
				{ d: 'M29 28 L24 50 L31 50 L21 98', thin: true },
				{ d: 'M38 24 L31 46 L39 46 L27 84 L34 52 L26 52 L35 24 Z' }
			]
		},
		{
			left: '57%',
			paths: [
				{ d: 'M20 24 L9 48 L19 48 L6 88 L14 54 L4 54 L16 24 Z' },
				{ d: 'M33 30 L27 52 L35 52 L24 94', thin: true },
				{ d: 'M40 27 L34 49 L42 49 L31 90 L37 55 L29 55 L37 27 Z' }
			]
		}
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

	const TSUNAMI_BREAKERS = [
		{ left: '-6%', height: 1 },
		{ left: '15%', height: 0.84 },
		{ left: '35%', height: 0.97 },
		{ left: '56%', height: 0.79 },
		{ left: '76%', height: 0.92 }
	];

	const family = $derived(normalizeEffect(effectId));
	const variant = $derived(effectVariant(family, seed, accent));
	const dotted = $derived(effectMeta(family)?.particles === true);
	const uid = $derived(`${family}${normalizeSeed(seed)}`);

	let host = $state<HTMLDivElement | undefined>();
	let live = $state(false);
	let scale = $state(1);
	let boxH = $state(0);

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const h = node.clientHeight || 0;
			boxH = h;
			scale = Math.max(0.55, Math.min(2.4, h / 150));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
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
		style="{variant.style}; --fx-s: {scale}; --fx-h: {boxH || 120}px"
		aria-hidden="true"
	>
		{#each variant.particles as p}
			<span class="fx-p" style={p}></span>
		{/each}

		{#if family === 'earthquake'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-ground" d="M0 58 L17 53 L33 59 L51 51 L69 57 L85 52 L100 57 L100 100 L0 100 Z" />
			</svg>
			{#each QUAKE_FISSURES as fissure, f}
				<svg class="fx-fissure" style="--s-left: {fissure.left}" viewBox="0 0 120 46" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
					{#each fissure.paths as d, i}
						<path class="fx-crack" pathLength="100" style="--c-i: {f * 3 + i}" {d} />
					{/each}
				</svg>
			{/each}
			<svg class="fx-rift" viewBox="0 0 40 46" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-chasm" d="M14 1 L21 16 L16 46 L29 46 L24 15 L30 1 Z" />
			</svg>
		{:else if family === 'thunder'}
			<svg
				class="fx-cloudlet fx-cloud fx-cloud-thunder"
				style="--k-i: 0; --c-left: 6%"
				viewBox="0 0 110 44"
				preserveAspectRatio="xMidYMid meet"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="fxGthunder0{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#4a5160" /><stop offset="100%" stop-color="#1b1f29" />
					</linearGradient>
				</defs>
				<path fill="url(#fxGthunder0{uid})" d="M4 34 Q0 22 12 20 Q9 8 24 7 Q31 -3 48 3 Q64 -5 74 6 Q90 4 92 16 Q104 15 103 26 Q105 34 92 34 Z" />
			</svg>
			<svg
				class="fx-cloudlet fx-cloud fx-cloud-thunder"
				style="--k-i: 1; --c-left: 52%"
				viewBox="0 0 110 44"
				preserveAspectRatio="xMidYMid meet"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="fxGthunder1{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#39404e" /><stop offset="100%" stop-color="#12151d" />
					</linearGradient>
				</defs>
				<path fill="url(#fxGthunder1{uid})" d="M4 30 Q2 19 14 18 Q19 8 32 10 Q44 2 54 11 Q68 9 70 20 Q82 20 81 29 Q82 34 71 34 L10 34 Q3 34 4 30 Z" />
			</svg>
			{#each THUNDER_BOLTS as bolt, b}
				<svg class="fx-bolt-piece" style="--b-left: {bolt.left}" viewBox="0 0 45 100" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
					{#each bolt.paths as strike, i}
						<path class="fx-strike {strike.thin ? 'fx-strike-thin' : ''}" style="--s-i: {b * 3 + i}" d={strike.d} />
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
			{#each TSUNAMI_BREAKERS as wave, w}
				<svg
					class="fx-breaker-piece"
					style="--w-left: {wave.left}; --w-h: {wave.height}; --w-i: {w}"
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
					</g>
				</svg>
			{/each}
		{:else if family === 'tornado'}
			<svg
				class="fx-cloudlet fx-cloud fx-cloud-tornado"
				style="--k-i: 0; --c-left: 26%"
				viewBox="0 0 110 44"
				preserveAspectRatio="xMidYMid meet"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="fxGtornado0{uid}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#98a2ae" /><stop offset="100%" stop-color="#4b5563" />
					</linearGradient>
				</defs>
				<path
					fill="url(#fxGtornado0{uid})"
					d="M4 26 Q1 14 16 13 Q22 2 38 6 Q55 -2 67 8 Q85 6 89 18 Q99 20 97 28 Q97 35 86 35 L63 35 Q59 42 50 42 Q41 42 37 35 L12 35 Q2 35 4 26 Z"
				/>
			</svg>
			<svg class="fx-piece fx-piece-tall" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
				<path class="fx-funnel" d="M14 20 Q50 30 86 20 Q72 46 63 66 Q56 84 50 100 Q44 84 37 66 Q28 46 14 20 Z" />
				<ellipse class="fx-dustring" cx="50" cy="97" rx="34" ry="5" />
			</svg>
		{:else if family === 'meteor'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxHorizon{uid}" cx="50%" cy="100%" r="70%">
						<stop offset="0%" stop-color="var(--fx-color-2)" stop-opacity="0.55" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect class="fx-nightsky fx-nightsky-soft" width="100" height="100" />
				<rect width="100" height="42" y="58" fill="url(#fxHorizon{uid})" />
			</svg>
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
		{/if}
	</div>
{/if}
