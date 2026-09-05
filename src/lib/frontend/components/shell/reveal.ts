const HIDDEN = ['opacity-0', 'translate-y-5'];
const SHOWN = ['opacity-100', 'translate-y-0'];

/**
 * Fades an element up when it scrolls into view. The element must already carry
 * the hidden classes plus a transition in its markup so there is no first-paint flash.
 */
export function reveal(node: HTMLElement) {
	const show = () => {
		node.classList.remove(...HIDDEN);
		node.classList.add(...SHOWN);
	};

	if (typeof IntersectionObserver === 'undefined') {
		show();
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					show();
					io.unobserve(e.target);
				}
			}
		},
		{ threshold: 0, rootMargin: '0px 0px -40px 0px' }
	);
	io.observe(node);
	return { destroy: () => io.disconnect() };
}

export const REVEAL_CLASS = 'translate-y-5 opacity-0 transition-all duration-500 ease-out';
