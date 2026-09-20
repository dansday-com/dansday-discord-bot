type Listener = (visible: boolean) => void;

type Registry = {
	io: IntersectionObserver;
	listeners: Map<Element, Listener>;
};

const registries = new Map<string, Registry>();

export const FX_ROOT_MARGIN = '160px';

const FX_SCROLL_IDLE_MS = 120;

let scrolling = false;
let scrollTimer: ReturnType<typeof setTimeout>;

export function fxScrolling(): boolean {
	return scrolling;
}

function endScroll() {
	scrolling = false;
	document.documentElement.removeAttribute('data-fx-scroll');
}

function onScroll() {
	if (!scrolling) {
		scrolling = true;
		document.documentElement.setAttribute('data-fx-scroll', '');
	}
	clearTimeout(scrollTimer);
	scrollTimer = setTimeout(endScroll, FX_SCROLL_IDLE_MS);
}

if (typeof window !== 'undefined') {
	window.addEventListener('scroll', onScroll, { passive: true, capture: true });
}

export function observeVisibility(node: Element, fn: Listener, rootMargin: string = FX_ROOT_MARGIN): () => void {
	if (typeof IntersectionObserver === 'undefined') {
		fn(true);
		return () => {};
	}

	let registry = registries.get(rootMargin);
	if (!registry) {
		const listeners = new Map<Element, Listener>();
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
			},
			{ rootMargin }
		);
		registry = { io, listeners };
		registries.set(rootMargin, registry);
	}

	registry.listeners.set(node, fn);
	registry.io.observe(node);

	return () => {
		const current = registries.get(rootMargin);
		if (!current) return;
		current.listeners.delete(node);
		current.io.unobserve(node);
		if (current.listeners.size === 0) {
			current.io.disconnect();
			registries.delete(rootMargin);
		}
	};
}
