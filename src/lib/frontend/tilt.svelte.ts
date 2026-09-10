import { prefersReducedMotion } from '$lib/frontend/components/dash/motion.svelte';

export type TiltStatus = 'unsupported' | 'idle' | 'pending' | 'granted' | 'denied';

const MAX_GAMMA = 32;
const MAX_BETA = 30;
const REST_BETA = 42;
const EASE = 0.11;

let status = $state<TiltStatus>('idle');
let canPrompt = $state(false);
let refs = 0;
let live = false;
let listening = false;
let armed: (() => void) | null = null;
let raf = 0;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;

export const tilt = {
	get status() {
		return status;
	},
	get needsPermission() {
		return canPrompt;
	}
};

function clamp1(value: number): number {
	return Math.max(-1, Math.min(1, value));
}

function needsPermission(): boolean {
	return typeof (globalThis as any).DeviceOrientationEvent?.requestPermission === 'function';
}

function hasOrientation(): boolean {
	return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

function write(x: number, y: number) {
	const root = document.documentElement;
	root.style.setProperty('--fx-tx', x.toFixed(4));
	root.style.setProperty('--fx-ty', y.toFixed(4));
}

function frame() {
	curX += (targetX - curX) * EASE;
	curY += (targetY - curY) * EASE;
	write(curX, curY);
	raf = requestAnimationFrame(frame);
}

function onOrientation(event: DeviceOrientationEvent) {
	const gamma = event.gamma;
	const beta = event.beta;
	if (gamma == null || beta == null) return;
	if (!live) {
		live = true;
		status = 'granted';
		document.documentElement.classList.add('fx-tilt');
		raf = requestAnimationFrame(frame);
	}
	const landscape = Math.abs(window.screen?.orientation?.angle ?? 0) === 90;
	targetX = clamp1((landscape ? beta - REST_BETA : gamma) / MAX_GAMMA);
	targetY = clamp1((landscape ? gamma : beta - REST_BETA) / MAX_BETA);
}

function attach() {
	if (listening) return;
	listening = true;
	if (status === 'pending') status = 'idle';
	window.addEventListener('deviceorientation', onOrientation, { passive: true });
}

function detach() {
	if (armed) {
		armed();
		armed = null;
	}
	if (!listening) return;
	listening = false;
	live = false;
	document.documentElement.classList.remove('fx-tilt');
	window.removeEventListener('deviceorientation', onOrientation);
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
	targetX = 0;
	targetY = 0;
	curX = 0;
	curY = 0;
	write(0, 0);
}

export async function requestTilt(): Promise<TiltStatus> {
	canPrompt = needsPermission();
	if (!hasOrientation()) {
		status = 'unsupported';
		return status;
	}
	if (prefersReducedMotion()) {
		status = 'idle';
		return status;
	}
	if (!needsPermission()) {
		attach();
		return status;
	}

	status = 'pending';
	try {
		const outcome = await (globalThis as any).DeviceOrientationEvent.requestPermission();
		if (outcome === 'granted') {
			attach();
			return status;
		}
		status = 'denied';
	} catch {
		status = 'denied';
	}
	return status;
}

function armOnGesture() {
	if (armed || listening) return;
	const fire = () => {
		armed = null;
		window.removeEventListener('pointerdown', fire);
		window.removeEventListener('touchend', fire);
		if (refs > 0) void requestTilt();
	};
	armed = () => {
		window.removeEventListener('pointerdown', fire);
		window.removeEventListener('touchend', fire);
	};
	window.addEventListener('pointerdown', fire, { passive: true });
	window.addEventListener('touchend', fire, { passive: true });
}

export function startTilt(): () => void {
	if (typeof window === 'undefined') return () => {};
	refs += 1;

	canPrompt = needsPermission();

	if (!hasOrientation()) {
		status = 'unsupported';
	} else if (prefersReducedMotion()) {
		status = 'idle';
	} else if (needsPermission()) {
		if (status !== 'denied') armOnGesture();
	} else {
		attach();
	}

	let released = false;
	return () => {
		if (released) return;
		released = true;
		refs = Math.max(0, refs - 1);
		if (refs === 0) detach();
	};
}
