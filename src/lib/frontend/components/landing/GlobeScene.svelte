<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { GLOBE_PLACES, type GlobePlace } from './countries.js';
	import type { LiveGainBatch } from '$lib/frontend/public/statistics/liveGlobal.svelte.js';

	type Props = { gains: LiveGainBatch | null; avoid?: (HTMLElement | null)[] };
	type Pulse = { id: number; place: GlobePlace; xp: number; born: number };

	let { gains, avoid = [] }: Props = $props();

	let canvasHost: HTMLDivElement | null = $state(null);
	let stage: HTMLDivElement | null = $state(null);
	let webgl = $state(true);
	let pulses = $state<Pulse[]>([]);
	let compactView = $state(false);

	const labelEls: Record<number, HTMLElement | undefined> = {};
	const labelSizes = new Map<number, { w: number; h: number }>();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));
	const amount = (pulse: Pulse) => `+${fmt(pulse.xp)} XP`;

	const PULSE_MS = 5600;
	const MAX_RIGS = 8;
	const MAX_PER_BATCH = 5;

	let seq = 0;
	const recent: string[] = [];
	let dispose: (() => void) | null = null;
	let requestFrame: (() => void) | null = null;

	function pickPlace(): GlobePlace {
		for (let i = 0; i < 12; i++) {
			const place = GLOBE_PLACES[Math.floor(Math.random() * GLOBE_PLACES.length)];
			if (!recent.includes(place.name)) {
				recent.push(place.name);
				if (recent.length > 8) recent.shift();
				return place;
			}
		}
		return GLOBE_PLACES[Math.floor(Math.random() * GLOBE_PLACES.length)];
	}

	function spawn(xp: number, delay = 0) {
		if (!(xp > 0)) return;
		pulses = [...pulses, { id: ++seq, place: pickPlace(), xp, born: performance.now() + delay }].slice(-MAX_RIGS);
		requestFrame?.();
	}

	$effect(() => {
		const batch = gains;
		if (!batch?.items.length) return;
		untrack(() => {
			batch.items.slice(-MAX_PER_BATCH).forEach((xp, index) => spawn(xp, index * 260 + Math.random() * 180));
		});
	});

	onMount(async () => {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const narrow = window.matchMedia('(max-width: 640px)');
		compactView = narrow.matches;
		const onNarrow = () => (compactView = narrow.matches);
		narrow.addEventListener('change', onNarrow);

		const startFallback = () => {
			webgl = false;
			narrow.removeEventListener('change', onNarrow);
		};

		let THREE: typeof import('three');
		try {
			THREE = await import('three');
		} catch (_) {
			startFallback();
			return;
		}
		if (!canvasHost) return;

		let renderer: import('three').WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
		} catch (_) {
			startFallback();
			return;
		}

		const reduced = motion.matches;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow.matches ? 1.25 : 1.5));
		renderer.setClearAlpha(0);
		canvasHost.appendChild(renderer.domElement);
		renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

		const read = (token: string, fallback: string) => {
			const value = getComputedStyle(canvasHost as HTMLElement)
				.getPropertyValue(token)
				.trim();
			return /^(#|rgb)/i.test(value) ? value : fallback;
		};

		const globe = new THREE.Group();
		globe.rotation.z = -0.41;
		scene.add(globe);

		const bodyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: true });
		const body = new THREE.Mesh(new THREE.SphereGeometry(0.992, 48, 32), bodyMat);
		body.renderOrder = -1;
		globe.add(body);

		const gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.07 });
		const rimMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.16 });
		const landMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.38 });

		const toVec = (lat: number, lon: number, r = 1) => {
			const phi = ((90 - lat) * Math.PI) / 180;
			const theta = ((lon + 180) * Math.PI) / 180;
			return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
		};

		const gridPoints: number[] = [];
		for (let lat = -60; lat <= 60; lat += 30) {
			for (let lon = -180; lon < 180; lon += 6) {
				const a = toVec(lat, lon, 1.001);
				const b = toVec(lat, lon + 6, 1.001);
				gridPoints.push(a.x, a.y, a.z, b.x, b.y, b.z);
			}
		}
		for (let lon = -180; lon < 180; lon += 30) {
			for (let lat = -84; lat < 84; lat += 6) {
				const a = toVec(lat, lon, 1.001);
				const b = toVec(lat + 6, lon, 1.001);
				gridPoints.push(a.x, a.y, a.z, b.x, b.y, b.z);
			}
		}
		const gridGeo = new THREE.BufferGeometry();
		gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
		globe.add(new THREE.LineSegments(gridGeo, gridMat));

		const rimPoints: number[] = [];
		for (let i = 0; i <= 128; i++) {
			const a = (i / 128) * Math.PI * 2;
			const b = ((i + 1) / 128) * Math.PI * 2;
			rimPoints.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
		}
		const rimGeo = new THREE.BufferGeometry();
		rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPoints, 3));
		scene.add(new THREE.LineSegments(rimGeo, rimMat));

		let landGeo: import('three').BufferGeometry | null = null;

		const rigs = Array.from({ length: MAX_RIGS }, () => {
			const group = new THREE.Group();
			group.visible = false;

			const dotMat = new THREE.MeshBasicMaterial({ transparent: true });
			const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), dotMat);

			const ringMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
			const ring = new THREE.Mesh(new THREE.RingGeometry(0.058, 0.076, 40), ringMat);

			const beamGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6);
			beamGeo.rotateX(Math.PI / 2);
			beamGeo.translate(0, 0, 0.5);
			const beamMat = new THREE.MeshBasicMaterial({ transparent: true });
			const beam = new THREE.Mesh(beamGeo, beamMat);

			group.add(dot, ring, beam);
			globe.add(group);
			return { group, dot, ring, beam, dotMat, ringMat, beamMat, pulseId: 0 };
		});

		const paint = () => {
			bodyMat.color.set(read('--color-base-200', '#e3e0d6'));
			gridMat.color.set(read('--color-base-content', '#2e211b'));
			rimMat.color.set(read('--color-primary', '#e43d12'));
			landMat.color.set(read('--color-primary', '#e43d12'));
			const primary = read('--color-primary', '#e43d12');
			const secondary = read('--color-secondary', '#d6536d');
			for (const rig of rigs) {
				rig.dotMat.color.set(primary);
				rig.ringMat.color.set(primary);
				rig.beamMat.color.set(secondary);
			}
		};
		paint();

		fetch('/geo/coastlines.json')
			.then((res) => (res.ok ? res.json() : null))
			.then((arcs: number[][] | null) => {
				if (!arcs?.length) return;
				const positions: number[] = [];
				for (const arc of arcs) {
					for (let i = 0; i + 3 < arc.length; i += 2) {
						const a = toVec(arc[i + 1], arc[i], 1.004);
						const b = toVec(arc[i + 3], arc[i + 2], 1.004);
						positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
					}
				}
				landGeo = new THREE.BufferGeometry();
				landGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
				globe.add(new THREE.LineSegments(landGeo, landMat));
				requestFrame?.();
			})
			.catch(() => {});

		const target = { x: 0, y: 0 };
		const smooth = { x: 0, y: 0 };
		const onPointer = (event: PointerEvent) => {
			target.x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
			target.y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
		};
		window.addEventListener('pointermove', onPointer, { passive: true });

		const resize = () => {
			if (!canvasHost) return;
			const { clientWidth: w, clientHeight: h } = canvasHost;
			if (!w || !h) return;
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			const half = Math.tan((camera.fov * Math.PI) / 360);
			const fit = 1.04;
			camera.position.z = Math.max(fit / half, fit / (half * camera.aspect));
			camera.updateProjectionMatrix();
			requestFrame?.();
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvasHost);
		resize();

		let onScreen = true;
		const io = new IntersectionObserver(
			(entries) => {
				onScreen = entries.some((entry) => entry.isIntersecting);
				if (onScreen) requestFrame?.();
			},
			{ threshold: 0 }
		);
		io.observe(canvasHost);

		const themeWatch = new MutationObserver(() => {
			paint();
			requestFrame?.();
		});
		themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

		const world = new THREE.Vector3();
		const toCamera = new THREE.Vector3();
		const normal = new THREE.Vector3();
		const axisZ = new THREE.Vector3(0, 0, 1);

		type Placement = { el: HTMLElement; x: number; y: number; opacity: number };

		const frame = (now: number) => {
			const active = pulses;

			for (const rig of rigs) {
				if (rig.pulseId && !active.some((pulse) => pulse.id === rig.pulseId)) {
					rig.pulseId = 0;
					rig.group.visible = false;
				}
			}

			for (const pulse of active) {
				if (rigs.some((rig) => rig.pulseId === pulse.id)) continue;
				const free = rigs.find((rig) => !rig.pulseId);
				if (!free) continue;
				free.pulseId = pulse.id;
				free.group.position.copy(toVec(pulse.place.lat, pulse.place.lon, 1.004));
				normal.copy(free.group.position).normalize();
				free.group.quaternion.setFromUnitVectors(axisZ, normal);
				free.group.visible = true;
			}

			const expired: number[] = [];

			if (!reduced) {
				smooth.x += (target.x - smooth.x) * 0.05;
				smooth.y += (target.y - smooth.y) * 0.05;
				globe.rotation.y = now * 0.000055 + smooth.x * 0.18;
				globe.rotation.x = smooth.y * 0.12;
			}

			for (const rig of rigs) {
				if (!rig.pulseId) continue;
				const pulse = active.find((item) => item.id === rig.pulseId);
				if (!pulse) continue;
				const life = reduced ? 0.32 : (now - pulse.born) / PULSE_MS;
				if (life >= 1) {
					expired.push(pulse.id);
					continue;
				}
				rig.group.visible = life >= 0;
				if (life < 0) continue;
				const fade = Math.pow(1 - life, 1.5);
				rig.ring.scale.setScalar(0.4 + life * 1.5);
				rig.ringMat.opacity = fade * 0.65;
				rig.dotMat.opacity = 0.9;
				rig.beam.scale.z = 0.2 * Math.min(1, life * 4);
				rig.beamMat.opacity = fade * 0.5;
			}

			renderer.render(scene, camera);

			const placements: Placement[] = [];
			const hidden: HTMLElement[] = [];

			if (stage) {
				const width = renderer.domElement.clientWidth;
				const height = renderer.domElement.clientHeight;
				const maxLabels = compactView ? 1 : 3;
				const stageRect = stage.getBoundingClientRect();
				const blocked = avoid.filter(Boolean).map((el) => (el as HTMLElement).getBoundingClientRect());
				let shown = 0;

				for (let i = active.length - 1; i >= 0; i--) {
					const pulse = active[i];
					const el = labelEls[pulse.id];
					const rig = rigs.find((item) => item.pulseId === pulse.id);
					if (!el) continue;
					if (!rig) {
						hidden.push(el);
						continue;
					}

					if (!labelSizes.has(pulse.id) && el.offsetWidth > 0) {
						labelSizes.set(pulse.id, { w: el.offsetWidth, h: el.offsetHeight });
					}
					const size = labelSizes.get(pulse.id);

					rig.group.getWorldPosition(world);
					normal.copy(world).normalize();
					toCamera.copy(camera.position).sub(world).normalize();
					const facing = normal.dot(toCamera);
					const life = reduced ? 0.32 : (now - pulse.born) / PULSE_MS;

					if (!size || facing <= 0.14 || shown >= maxLabels || life < 0 || life >= 1) {
						hidden.push(el);
						continue;
					}

					world.project(camera);
					const x = Math.min(Math.max((world.x * 0.5 + 0.5) * width + 12, 4), Math.max(4, width - size.w - 4));
					const y = Math.min(Math.max((-world.y * 0.5 + 0.5) * height - 10, size.h + 4), Math.max(size.h + 4, height - 4));

					const left = stageRect.left + x;
					const top = stageRect.top + y - size.h;
					const clash = blocked.some((rect) => left < rect.right + 8 && left + size.w > rect.left - 8 && top < rect.bottom + 8 && top + size.h > rect.top - 8);
					if (clash) {
						hidden.push(el);
						continue;
					}

					shown++;
					const enter = Math.min(1, life / 0.12);
					const exit = Math.min(1, (1 - life) / 0.25);
					placements.push({ el, x, y, opacity: Math.min(enter, exit) * Math.min(1, (facing - 0.14) / 0.22) });
				}
			} else {
				for (const pulse of active) {
					const el = labelEls[pulse.id];
					if (el) hidden.push(el);
				}
			}

			for (const el of hidden) el.style.opacity = '0';
			for (const place of placements) {
				place.el.style.transform = `translate(${Math.round(place.x)}px, ${Math.round(place.y)}px) translateY(-100%)`;
				place.el.style.opacity = String(place.opacity);
			}

			if (expired.length) {
				for (const id of expired) labelSizes.delete(id);
				pulses = pulses.filter((pulse) => !expired.includes(pulse.id));
			}
		};

		let raf = 0;
		let pending = false;

		if (reduced) {
			requestFrame = () => {
				if (pending) return;
				pending = true;
				requestAnimationFrame((now) => {
					pending = false;
					frame(now);
				});
			};
			const slow = setInterval(() => {
				const now = performance.now();
				if (pulses.some((pulse) => now - pulse.born > PULSE_MS)) {
					pulses = pulses.filter((pulse) => now - pulse.born <= PULSE_MS);
				}
				requestFrame?.();
			}, 1400);
			requestFrame();
			dispose = () => {
				clearInterval(slow);
				teardown();
			};
		} else {
			const tick = (now: number) => {
				raf = requestAnimationFrame(tick);
				if (!onScreen || document.hidden) return;
				frame(now);
			};
			requestFrame = () => {};
			raf = requestAnimationFrame(tick);
			dispose = () => {
				cancelAnimationFrame(raf);
				teardown();
			};
		}

		function teardown() {
			narrow.removeEventListener('change', onNarrow);
			window.removeEventListener('pointermove', onPointer);
			ro.disconnect();
			io.disconnect();
			themeWatch.disconnect();
			body.geometry.dispose();
			bodyMat.dispose();
			gridGeo.dispose();
			gridMat.dispose();
			rimGeo.dispose();
			rimMat.dispose();
			landGeo?.dispose();
			landMat.dispose();
			for (const rig of rigs) {
				rig.dot.geometry.dispose();
				rig.ring.geometry.dispose();
				rig.beam.geometry.dispose();
				rig.dotMat.dispose();
				rig.ringMat.dispose();
				rig.beamMat.dispose();
			}
			renderer.dispose();
			renderer.domElement.remove();
			requestFrame = null;
		}
	});

	onDestroy(() => {
		dispose?.();
		dispose = null;
	});
</script>

{#if webgl}
	<div class="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden" aria-hidden="true">
		<div bind:this={stage} class="absolute inset-0">
			<div bind:this={canvasHost} class="absolute inset-0"></div>
			{#each pulses as pulse (pulse.id)}
				<div
					bind:this={labelEls[pulse.id]}
					class="pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform motion-safe:transition-opacity motion-safe:duration-200"
				>
					<div class="border-base-300 bg-base-100/85 rounded-sm border px-2 py-1.5 backdrop-blur-[2px]">
						<p class="text-base-content/55 text-[8.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase 2xl:text-[10px]">
							{pulse.place.name}
						</p>
						<p class="text-primary mt-1 text-[11.5px] leading-none font-black whitespace-nowrap tabular-nums 2xl:text-[14px]">
							{amount(pulse)}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
