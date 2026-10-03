export class SceneClock {
	t = $state(0);
	still = $state(false);
	duration: number;
	onend: (() => void) | null = null;
	#raf = 0;
	#last = 0;
	#playing = false;

	constructor(duration: number, rest: number) {
		this.duration = duration;
		this.t = rest;
	}

	play() {
		if (this.#playing || this.still) return;
		this.#playing = true;
		this.#last = performance.now();
		this.#raf = requestAnimationFrame(this.#tick);
	}

	pause() {
		this.#playing = false;
		cancelAnimationFrame(this.#raf);
	}

	#tick = (now: number) => {
		if (!this.#playing) return;
		const next = this.t + Math.min(100, now - this.#last);
		this.#last = now;
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
	clock.t = 0;
	const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? clock.play() : clock.pause()), { threshold: 0.35 });
	io.observe(node);
	return {
		destroy() {
			io.disconnect();
			clock.pause();
		}
	};
}
