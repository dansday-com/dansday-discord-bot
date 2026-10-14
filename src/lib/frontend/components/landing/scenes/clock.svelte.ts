export const TYPE_MS = 40;
export const SCENE_ANIM_MS = 320;
export const SCENE_RESET_MS = 500;
export const PRESS_MS = 220;
export const RIPPLE_MS = 520;

export const isTapped = (t: number, at: number) => t >= at && t < at + RIPPLE_MS;

const TAP_LEAD_MS = 380;
const TAP_HOLD_MS = 260;
const MAX_FRAME_STEP_MS = 100;
const VISIBLE_RATIO = 0.35;
const VISIBLE_VIEWPORT_SHARE = 0.4;
const VISIBILITY_STEPS = 20;
const VISIBILITY_THRESHOLDS = Array.from({ length: VISIBILITY_STEPS + 1 }, (_, i) => i / VISIBILITY_STEPS);

export const tapping = (t: number, at: number | undefined) => at !== undefined && t >= at - TAP_LEAD_MS && t < at + TAP_HOLD_MS;

export const typed = (text: string, t: number, from: number | undefined) =>
	from === undefined
		? text
		: Array.from(text)
				.slice(0, Math.max(0, Math.floor((t - from) / TYPE_MS)))
				.join('');

export class SceneClock {
	t = $state(0);
	still = $state(false);
	duration: number;
	onend: (() => void) | null = null;
	#raf = 0;
	#last = -1;
	#playing = false;

	constructor(duration: number, rest: number) {
		this.duration = duration;
		this.t = rest;
	}

	play() {
		if (this.#playing || this.still) {
			return;
		}
		this.#playing = true;
		this.#last = -1;
		this.#raf = requestAnimationFrame(this.#tick);
	}

	pause() {
		this.#playing = false;
		cancelAnimationFrame(this.#raf);
	}

	#tick = (now: number) => {
		if (!this.#playing) {
			return;
		}
		const dt = this.#last < 0 ? 0 : Math.max(0, Math.min(MAX_FRAME_STEP_MS, now - this.#last));
		this.#last = now;
		const next = this.t + dt;
		if (next >= this.duration) {
			this.t = 0;
			this.onend?.();
		} else {
			this.t = next;
		}
		this.#raf = requestAnimationFrame(this.#tick);
	};
}

export function playWhenVisible(node: HTMLElement, clock: SceneClock) {
	if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
		clock.still = true;
		return;
	}
	const io = new IntersectionObserver(
		([entry]) => {
			const viewport = entry.rootBounds?.height || window.innerHeight;
			const isVisible = entry.intersectionRatio >= VISIBLE_RATIO || entry.intersectionRect.height >= viewport * VISIBLE_VIEWPORT_SHARE;
			if (isVisible) {
				clock.play();
			} else {
				clock.pause();
			}
		},
		{ threshold: VISIBILITY_THRESHOLDS }
	);
	io.observe(node);
	return {
		destroy() {
			io.disconnect();
			clock.pause();
		}
	};
}
