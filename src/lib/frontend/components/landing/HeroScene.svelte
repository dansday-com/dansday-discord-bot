<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let host: HTMLDivElement | null = $state(null);
	let live = $state(false);
	let dispose: (() => void) | null = null;

	const VERTEX = `
		uniform float uTime;
		uniform float uScroll;
		uniform float uPointer;
		varying float vNoise;
		varying vec3 vNormalW;
		varying vec3 vViewDir;

		vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
		vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

		float snoise(vec3 v) {
			const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
			const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
			vec3 i = floor(v + dot(v, C.yyy));
			vec3 x0 = v - i + dot(i, C.xxx);
			vec3 g = step(x0.yzx, x0.xyz);
			vec3 l = 1.0 - g;
			vec3 i1 = min(g.xyz, l.zxy);
			vec3 i2 = max(g.xyz, l.zxy);
			vec3 x1 = x0 - i1 + C.xxx;
			vec3 x2 = x0 - i2 + C.yyy;
			vec3 x3 = x0 - D.yyy;
			i = mod289(i);
			vec4 p = permute(permute(permute(
				i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
				i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
				i.x + vec4(0.0, i1.x, i2.x, 1.0));
			float n_ = 0.142857142857;
			vec3 ns = n_ * D.wyz - D.xzx;
			vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
			vec4 x_ = floor(j * ns.z);
			vec4 y_ = floor(j - 7.0 * x_);
			vec4 x = x_ * ns.x + ns.yyyy;
			vec4 y = y_ * ns.x + ns.yyyy;
			vec4 h = 1.0 - abs(x) - abs(y);
			vec4 b0 = vec4(x.xy, y.xy);
			vec4 b1 = vec4(x.zw, y.zw);
			vec4 s0 = floor(b0) * 2.0 + 1.0;
			vec4 s1 = floor(b1) * 2.0 + 1.0;
			vec4 sh = -step(h, vec4(0.0));
			vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
			vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
			vec3 p0 = vec3(a0.xy, h.x);
			vec3 p1 = vec3(a0.zw, h.y);
			vec3 p2 = vec3(a1.xy, h.z);
			vec3 p3 = vec3(a1.zw, h.w);
			vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
			p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
			vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
			m = m * m;
			return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
		}

		void main() {
			float t = uTime * 0.22;
			float n = snoise(normal * 1.5 + vec3(t, t * 0.7, -t * 0.5));
			n += 0.5 * snoise(normal * 3.4 + vec3(-t * 1.3, t, t * 0.9));
			float amp = 0.34 + uScroll * 0.5 + abs(uPointer) * 0.12;
			vNoise = n;
			vec3 displaced = position + normal * n * amp;
			vNormalW = normalize(normalMatrix * normal);
			vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
			vViewDir = normalize(-mv.xyz);
			gl_Position = projectionMatrix * mv;
		}
	`;

	const FRAGMENT = `
		uniform vec3 uPrimary;
		uniform vec3 uSecondary;
		uniform vec3 uPink;
		uniform vec3 uGold;
		varying float vNoise;
		varying vec3 vNormalW;
		varying vec3 vViewDir;

		void main() {
			float m = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
			vec3 col = mix(uPrimary, uSecondary, smoothstep(0.15, 0.6, m));
			col = mix(col, uPink, smoothstep(0.62, 0.9, m));
			col = mix(col, uGold, smoothstep(0.0, 0.18, 1.0 - m) * 0.55);
			float fres = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 2.2);
			col += fres * 0.5;
			gl_FragColor = vec4(col, 0.9);
		}
	`;

	onMount(async () => {
		if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const THREE = await import('three');

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
		camera.position.z = 5.2;

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearAlpha(0);
		host.appendChild(renderer.domElement);
		renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

		const uniforms = {
			uTime: { value: 0 },
			uScroll: { value: 0 },
			uPointer: { value: 0 },
			uPrimary: { value: new THREE.Color('#e43d12') },
			uSecondary: { value: new THREE.Color('#d6536d') },
			uPink: { value: new THREE.Color('#ffa2b6') },
			uGold: { value: new THREE.Color('#efb11d') }
		};

		const geometry = new THREE.IcosahedronGeometry(1.7, 48);
		const material = new THREE.ShaderMaterial({
			vertexShader: VERTEX,
			fragmentShader: FRAGMENT,
			uniforms,
			transparent: true,
			side: THREE.DoubleSide
		});
		const blob = new THREE.Mesh(geometry, material);
		scene.add(blob);

		const wire = new THREE.Mesh(
			new THREE.IcosahedronGeometry(2.45, 3),
			new THREE.MeshBasicMaterial({ color: new THREE.Color('#e43d12'), wireframe: true, transparent: true, opacity: 0.1 })
		);
		scene.add(wire);

		const target = { x: 0, y: 0 };
		const smooth = { x: 0, y: 0 };
		const onPointer = (e: PointerEvent) => {
			target.x = (e.clientX / window.innerWidth - 0.5) * 2;
			target.y = (e.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener('pointermove', onPointer, { passive: true });

		const onScroll = () => (uniforms.uScroll.value = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)));
		window.addEventListener('scroll', onScroll, { passive: true });

		const resize = () => {
			if (!host) return;
			const { clientWidth: w, clientHeight: h } = host;
			if (!w || !h) return;
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		let visible = true;
		const io = new IntersectionObserver((entries) => (visible = entries.some((e) => e.isIntersecting)), { threshold: 0 });
		io.observe(host);

		let frame = 0;
		const clock = new THREE.Clock();
		const tick = () => {
			frame = requestAnimationFrame(tick);
			if (!visible) return;
			smooth.x += (target.x - smooth.x) * 0.05;
			smooth.y += (target.y - smooth.y) * 0.05;
			uniforms.uTime.value = clock.getElapsedTime();
			uniforms.uPointer.value = smooth.x;
			blob.rotation.y = clock.getElapsedTime() * 0.08 + smooth.x * 0.4;
			blob.rotation.x = smooth.y * 0.3;
			wire.rotation.y = -clock.getElapsedTime() * 0.05 - smooth.x * 0.2;
			wire.rotation.z = clock.getElapsedTime() * 0.03;
			renderer.render(scene, camera);
		};
		tick();
		live = true;

		dispose = () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('scroll', onScroll);
			ro.disconnect();
			io.disconnect();
			geometry.dispose();
			material.dispose();
			wire.geometry.dispose();
			(wire.material as THREE.Material).dispose();
			renderer.dispose();
			renderer.domElement.remove();
			live = false;
		};
	});

	onDestroy(() => {
		dispose?.();
		dispose = null;
	});
</script>

<div bind:this={host} class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
