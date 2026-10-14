type Scroller = { stop: () => void; start: () => void };

let scroller: Scroller | null = null;
let locks = 0;
let hasUsedOverflow = false;

export function registerScroller(instance: Scroller): () => void {
	scroller = instance;
	if (locks > 0) {
		instance.stop();
		if (hasUsedOverflow) {
			document.body.style.overflow = '';
			hasUsedOverflow = false;
		}
	}
	return () => {
		if (scroller === instance) {
			scroller = null;
		}
	};
}

export function lockScroll(): () => void {
	if (typeof document === 'undefined') {
		return () => {};
	}

	if (++locks === 1) {
		if (scroller) {
			scroller.stop();
		} else {
			document.body.style.overflow = 'hidden';
			hasUsedOverflow = true;
		}
	}

	let wasReleased = false;
	return () => {
		if (wasReleased) {
			return;
		}
		wasReleased = true;
		locks = Math.max(0, locks - 1);
		if (locks === 0) {
			scroller?.start();
			if (hasUsedOverflow) {
				document.body.style.overflow = '';
				hasUsedOverflow = false;
			}
		}
	};
}

export function scrollLocked(_node: HTMLElement) {
	const release = lockScroll();
	return { destroy: release };
}
