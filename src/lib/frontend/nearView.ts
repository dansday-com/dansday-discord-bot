export function nearView(node: HTMLElement, onNear: () => void) {
	const io = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			io.disconnect();
			onNear();
		},
		{ rootMargin: '1000px 0px' }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
}
