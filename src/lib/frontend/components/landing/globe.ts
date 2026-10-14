import { GLOBE_PLACES, type GlobePlace } from './countries.js';
import type { BufferGeometry, Group, LineBasicMaterial, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';

type Three = typeof import('three');
type ToVec = (lat: number, lon: number, r?: number) => Vector3;
type Rig = {
	group: Group;
	dot: Mesh;
	ring: Mesh;
	beam: Mesh;
	dotMat: MeshBasicMaterial;
	ringMat: MeshBasicMaterial;
	beamMat: MeshBasicMaterial;
	pulseId: number;
};
type Box = { left: number; top: number; right: number; bottom: number };
type LabelBox = { left: number; top: number; w: number; h: number };

export type GlobePulse = { id: number; place: GlobePlace; xp: number; born: number };
export type LabelPlacement = { el: HTMLElement; x: number; y: number; opacity: number };
export type GlobeLabels = {
	stage: HTMLElement | null;
	avoid: (HTMLElement | null)[];
	elements: Record<number, HTMLElement | undefined>;
	sizes: Map<number, { w: number; h: number }>;
};
export type GlobeOptions = { renderer: WebGLRenderer; maxRigs: number; pulseMs: number; isReduced: boolean };

const LABEL_GAP = 8;

function vecMaker(THREE: Three): ToVec {
	return (lat, lon, r = 1) => {
		const phi = ((90 - lat) * Math.PI) / 180;
		const theta = ((lon + 180) * Math.PI) / 180;
		return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
	};
}

function segment(positions: number[], a: Vector3, b: Vector3) {
	positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
}

function gridPositions(toVec: ToVec): number[] {
	const positions: number[] = [];
	for (let lat = -60; lat <= 60; lat += 30) {
		for (let lon = -180; lon < 180; lon += 6) {
			segment(positions, toVec(lat, lon, 1.001), toVec(lat, lon + 6, 1.001));
		}
	}
	for (let lon = -180; lon < 180; lon += 30) {
		for (let lat = -84; lat < 84; lat += 6) {
			segment(positions, toVec(lat, lon, 1.001), toVec(lat + 6, lon, 1.001));
		}
	}
	return positions;
}

function rimPositions(): number[] {
	const positions: number[] = [];
	for (let i = 0; i <= 128; i++) {
		const a = (i / 128) * Math.PI * 2;
		const b = ((i + 1) / 128) * Math.PI * 2;
		positions.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
	}
	return positions;
}

function coastlinePositions(arcs: number[][], toVec: ToVec): number[] {
	const positions: number[] = [];
	for (const arc of arcs) {
		for (let i = 0; i + 3 < arc.length; i += 2) {
			segment(positions, toVec(arc[i + 1], arc[i], 1.004), toVec(arc[i + 3], arc[i + 2], 1.004));
		}
	}
	return positions;
}

function geometryOf(THREE: Three, positions: number[]): BufferGeometry {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	return geometry;
}

function createRig(THREE: Three): Rig {
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
	return { group, dot, ring, beam, dotMat, ringMat, beamMat, pulseId: 0 };
}

function clashes(blocked: Box[], { left, top, w, h }: LabelBox) {
	return blocked.some(
		(rect) => left < rect.right + LABEL_GAP && left + w > rect.left - LABEL_GAP && top < rect.bottom + LABEL_GAP && top + h > rect.top - LABEL_GAP
	);
}

function freeSlot(blocked: Box[], label: LabelBox, height: number): number {
	const step = label.h + 6;
	const floor = label.h + 4;
	const ceiling = Math.max(floor, height - 4);
	for (const offset of [0, -step, step]) {
		const candidate = Math.min(Math.max(label.top + offset, floor), ceiling);
		if (Math.abs(candidate - label.top) <= step && !clashes(blocked, { left: label.left, top: candidate - label.h, w: label.w, h: label.h })) {
			return candidate;
		}
	}
	return -1;
}

export class GlobeView {
	private readonly THREE: Three;
	private readonly options: GlobeOptions;
	private readonly toVec: ToVec;
	private readonly scene: Scene;
	private readonly camera: PerspectiveCamera;
	private readonly globe: Group;
	private readonly body: Mesh;
	private readonly bodyMat: MeshBasicMaterial;
	private readonly gridMat: LineBasicMaterial;
	private readonly rimMat: LineBasicMaterial;
	private readonly landMat: LineBasicMaterial;
	private readonly gridGeo: BufferGeometry;
	private readonly rimGeo: BufferGeometry;
	private readonly rigs: Rig[];
	private readonly world: Vector3;
	private readonly toCamera: Vector3;
	private readonly normal: Vector3;
	private readonly axisZ: Vector3;
	private readonly facingPoint: Vector3;
	private readonly facingToCamera: Vector3;
	private readonly target = { x: 0, y: 0 };
	private readonly smooth = { x: 0, y: 0 };
	private landGeo: BufferGeometry | null = null;
	private boxes: Box[] = [];
	private boxesAt = -Infinity;

	constructor(THREE: Three, options: GlobeOptions) {
		this.THREE = THREE;
		this.options = options;
		this.toVec = vecMaker(THREE);
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

		this.globe = new THREE.Group();
		this.globe.rotation.z = -0.41;
		this.scene.add(this.globe);

		this.bodyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: true });
		this.body = new THREE.Mesh(new THREE.SphereGeometry(0.992, 48, 32), this.bodyMat);
		this.body.renderOrder = -1;
		this.globe.add(this.body);

		this.gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.07 });
		this.rimMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.16 });
		this.landMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.38 });

		this.gridGeo = geometryOf(THREE, gridPositions(this.toVec));
		this.globe.add(new THREE.LineSegments(this.gridGeo, this.gridMat));
		this.rimGeo = geometryOf(THREE, rimPositions());
		this.scene.add(new THREE.LineSegments(this.rimGeo, this.rimMat));

		this.rigs = Array.from({ length: options.maxRigs }, () => createRig(THREE));
		for (const rig of this.rigs) {
			this.globe.add(rig.group);
		}

		this.world = new THREE.Vector3();
		this.toCamera = new THREE.Vector3();
		this.normal = new THREE.Vector3();
		this.axisZ = new THREE.Vector3(0, 0, 1);
		this.facingPoint = new THREE.Vector3();
		this.facingToCamera = new THREE.Vector3();
	}

	get canvas() {
		return this.options.renderer.domElement;
	}

	paint(read: (token: string, fallback: string) => string, primaryFallback: string) {
		this.bodyMat.color.set(read('--color-base-200', '#e3e0d6'));
		this.gridMat.color.set(read('--color-base-content', '#2e211b'));
		this.rimMat.color.set(read('--color-primary', primaryFallback));
		this.landMat.color.set(read('--color-primary', primaryFallback));
		const primary = read('--color-primary', primaryFallback);
		const secondary = read('--color-secondary', '#d6536d');
		for (const rig of this.rigs) {
			rig.dotMat.color.set(primary);
			rig.ringMat.color.set(primary);
			rig.beamMat.color.set(secondary);
		}
	}

	addCoastlines(arcs: number[][]) {
		this.landGeo = geometryOf(this.THREE, coastlinePositions(arcs, this.toVec));
		this.globe.add(new this.THREE.LineSegments(this.landGeo, this.landMat));
	}

	pointTo(x: number, y: number) {
		this.target.x = x;
		this.target.y = y;
	}

	resize(width: number, height: number) {
		this.options.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		const half = Math.tan((this.camera.fov * Math.PI) / 360);
		const fit = 1.04;
		this.camera.position.z = Math.max(fit / half, fit / (half * this.camera.aspect));
		this.camera.updateProjectionMatrix();
		this.boxesAt = -Infinity;
	}

	pickFacing(exclude: string[]): GlobePlace | null {
		const candidates: GlobePlace[] = [];
		for (const place of GLOBE_PLACES) {
			if (exclude.includes(place.name)) {
				continue;
			}
			this.facingPoint.copy(this.toVec(place.lat, place.lon, 1)).applyQuaternion(this.globe.quaternion);
			this.facingToCamera.copy(this.camera.position).sub(this.facingPoint).normalize();
			if (this.facingPoint.normalize().dot(this.facingToCamera) > 0.38) {
				candidates.push(place);
			}
		}
		return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
	}

	render(now: number, active: GlobePulse[]): number[] {
		this.syncRigs(active);
		if (!this.options.isReduced) {
			this.smooth.x += (this.target.x - this.smooth.x) * 0.05;
			this.smooth.y += (this.target.y - this.smooth.y) * 0.05;
			this.globe.rotation.y = now * 0.000055 + this.smooth.x * 0.18;
			this.globe.rotation.x = this.smooth.y * 0.12;
		}
		const expired = this.animateRigs(now, active);
		this.options.renderer.render(this.scene, this.camera);
		return expired;
	}

	layoutLabels(now: number, active: GlobePulse[], labels: GlobeLabels): { placements: LabelPlacement[]; hidden: HTMLElement[] } {
		const placements: LabelPlacement[] = [];
		const hidden: HTMLElement[] = [];
		if (!labels.stage) {
			hidden.push(...active.map((pulse) => labels.elements[pulse.id]).filter((el): el is HTMLElement => Boolean(el)));
			return { placements, hidden };
		}

		this.measure(now, labels);
		const blocked = this.boxes.slice();
		for (let i = active.length - 1; i >= 0; i--) {
			const pulse = active[i];
			const el = labels.elements[pulse.id];
			if (!el) {
				continue;
			}
			const placement = this.placeLabel(now, { pulse, el, labels }, blocked);
			if (placement) {
				placements.push(placement);
			} else {
				hidden.push(el);
			}
		}
		return { placements, hidden };
	}

	dispose() {
		this.body.geometry.dispose();
		this.bodyMat.dispose();
		this.gridGeo.dispose();
		this.gridMat.dispose();
		this.rimGeo.dispose();
		this.rimMat.dispose();
		this.landGeo?.dispose();
		this.landMat.dispose();
		for (const rig of this.rigs) {
			rig.dot.geometry.dispose();
			rig.ring.geometry.dispose();
			rig.beam.geometry.dispose();
			rig.dotMat.dispose();
			rig.ringMat.dispose();
			rig.beamMat.dispose();
		}
		this.options.renderer.dispose();
		this.options.renderer.domElement.remove();
	}

	private lifeOf(now: number, pulse: GlobePulse) {
		return this.options.isReduced ? 0.32 : (now - pulse.born) / this.options.pulseMs;
	}

	private syncRigs(active: GlobePulse[]) {
		for (const rig of this.rigs) {
			if (rig.pulseId && !active.some((pulse) => pulse.id === rig.pulseId)) {
				rig.pulseId = 0;
				rig.group.visible = false;
			}
		}

		for (const pulse of active) {
			const free = this.rigs.some((rig) => rig.pulseId === pulse.id) ? undefined : this.rigs.find((rig) => !rig.pulseId);
			if (!free) {
				continue;
			}
			free.pulseId = pulse.id;
			free.group.position.copy(this.toVec(pulse.place.lat, pulse.place.lon, 1.004));
			this.normal.copy(free.group.position).normalize();
			free.group.quaternion.setFromUnitVectors(this.axisZ, this.normal);
			free.group.visible = true;
		}
	}

	private animateRigs(now: number, active: GlobePulse[]): number[] {
		const expired: number[] = [];
		for (const rig of this.rigs) {
			const pulse = rig.pulseId ? active.find((item) => item.id === rig.pulseId) : undefined;
			if (!pulse) {
				continue;
			}
			const life = this.lifeOf(now, pulse);
			if (life >= 1) {
				expired.push(pulse.id);
				continue;
			}
			rig.group.visible = life >= 0;
			if (life < 0) {
				continue;
			}
			const fade = (1 - life) ** 1.5;
			const exit = Math.min(1, (1 - life) / 0.25);
			rig.ring.scale.setScalar(0.4 + life * 1.5);
			rig.ringMat.opacity = fade * 0.65;
			rig.dotMat.opacity = 0.9 * exit;
			rig.beam.scale.z = 0.2 * Math.min(1, life * 4);
			rig.beamMat.opacity = fade * 0.5;
		}
		return expired;
	}

	private measure(now: number, labels: GlobeLabels) {
		if (!labels.stage || now - this.boxesAt < 1000) {
			return;
		}
		this.boxesAt = now;
		const origin = labels.stage.getBoundingClientRect();
		this.boxes = labels.avoid
			.filter((el): el is HTMLElement => !!el)
			.map((el) => {
				const rect = el.getBoundingClientRect();
				return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
			});
	}

	private placeLabel(now: number, { pulse, el, labels }: { pulse: GlobePulse; el: HTMLElement; labels: GlobeLabels }, blocked: Box[]): LabelPlacement | null {
		const rig = this.rigs.find((item) => item.pulseId === pulse.id);
		if (!rig) {
			return null;
		}

		if (!labels.sizes.has(pulse.id) && el.offsetWidth > 0) {
			labels.sizes.set(pulse.id, { w: el.offsetWidth, h: el.offsetHeight });
		}
		const size = labels.sizes.get(pulse.id);

		rig.group.getWorldPosition(this.world);
		this.normal.copy(this.world).normalize();
		this.toCamera.copy(this.camera.position).sub(this.world).normalize();
		const facing = this.normal.dot(this.toCamera);
		const life = this.lifeOf(now, pulse);
		if (!size || facing <= 0.14 || life < 0 || life >= 1) {
			return null;
		}

		const width = this.options.renderer.domElement.clientWidth;
		const height = this.options.renderer.domElement.clientHeight;
		this.world.project(this.camera);
		const x = Math.min(Math.max((this.world.x * 0.5 + 0.5) * width + 12, 4), Math.max(4, width - size.w - 4));
		const y = Math.min(Math.max((-this.world.y * 0.5 + 0.5) * height - 10, size.h + 4), Math.max(size.h + 4, height - 4));

		const slot = freeSlot(blocked, { left: x, top: y, w: size.w, h: size.h }, height);
		if (slot < 0) {
			return null;
		}

		const top = slot - size.h;
		blocked.push({ left: x, top, right: x + size.w, bottom: top + size.h });
		const enter = Math.min(1, life / 0.12);
		const exit = Math.min(1, (1 - life) / 0.25);
		return { el, x, y: slot, opacity: Math.min(enter, exit) * Math.min(1, (facing - 0.14) / 0.22) };
	}
}
