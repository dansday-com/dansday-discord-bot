type Listener = (visible: boolean) => void;

type Registry = {
	io: IntersectionObserver;
	listeners: Map<Element, Listener>;
};

const registries = new Map<string, Registry>();

export const FX_ROOT_MARGIN = '160px';

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
