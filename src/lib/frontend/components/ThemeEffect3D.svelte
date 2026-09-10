<script lang="ts">
	import { SHADER_FAMILIES, effectPalette, normalizeEffect, normalizeSeed, shaderFamilyIndex } from '$lib/effects.js';
	import ThemeEffect from './ThemeEffect.svelte';

	type Props = { effect?: string | null; seed?: number | null; accent?: string | null };
	let { effect: effectId = null, seed = 0, accent = null }: Props = $props();

	const family = $derived(normalizeEffect(effectId));
	const shaded = $derived((SHADER_FAMILIES as readonly string[]).includes(family));

	let canvas = $state<HTMLCanvasElement | undefined>();
	let failed = $state(false);

	function hexToRgb(hex: any): [number, number, number] {
		const raw = String(hex ?? '').trim();
		const value = /^#?[0-9a-f]{6}$/i.test(raw) ? raw.replace('#', '') : '4d8fa8';
		return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
	}

	const FRAGMENT = `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uA;
uniform vec3 uB;
uniform float uSeed;
uniform int uFam;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p){
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
	return v;
}

void main(){
	vec2 uv = gl_FragCoord.xy / uRes;
	float t = uTime;
	vec3 col = vec3(0.0);
	float alpha = 0.0;

	if (uFam == 0) {                                  // fire
		float n = fbm(vec2(uv.x * 4.0, uv.y * 3.0 - t * 1.6));
		float flame = smoothstep(0.0, 1.0, (1.0 - uv.y) * 1.7) * n * 1.9;
		flame *= smoothstep(0.0, 0.35, 1.0 - uv.y);
		col = mix(uA, vec3(1.0, 0.92, 0.65), pow(flame, 2.2));
		alpha = clamp(flame, 0.0, 1.0);
	} else if (uFam == 1) {                           // tsunami
		float w = sin(uv.x * 7.0 + t * 1.4) * 0.045 + sin(uv.x * 3.1 - t * 0.9) * 0.06;
		float surface = 0.46 + w + fbm(vec2(uv.x * 3.0, t * 0.35)) * 0.07;
		float body = smoothstep(surface + 0.012, surface - 0.05, uv.y);
		float caustic = fbm(vec2(uv.x * 9.0 + t * 0.8, uv.y * 14.0 - t * 1.1));
		col = mix(uB, uA, clamp(uv.y / max(surface, 0.001), 0.0, 1.0)) + caustic * 0.28;
		float foam = smoothstep(0.016, 0.0, abs(uv.y - surface));
		col += foam * 0.9;
		alpha = clamp(body + foam * 0.85, 0.0, 1.0);
	} else if (uFam == 2) {                           // aurora
		float curtain = fbm(vec2(uv.x * 2.4 + t * 0.12, uv.y * 1.1 - t * 0.25));
		float band = smoothstep(0.34, 0.72, curtain) * smoothstep(1.0, 0.18, uv.y);
		col = mix(uA, uB, uv.y + curtain * 0.4);
		alpha = band * 0.9;
	} else if (uFam == 3) {                           // tornado
		vec2 c = uv - vec2(0.5, 1.05);
		float r = length(c * vec2(1.0, 0.42));
		float ang = atan(c.y, c.x) + t * 2.4 - r * 7.0;
		float swirl = fbm(vec2(ang * 1.4, r * 7.0 - t * 1.5));
		float funnel = smoothstep(0.55, 0.08, r) * swirl * 1.7;
		col = mix(uA, uB, swirl);
		alpha = clamp(funnel, 0.0, 1.0);
	} else if (uFam == 4) {                           // thunder
		float strike = step(0.965, fract(sin(floor(t * 1.6) * 91.7 + uSeed) * 43758.5453));
		float flick = strike * (0.55 + 0.45 * sin(t * 90.0));
		float bolt = smoothstep(0.045, 0.0, abs(uv.x - (0.5 + sin(uv.y * 9.0 + uSeed) * 0.12)));
		col = mix(uA, vec3(1.0), 0.7);
		alpha = flick * (0.28 + bolt * 0.9) * smoothstep(1.0, 0.1, uv.y);
	} else {                                          // meteor
		float a = 0.0;
		for (int i = 0; i < 7; i++) {
			float fi = float(i);
			float sp = 0.55 + hash(vec2(fi, 3.0)) * 0.9;
			float px = fract(hash(vec2(fi, 1.0)) + fi * 0.13);
			float py = fract(hash(vec2(fi, 2.0)) - t * sp);
			vec2 d = uv - vec2(px + py * 0.45, 1.0 - py);
			d.x *= 1.0;
			float streak = smoothstep(0.09, 0.0, length(d * vec2(0.42, 2.6)));
			a += streak;
		}
		col = mix(uA, vec3(1.0), 0.55);
		alpha = clamp(a, 0.0, 1.0);
	}

	gl_FragColor = vec4(col, alpha);
}`;

	$effect(() => {
		if (!shaded || !canvas) return;

		let disposed = false;
		let frame = 0;
		let cleanup: (() => void) | null = null;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			failed = true;
			return;
		}

		const node = canvas;
		const famIndex = shaderFamilyIndex(family);
		const [hexA, hexB] = effectPalette(family, accent);
		const a = hexToRgb(hexA);
		const b = hexToRgb(hexB);

		import('three')
			.then((THREE) => {
				if (disposed) return;
				let renderer: any;
				try {
					renderer = new THREE.WebGLRenderer({ canvas: node, alpha: true, antialias: false, powerPreference: 'low-power' });
				} catch {
					failed = true;
					return;
				}
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

				const scene = new THREE.Scene();
				const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
				const uniforms = {
					uTime: { value: 0 },
					uRes: { value: new THREE.Vector2(1, 1) },
					uA: { value: new THREE.Vector3(...a) },
					uB: { value: new THREE.Vector3(...b) },
					uSeed: { value: normalizeSeed(seed) * 0.001 },
					uFam: { value: famIndex }
				};
				const material = new THREE.ShaderMaterial({
					fragmentShader: FRAGMENT,
					vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
					uniforms,
					transparent: true,
					depthTest: false
				});
				const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
				scene.add(mesh);

				const resize = () => {
					const w = node.clientWidth || window.innerWidth;
					const h = node.clientHeight || window.innerHeight;
					renderer.setSize(w, h, false);
					uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
				};
				resize();
				const observer = new ResizeObserver(resize);
				observer.observe(node);

				const start = performance.now();
				const tick = () => {
					if (disposed) return;
					uniforms.uTime.value = (performance.now() - start) / 1000;
					renderer.render(scene, camera);
					frame = requestAnimationFrame(tick);
				};
				frame = requestAnimationFrame(tick);

				cleanup = () => {
					observer.disconnect();
					mesh.geometry.dispose();
					material.dispose();
					renderer.dispose();
				};
			})
			.catch(() => {
				failed = true;
			});

		return () => {
			disposed = true;
			if (frame) cancelAnimationFrame(frame);
			cleanup?.();
		};
	});
</script>

{#if shaded && !failed}
	<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 size-full" aria-hidden="true"></canvas>
{:else}
	<ThemeEffect effect={effectId} {seed} {accent} always />
{/if}
