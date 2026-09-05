type Scroller = { stop: () => void; start: () => void };

let scroller: Scroller | null = null;
let locks = 0;

export function registerScroller(instance: Scroller): () => void {
	scroller = instance;
	if (locks > 0) instance.stop();
	return () => {
		if (scroller === instance) scroller = null;
	};
}

export function lockScroll(): () => void {
	if (typeof document === 'undefined') return () => {};

	if (++locks === 1) {
		document.body.style.overflow = 'hidden';
		scroller?.stop();
	}

	let released = false;
	return () => {
		if (released) return;
		released = true;
		locks = Math.max(0, locks - 1);
		if (locks === 0) {
			document.body.style.overflow = '';
			scroller?.start();
		}
	};
}
