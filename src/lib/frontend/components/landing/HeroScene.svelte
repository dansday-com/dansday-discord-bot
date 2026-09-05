<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	let host: HTMLDivElement | null = $state(null);
	let dispose: (() => void) | null = null;

	const NOISE = `
		vec3 hn_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec4 hn_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
		vec4 hn_permute(vec4 x) { return hn_mod289(((x * 34.0) + 10.0) * x); }
		vec4 hn_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

		float hn_snoise(vec3 v) {
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
			i = hn_mod289(i);
			vec4 p = hn_permute(hn_permute(hn_permute(
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
			vec4 norm = hn_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
			p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
			vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
			m = m * m;
			return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
		}

		float hn_fbm(vec3 d) {
			float t = uTime * 0.16;
			float n = hn_snoise(d * 1.35 + vec3(t, t * 0.7, -t * 0.55));
			n += 0.45 * hn_snoise(d * 3.1 + vec3(-t * 1.25, t * 0.9, t));
			return n;
		}

		vec3 hn_displace(vec3 pos, vec3 nor) {
			return pos + nor * hn_fbm(nor) * uAmp;
		}

		vec3 hn_normal(vec3 pos, vec3 nor) {
			vec3 up = abs(nor.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
			vec3 t = normalize(cross(up, nor));
			vec3 b = normalize(cross(nor, t));
			float e = 0.035;
			vec3 c = hn_displace(pos, nor);
			vec3 a = hn_displace(pos + t * e, normalize(nor + t * e));
			vec3 d = hn_displace(pos + b * e, normalize(nor + b * e));
			vec3 n = normalize(cross(a - c, d - c));
			return dot(n, nor) < 0.0 ? -n : n;
		}
	`;

	onMount(async () => {
		if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const THREE = await import('three');
		const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
		renderer.setClearAlpha(0);
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;
		host.appendChild(renderer.domElement);
		renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
		camera.position.z = 5.4;

		const pmrem = new THREE.PMREMGenerator(renderer);
		const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
		scene.environment = envRT.texture;
		scene.environmentIntensity = 1.25;

		const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.3 } };

		const glass = new THREE.MeshPhysicalMaterial({
			color: new THREE.Color('#ffb59c'),
			transmission: 1,
			thickness: 2.1,
			ior: 1.58,
			dispersion: 9,
			roughness: 0.09,
			metalness: 0,
			iridescence: 1,
			iridescenceIOR: 1.32,
			iridescenceThicknessRange: [120, 520],
			attenuationColor: new THREE.Color('#e43d12'),
			attenuationDistance: 2.4,
			clearcoat: 1,
			clearcoatRoughness: 0.12,
			transparent: true,
			opacity: 0.92
		});

		glass.onBeforeCompile = (shader) => {
			shader.uniforms.uTime = uniforms.uTime;
			shader.uniforms.uAmp = uniforms.uAmp;
			shader.vertexShader = shader.vertexShader
				.replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uAmp;\n${NOISE}`)
				.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = hn_normal(position, normal);')
				.replace('#include <begin_vertex>', 'vec3 transformed = hn_displace(position, normal);');
		};
		glass.customProgramCacheKey = () => 'hero-glass';

		const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 26), glass);
		scene.add(blob);

		const shellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e43d12'), wireframe: true, transparent: true, opacity: 0.06 });
		const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.95, 4), shellMat);
		scene.add(shell);

		const key = new THREE.DirectionalLight(0xffffff, 2.2);
		key.position.set(2.5, 3, 4);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0xffc7a8, 1.4);
		rim.position.set(-3, -1.5, -2);
		scene.add(rim);

		const target = { x: 0, y: 0 };
		const smooth = { x: 0, y: 0 };
		const onPointer = (e: PointerEvent) => {
			target.x = (e.clientX / window.innerWidth - 0.5) * 2;
			target.y = (e.clientY / window.innerHeight - 0.5) * 2;
		};
		window.addEventListener('pointermove', onPointer, { passive: true });

		let scrollN = 0;
		const onScroll = () => (scrollN = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)));
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
		const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)), { threshold: 0 });
		io.observe(host);

		let frame = 0;
		const clock = new THREE.Clock();
		const tick = () => {
			frame = requestAnimationFrame(tick);
			if (!visible) return;
			const t = clock.getElapsedTime();
			smooth.x += (target.x - smooth.x) * 0.045;
			smooth.y += (target.y - smooth.y) * 0.045;

			uniforms.uTime.value = t;
			uniforms.uAmp.value = 0.3 + scrollN * 0.45 + Math.abs(smooth.x) * 0.08;

			blob.rotation.y = t * 0.07 + smooth.x * 0.42;
			blob.rotation.x = smooth.y * 0.3;
			blob.position.y = Math.sin(t * 0.42) * 0.09;

			shell.rotation.y = -t * 0.045 - smooth.x * 0.2;
			shell.rotation.z = t * 0.028;

			camera.position.x = smooth.x * 0.32;
			camera.position.y = -smooth.y * 0.22;
			camera.lookAt(0, 0, 0);

			renderer.render(scene, camera);
		};
		tick();

		dispose = () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('scroll', onScroll);
			ro.disconnect();
			io.disconnect();
			blob.geometry.dispose();
			glass.dispose();
			shell.geometry.dispose();
			shellMat.dispose();
			envRT.dispose();
			pmrem.dispose();
			renderer.dispose();
			renderer.domElement.remove();
		};
	});

	onDestroy(() => {
		dispose?.();
		dispose = null;
	});
</script>

<div bind:this={host} class="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2" aria-hidden="true"></div>
