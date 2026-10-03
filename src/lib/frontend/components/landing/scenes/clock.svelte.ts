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
		if (this.#playing || this.still) return;
		this.#playing = true;
		this.#last = -1;
		this.#raf = requestAnimationFrame(this.#tick);
	}

	pause() {
		this.#playing = false;
		cancelAnimationFrame(this.#raf);
	}

	#tick = (now: number) => {
		if (!this.#playing) return;
		const dt = this.#last < 0 ? 0 : Math.max(0, Math.min(100, now - this.#last));
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
			const visible = entry.intersectionRatio >= 0.35 || entry.intersectionRect.height >= viewport * 0.4;
			if (visible) clock.play();
			else clock.pause();
		},
		{ threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] }
	);
	io.observe(node);
	return {
		destroy() {
			io.disconnect();
			clock.pause();
		}
	};
}
