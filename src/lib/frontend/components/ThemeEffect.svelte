<script lang="ts">
	import { effectMeta, effectVariant, normalizeEffect } from '$lib/effects.js';

	type Props = {
		effect?: string | null;
		seed?: number | null;
		accent?: string | null;
		always?: boolean;
	};

	let { effect: effectId = null, seed = 0, accent = null, always = false }: Props = $props();

	const family = $derived(normalizeEffect(effectId));
	const variant = $derived(effectVariant(family, seed, accent));
	const dotted = $derived(effectMeta(family)?.particles === true);

	let host = $state<HTMLDivElement | undefined>();
	let live = $state(false);
	let scale = $state(1);

	$effect(() => {
		const node = host;
		if (!node || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const h = node.clientHeight || 0;
			scale = Math.max(0.28, Math.min(1, h / 650));
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
	});

	$effect(() => {
		if (family === 'none') return;
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
	<div bind:this={host} class="fx fx-{family} {dotted ? 'fx-dots' : ''} {live ? 'fx-live' : ''}" style="{variant.style}; --fx-s: {scale}" aria-hidden="true">
		{#each variant.particles as p}
			<span class="fx-p" style={p}></span>
		{/each}

		{#if family === 'earthquake'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<path class="fx-ground" d="M0 78 L18 74 L34 79 L52 73 L70 78 L86 74 L100 79 L100 100 L0 100 Z" />
				<path class="fx-chasm" d="M40 78 L46 88 L42 100 L58 100 L54 86 L60 78 Z" />
				<path class="fx-crack" style="--c-i: 0" d="M2 34 L18 40 L26 31 L41 44 L55 36 L70 49 L84 41 L98 52" />
				<path class="fx-crack" style="--c-i: 1" d="M26 31 L30 14 L22 6" />
				<path class="fx-crack" style="--c-i: 2" d="M41 44 L46 66 L38 78" />
				<path class="fx-crack" style="--c-i: 3" d="M70 49 L76 68 L88 78" />
				<path class="fx-crack" style="--c-i: 4" d="M55 36 L58 20 L68 10" />
			</svg>
		{:else if family === 'thunder'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxCloudA" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#4a5160" /><stop offset="100%" stop-color="#1b1f29" />
					</linearGradient>
					<linearGradient id="fxCloudB" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#39404e" /><stop offset="100%" stop-color="#12151d" />
					</linearGradient>
				</defs>
				<g class="fx-cloud" style="--k-i: 0"
					><path fill="url(#fxCloudA)" d="M4 30 Q6 17 19 17 Q23 6 38 8 Q49 -1 58 9 Q73 7 75 20 Q90 20 90 31 Q90 37 81 37 L11 37 Q4 37 4 30 Z" /></g
				>
				<g class="fx-cloud" style="--k-i: 1"
					><path fill="url(#fxCloudB)" d="M34 26 Q36 15 47 15 Q51 5 64 7 Q74 0 82 9 Q95 7 97 19 Q110 19 110 29 Q110 34 102 34 L40 34 Q34 34 34 26 Z" /></g
				>
				<path class="fx-strike" style="--s-i: 0" d="M45 33 L36 55 L46 55 L31 88 L40 60 L30 60 L41 33 Z" />
				<path class="fx-strike" style="--s-i: 1" d="M69 31 L62 49 L70 49 L58 78 L65 54 L57 54 L66 31 Z" />
				<path class="fx-strike fx-strike-thin" style="--s-i: 2" d="M52 34 L47 52 L54 52 L44 96" />
			</svg>
		{:else if family === 'rain' || family === 'snow' || family === 'blizzard'}
			<svg class="fx-svg fx-scene fx-skycloud" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxSkyA" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="var(--fx-cloud-top)" /><stop offset="100%" stop-color="var(--fx-cloud-bottom)" />
					</linearGradient>
				</defs>
				<g class="fx-cloud" style="--k-i: 0"
					><path fill="url(#fxSkyA)" d="M4 30 Q6 17 19 17 Q23 6 38 8 Q49 -1 58 9 Q73 7 75 20 Q90 20 90 31 Q90 37 81 37 L11 37 Q4 37 4 30 Z" /></g
				>
				<g class="fx-cloud" style="--k-i: 1"
					><path
						fill="url(#fxSkyA)"
						opacity="0.75"
						d="M34 26 Q36 15 47 15 Q51 5 64 7 Q74 0 82 9 Q95 7 97 19 Q110 19 110 29 Q110 34 102 34 L40 34 Q34 34 34 26 Z"
					/></g
				>
			</svg>
		{:else if family === 'tsunami'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxSea" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#5fd8ff" /><stop offset="55%" stop-color="#1f7fc4" /><stop offset="100%" stop-color="#0b3f6b" />
					</linearGradient>
					<linearGradient id="fxSeaBack" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#3fa8dd" /><stop offset="100%" stop-color="#0a3358" />
					</linearGradient>
				</defs>

				<path class="fx-swell" style="--v-i: 0" fill="url(#fxSeaBack)" d="M0 100 L0 70 Q22 52 46 58 Q70 64 100 54 L100 100 Z" />
				<path class="fx-swell" style="--v-i: 1" fill="url(#fxSeaBack)" opacity="0.8" d="M0 100 L0 78 Q26 64 52 70 Q78 76 100 66 L100 100 Z" />

				<g class="fx-breaker">
					<path
						fill="url(#fxSea)"
						d="M0 100 L0 66 C 10 36, 32 22, 54 30 C 72 37, 78 56, 68 66 C 62 72, 52 70, 50 62 C 48 54, 56 50, 60 56 C 56 44, 40 42, 32 54 C 24 66, 30 82, 44 84 L100 84 L100 100 Z"
					/>
					<path class="fx-curl" d="M54 30 C 72 37, 78 56, 68 66 C 64 70, 57 69, 54 64 C 62 60, 64 48, 56 40 C 51 35, 46 33, 42 33 C 46 30, 50 29, 54 30 Z" />
					<path class="fx-spray" d="M50 28 Q56 20 64 22 Q58 24 56 30 Z" />
					<path class="fx-spray" style="--y-i: 1" d="M38 32 Q40 22 48 20 Q42 26 42 33 Z" />
					<path class="fx-spray" style="--y-i: 2" d="M64 34 Q72 30 78 34 Q70 34 66 40 Z" />
				</g>
			</svg>
		{:else if family === 'tornado'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxTorn" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#98a2ae" /><stop offset="100%" stop-color="#4b5563" />
					</linearGradient>
				</defs>
				<g class="fx-cloud" style="--k-i: 0"
					><path fill="url(#fxTorn)" d="M4 30 Q6 17 19 17 Q23 6 38 8 Q49 -1 58 9 Q73 7 75 20 Q90 20 90 31 Q90 37 81 37 L11 37 Q4 37 4 30 Z" /></g
				>
				<path class="fx-funnel" d="M14 34 Q50 44 86 34 Q72 56 63 72 Q56 88 50 100 Q44 88 37 72 Q28 56 14 34 Z" />
				<ellipse class="fx-dustring" cx="50" cy="98" rx="30" ry="6" />
			</svg>
		{:else if family === 'meteor'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxHorizon" cx="50%" cy="100%" r="70%">
						<stop offset="0%" stop-color="var(--fx-color-2)" stop-opacity="0.55" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect class="fx-nightsky" width="100" height="100" />
				<rect width="100" height="100" fill="url(#fxHorizon)" />
			</svg>
		{:else if family === 'aurora'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxAur0" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#4ade80" stop-opacity="0" /><stop offset="55%" stop-color="#4ade80" stop-opacity="0.85" />
						<stop offset="100%" stop-color="#a7f3d0" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur1" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#38bdf8" stop-opacity="0" /><stop offset="50%" stop-color="#38bdf8" stop-opacity="0.8" />
						<stop offset="100%" stop-color="#c4b5fd" stop-opacity="0" />
					</linearGradient>
					<linearGradient id="fxAur2" x1="0" y1="0" x2="0" y2="1">
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

				<path class="fx-ribbon" style="--n-i: 0" fill="url(#fxAur0)" d="M-10 22 Q10 8 30 20 T70 16 T110 26 L110 74 Q90 60 70 70 T30 66 T-10 76 Z" />
				<path class="fx-ribbon" style="--n-i: 1" fill="url(#fxAur1)" d="M-10 30 Q14 14 34 28 T74 22 T110 34 L110 70 Q86 58 66 66 T26 62 T-10 72 Z" />
				<path class="fx-ribbon" style="--n-i: 2" fill="url(#fxAur2)" d="M-10 38 Q8 24 32 36 T68 30 T110 40 L110 66 Q88 56 64 62 T24 58 T-10 68 Z" />

				<path class="fx-ridge" d="M0 84 L14 72 L26 80 L40 66 L55 79 L68 70 L82 81 L100 74 L100 100 L0 100 Z" />
			</svg>
		{:else if family === 'rainbow'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet">
				<defs>
					<linearGradient id="fxRainCloud" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color="#f2f6fb" /><stop offset="100%" stop-color="#b9c6d6" />
					</linearGradient>
				</defs>
				<path class="fx-arc" style="--a-i: 0; --a-c: #ff5f6d" d="M 4 92 A 46 46 0 0 1 96 92" />
				<path class="fx-arc" style="--a-i: 1; --a-c: #ff9f45" d="M 8 92 A 42 42 0 0 1 92 92" />
				<path class="fx-arc" style="--a-i: 2; --a-c: #ffd93d" d="M 12 92 A 38 38 0 0 1 88 92" />
				<path class="fx-arc" style="--a-i: 3; --a-c: #4ade80" d="M 16 92 A 34 34 0 0 1 84 92" />
				<path class="fx-arc" style="--a-i: 4; --a-c: #38bdf8" d="M 20 92 A 30 30 0 0 1 80 92" />
				<path class="fx-arc" style="--a-i: 5; --a-c: #4f6ef7" d="M 24 92 A 26 26 0 0 1 76 92" />
				<path class="fx-arc" style="--a-i: 6; --a-c: #a78bfa" d="M 28 92 A 22 22 0 0 1 72 92" />
				<g class="fx-cloud fx-cloud-left" style="--k-i: 0">
					<path fill="url(#fxRainCloud)" d="M-8 84 Q-6 72 6 72 Q10 62 23 64 Q34 57 41 67 Q52 69 52 79 Q52 86 44 86 L2 86 Q-8 86 -8 84 Z" />
				</g>
				<g class="fx-cloud fx-cloud-right" style="--k-i: 1">
					<path fill="url(#fxRainCloud)" d="M56 84 Q58 72 70 72 Q74 62 87 64 Q98 57 105 67 Q116 69 116 79 Q116 86 108 86 L62 86 Q56 86 56 84 Z" />
				</g>
			</svg>
		{:else if family === 'fire' || family === 'ember'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<linearGradient id="fxHeat" x1="0" y1="1" x2="0" y2="0">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.85" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</linearGradient>
				</defs>
				<rect class="fx-heat" y="52" width="100" height="48" fill="url(#fxHeat)" />
			</svg>
		{:else if family === 'bubbles'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<rect class="fx-water" width="100" height="100" />
			</svg>
		{:else if family === 'sparkle'}
			<svg class="fx-svg fx-scene" viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs>
					<radialGradient id="fxBloom" cx="50%" cy="42%" r="60%">
						<stop offset="0%" stop-color="var(--fx-color)" stop-opacity="0.5" />
						<stop offset="100%" stop-color="transparent" stop-opacity="0" />
					</radialGradient>
				</defs>
				<rect width="100" height="100" fill="url(#fxBloom)" />
				<g class="fx-flare" style="--l-i: 0" transform="translate(26 30)">
					<path d="M0 -16 L2.6 -2.6 L16 0 L2.6 2.6 L0 16 L-2.6 2.6 L-16 0 L-2.6 -2.6 Z" />
				</g>
				<g class="fx-flare" style="--l-i: 1" transform="translate(72 58)">
					<path d="M0 -11 L1.8 -1.8 L11 0 L1.8 1.8 L0 11 L-1.8 1.8 L-11 0 L-1.8 -1.8 Z" />
				</g>
				<g class="fx-flare" style="--l-i: 2" transform="translate(52 76)">
					<path d="M0 -8 L1.3 -1.3 L8 0 L1.3 1.3 L0 8 L-1.3 1.3 L-8 0 L-1.3 -1.3 Z" />
				</g>
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
					<linearGradient id="fxFoil" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stop-color="#ff8ad4" /><stop offset="22%" stop-color="#ffd76a" />
						<stop offset="44%" stop-color="#7dffb0" /><stop offset="66%" stop-color="#8ad4ff" />
						<stop offset="88%" stop-color="#c08aff" /><stop offset="100%" stop-color="#ff8ad4" />
					</linearGradient>
				</defs>
				<rect class="fx-foil" width="100" height="100" fill="url(#fxFoil)" />
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
				<radialGradient id="fxVig" cx="50%" cy="50%" r="72%">
					<stop offset="55%" stop-color="transparent" stop-opacity="0" />
					<stop offset="100%" stop-color="#000" stop-opacity="0.55" />
				</radialGradient>
				<rect width="100" height="100" fill="url(#fxVig)" />
			</svg>
		{/if}
	</div>
{/if}
