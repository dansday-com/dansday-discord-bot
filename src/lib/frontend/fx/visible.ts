type Listener = (visible: boolean) => void;

type Entry = {
	fn: Listener;
	intersecting: boolean;
	live: boolean;
};

type Registry = {
	io: IntersectionObserver;
	listeners: Map<Element, Entry>;
};

const registries = new Map<string, Registry>();

export const FX_ROOT_MARGIN = '160px';

const FX_MAX_LIVE = 10;

export const FX_RETAIN_MS = 2000;

const FX_BUILD_BUDGET = 2;

const pending = new Set<() => void>();
let flushHandle = 0;

function flush() {
	flushHandle = 0;
	let done = 0;
	for (const task of pending) {
		pending.delete(task);
		task();
		if (++done >= FX_BUILD_BUDGET) break;
	}
	if (pending.size > 0) flushHandle = requestAnimationFrame(flush);
}

export function scheduleFx(task: () => void): () => void {
	if (typeof requestAnimationFrame === 'undefined') {
		task();
		return () => {};
	}
	pending.add(task);
	if (flushHandle === 0) flushHandle = requestAnimationFrame(flush);
	return () => {
		pending.delete(task);
	};
}

const rankQueued = new Set<Registry>();
let rankHandle = 0;

function scheduleRank(registry: Registry) {
	rankQueued.add(registry);
	if (rankHandle !== 0) return;
	rankHandle = requestAnimationFrame(() => {
		rankHandle = 0;
		const due = [...rankQueued];
		rankQueued.clear();
		for (const item of due) rank(item);
	});
}

function rank(registry: Registry) {
	const mid = window.innerHeight / 2;
	const candidates: { node: Element; entry: Entry; dist: number }[] = [];
	for (const [node, entry] of registry.listeners) {
		if (!entry.intersecting) {
			if (entry.live) {
				entry.live = false;
				entry.fn(false);
			}
			continue;
		}
		const box = node.getBoundingClientRect();
		candidates.push({ node, entry, dist: Math.abs(box.top + box.height / 2 - mid) });
	}

	candidates.sort((a, b) => a.dist - b.dist);

	for (let i = 0; i < candidates.length; i++) {
		const { entry } = candidates[i];
		const next = i < FX_MAX_LIVE;
		if (next === entry.live) continue;
		entry.live = next;
		entry.fn(next);
	}
}

export function observeVisibility(node: Element, fn: Listener, rootMargin: string = FX_ROOT_MARGIN): () => void {
	if (typeof IntersectionObserver === 'undefined') {
		fn(true);
		return () => {};
	}

	let registry = registries.get(rootMargin);
	if (!registry) {
		const listeners = new Map<Element, Entry>();
		const io = new IntersectionObserver(
			(entries) => {
				const current = registries.get(rootMargin);
				if (!current) return;
				for (const entry of entries) {
					const known = listeners.get(entry.target);
					if (known) known.intersecting = entry.isIntersecting;
				}
				scheduleRank(current);
			},
			{ rootMargin }
		);
		registry = { io, listeners };
		registries.set(rootMargin, registry);
	}

	registry.listeners.set(node, { fn, intersecting: false, live: false });
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
