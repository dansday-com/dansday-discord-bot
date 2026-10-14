import { cubicOut } from 'svelte/easing';
const COUNT_UP_MS = 900;

export function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

export function countUp(node: HTMLElement, target: number) {
	const render = (v: number) => (node.textContent = Math.round(v).toLocaleString());
	if (prefersReducedMotion() || !Number.isFinite(target)) {
		render(target || 0);
		return {};
	}
	let start = 0;
	let raf = 0;
	const tick = (now: number) => {
		if (!start) {
			start = now;
		}
		const t = Math.min(1, (now - start) / COUNT_UP_MS);
		render((target || 0) * cubicOut(t));
		if (t < 1) {
			raf = requestAnimationFrame(tick);
		}
	};
	render(0);
	raf = requestAnimationFrame(tick);
	return { destroy: () => cancelAnimationFrame(raf) };
}

export function growOnMount() {
	let isGrown = $state(false);

	$effect(() => {
		if (prefersReducedMotion()) {
			isGrown = true;
			return;
		}
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => (isGrown = true));
		});
		return () => {
			cancelAnimationFrame(outer);
			if (inner) {
				cancelAnimationFrame(inner);
			}
		};
	});

	return {
		get value() {
			return isGrown ? 1 : 0;
		},
		get done() {
			return isGrown;
		}
	};
}
