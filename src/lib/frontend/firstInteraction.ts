const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;

export function onFirstInteraction(callback: () => void): () => void {
	const fire = () => {
		stop();
		callback();
	};
	const stop = () => {
		for (const type of EVENTS) window.removeEventListener(type, fire);
	};
	for (const type of EVENTS) window.addEventListener(type, fire, { passive: true });
	return stop;
}
