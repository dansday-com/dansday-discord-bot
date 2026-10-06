type ToneOptions = { type?: OscillatorType; gain?: number; dur?: number; delay?: number; glide?: number };
type NoiseOptions = { gain?: number; dur?: number; q?: number; delay?: number };
type TickAxis = 'h' | 's' | 'b';
type Curve = [number, number, number, number];

const TICK_GAP_MS = 14;
const DETENT_GAP_MS = 28;
const KEY_GAP_MS = 22;
const PRESSABLE =
	'a[href], button, summary, select, [role="tab"], [role="button"], [role="option"], input[type="checkbox"], input[type="radio"], input[type="file"], input[type="color"], input[type="range"]';
const TYPED =
	'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="number"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"]';
const UNLOCK_EVENTS = ['pointerup', 'touchend', 'keydown', 'click'];
const TICKS: Record<TickAxis, { freq: number; dur: number; gain: number }> = {
	h: { freq: 1500, dur: 0.009, gain: 0.075 },
	s: { freq: 2300, dur: 0.008, gain: 0.068 },
	b: { freq: 3400, dur: 0.007, gain: 0.06 }
};
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

let primed = false;
let live = false;
let context: AudioContext | null = null;
let master: GainNode | null = null;
let hiss: AudioBuffer | null = null;
let lastTick = 0;
let lastDetent = 0;
let lastKey = 0;
let cues = 0;

function audio(): AudioContext | null {
	if (typeof window === 'undefined' || !primed || !live) return null;
	if (!context) {
		const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
		if (!Ctor) return null;
		try {
			context = new Ctor();
		} catch {
			return null;
		}
		master = context!.createGain();
		master.connect(context!.destination);
	}
	if (context!.state !== 'running') void context!.resume().catch(() => null);
	return context;
}

function prime() {
	primed = true;
	audio();
}

if (typeof window !== 'undefined') {
	for (const type of UNLOCK_EVENTS) window.addEventListener(type, prime, { capture: true, passive: true });
	window.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && prime(), { capture: true, passive: true });
}

function unit(n: number): number {
	return Math.min(1, Math.max(0, n));
}

function tone(freq: number, { type = 'sine', gain = 0.08, dur = 0.1, delay = 0, glide = 0 }: ToneOptions = {}) {
	cues++;
	const ctx = audio();
	if (!ctx || !master) return;
	const at = ctx.currentTime + delay;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, at);
	if (glide > 0) osc.frequency.exponentialRampToValueAtTime(glide, at + dur);
	amp.gain.setValueAtTime(0.0001, at);
	amp.gain.linearRampToValueAtTime(gain, at + 0.004);
	amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
	osc.connect(amp);
	amp.connect(master);
	osc.start(at);
	osc.stop(at + dur + 0.02);
	osc.onended = () => {
		osc.disconnect();
		amp.disconnect();
	};
}

function noise(freq: number, { gain = 0.06, dur = 0.01, q = 2.6, delay = 0 }: NoiseOptions = {}) {
	cues++;
	const ctx = audio();
	if (!ctx || !master) return;
	if (!hiss) {
		hiss = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const data = hiss.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	}
	const at = ctx.currentTime + delay;
	const src = ctx.createBufferSource();
	const band = ctx.createBiquadFilter();
	const amp = ctx.createGain();
	src.buffer = hiss;
	band.type = 'bandpass';
	band.frequency.setValueAtTime(freq, at);
	band.Q.setValueAtTime(q, at);
	amp.gain.setValueAtTime(gain, at);
	amp.gain.linearRampToValueAtTime(0, at + dur);
	src.connect(band);
	band.connect(amp);
	amp.connect(master);
	src.start(at, Math.random() * Math.max(0, hiss.duration - dur - 0.1), dur + 0.02);
	src.onended = () => {
		src.disconnect();
		band.disconnect();
		amp.disconnect();
	};
}

function click(axis: TickAxis, ratio: number) {
	const now = performance.now();
	if (now - lastTick < TICK_GAP_MS) return;
	lastTick = now;
	const t = TICKS[axis];
	const bend = (1.25 - 0.5 * unit(ratio)) * Math.pow(2, (Math.random() - 0.5) / 8);
	noise(t.freq * bend, { gain: t.gain * (0.7 + Math.random() * 0.6), dur: t.dur });
}

function curvePoint(a: number, b: number, s: number): number {
	const inv = 1 - s;
	return 3 * inv * inv * s * a + 3 * inv * s * s * b + s * s * s;
}

export function curveCrossings(curve: Curve, count: number): number[] {
	const [x1, y1, x2, y2] = curve;
	const SAMPLES = 4000;
	const times: number[] = [];
	let next = 0;
	for (let i = 0; i <= SAMPLES && next < count; i++) {
		const s = i / SAMPLES;
		while (next < count && curvePoint(y1, y2, s) >= (next + 0.5) / count) {
			times.push(curvePoint(x1, x2, s));
			next++;
		}
	}
	return times;
}

export const sfx = {
	press() {
		tone(520, { type: 'triangle', gain: 0.07, dur: 0.07 });
		tone(780, { gain: 0.05, dur: 0.07, delay: 0.02 });
	},
	show() {
		tone(294, { gain: 0.09, dur: 0.26, glide: 440 });
		noise(900, { gain: 0.035, dur: 0.12, q: 0.8 });
	},
	second(last: boolean) {
		tone(last ? 880 : 620, { gain: last ? 0.09 : 0.065, dur: last ? 0.14 : 0.08 });
	},
	go() {
		tone(880, { type: 'triangle', gain: 0.1, dur: 0.12 });
		tone(1174.66, { gain: 0.08, dur: 0.12, delay: 0.06 });
	},
	tick(axis: TickAxis, ratio: number) {
		click(axis, ratio);
	},
	notch(ratio: number) {
		click('s', 1 - unit(ratio));
	},
	lock() {
		tone(640, { type: 'triangle', gain: 0.09, dur: 0.09 });
		tone(960, { gain: 0.07, dur: 0.1 });
		noise(1200, { gain: 0.05, dur: 0.03, q: 1.2 });
	},
	count(progress: number) {
		tone(440 * Math.pow(2, 1.75 * unit(progress)), { type: 'triangle', gain: 0.05, dur: 0.045 });
	},
	land(quality: number) {
		if (quality >= 0.9) {
			[1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => tone(f, { gain: 0.075, dur: 0.3, delay: i * 0.06 }));
			noise(6000, { gain: 0.03, dur: 0.25, q: 0.7, delay: 0.12 });
		} else if (quality >= 0.7) {
			tone(783.99, { gain: 0.08, dur: 0.16 });
			tone(1046.5, { gain: 0.08, dur: 0.24, delay: 0.08 });
		} else if (quality >= 0.45) {
			tone(659.25, { type: 'triangle', gain: 0.08, dur: 0.2 });
		} else {
			tone(300, { gain: 0.11, dur: 0.34, glide: 150 });
			tone(226, { type: 'triangle', gain: 0.05, dur: 0.3, delay: 0.05, glide: 113 });
		}
	},
	payout(quality: number) {
		const notes = 3 + Math.round(unit(quality) * 5);
		SCALE.slice(0, notes).forEach((f, i) => tone(f, { type: i % 2 ? 'sine' : 'triangle', gain: 0.07, dur: 0.18, delay: i * 0.07 }));
		tone(SCALE[notes - 1] * 2, { gain: 0.06, dur: 0.6, delay: notes * 0.07 });
		if (quality >= 0.8) noise(7000, { gain: 0.03, dur: 0.4, q: 0.6, delay: notes * 0.07 });
	},
	buy() {
		tone(1318.51, { gain: 0.08, dur: 0.07 });
		tone(1760, { gain: 0.08, dur: 0.26, delay: 0.07 });
		tone(880, { type: 'triangle', gain: 0.04, dur: 0.09 });
	},
	trash() {
		tone(520, { gain: 0.08, dur: 0.3, glide: 170 });
		tone(390, { type: 'triangle', gain: 0.04, dur: 0.26, delay: 0.04, glide: 130 });
	},
	bust() {
		tone(300, { gain: 0.12, dur: 0.36, glide: 140 });
		tone(226, { type: 'triangle', gain: 0.06, dur: 0.32, delay: 0.05, glide: 105 });
		noise(220, { gain: 0.11, dur: 0.2, q: 0.7 });
	},
	reel(cells: number, seconds: number, curve: Curve) {
		curveCrossings(curve, cells).forEach((t, k) => {
			const late = cells > 1 ? k / (cells - 1) : 1;
			noise(1900 - 600 * late, { gain: 0.04 + 0.05 * late, dur: 0.012 + 0.012 * late, q: 2, delay: t * seconds });
			tone(560 - 140 * late, { type: 'triangle', gain: 0.02 + 0.04 * late, dur: 0.035, delay: t * seconds });
		});
	},
	knock() {
		[0, 0.11].forEach((delay) => {
			noise(190, { gain: 0.15, dur: 0.05, q: 1.1, delay });
			tone(150, { gain: 0.1, dur: 0.07, glide: 92, delay });
		});
	},
	flip(delay = 0, soft = false) {
		noise(1400, { gain: soft ? 0.022 : 0.05, dur: 0.1, q: 0.9, delay });
		if (!soft) tone(460, { type: 'triangle', gain: 0.04, dur: 0.1, glide: 820, delay });
	},
	gem(step: number) {
		const freq = 523.25 * Math.pow(2, Math.max(0, step - 1) / 6);
		tone(freq, { gain: 0.09, dur: 0.28 });
		tone(freq * 1.5, { gain: 0.05, dur: 0.32, delay: 0.05 });
		tone(freq * 2, { gain: 0.04, dur: 0.4, delay: 0.1 });
	},
	open(): boolean {
		if (!audio()) return false;
		tone(392, { gain: 0.05, dur: 0.12 });
		tone(587.33, { gain: 0.05, dur: 0.14, delay: 0.045 });
		tone(783.99, { gain: 0.045, dur: 0.24, delay: 0.09 });
		return true;
	},
	close() {
		tone(587.33, { gain: 0.05, dur: 0.13, glide: 370 });
	},
	detent(index: number, high = false) {
		const now = performance.now();
		if (now - lastDetent < DETENT_GAP_MS) return;
		lastDetent = now;
		tone(SCALE[Math.abs(index) % SCALE.length] * (high ? 2 : 1), { type: 'triangle', gain: 0.05, dur: 0.05 });
	},
	select() {
		tone(783.99, { type: 'triangle', gain: 0.09, dur: 0.1 });
		tone(1174.66, { gain: 0.07, dur: 0.14, delay: 0.05 });
	},
	pop() {
		tone(440, { gain: 0.05, dur: 0.08, glide: 660 });
		tone(880, { gain: 0.035, dur: 0.13, delay: 0.05 });
	},
	alert() {
		tone(622.25, { type: 'triangle', gain: 0.06, dur: 0.11 });
		tone(622.25, { type: 'triangle', gain: 0.06, dur: 0.17, delay: 0.15 });
	},
	done() {
		tone(659.25, { gain: 0.06, dur: 0.1 });
		tone(987.77, { gain: 0.06, dur: 0.22, delay: 0.07 });
	},
	nope() {
		tone(196, { type: 'triangle', gain: 0.09, dur: 0.1 });
		tone(146.83, { type: 'triangle', gain: 0.09, dur: 0.17, delay: 0.1 });
	},
	on() {
		tone(523.25, { gain: 0.06, dur: 0.07 });
		tone(783.99, { gain: 0.06, dur: 0.15, delay: 0.06 });
	},
	off() {
		tone(783.99, { gain: 0.06, dur: 0.07 });
		tone(523.25, { gain: 0.05, dur: 0.15, delay: 0.06 });
	},
	key() {
		const now = performance.now();
		if (now - lastKey < KEY_GAP_MS) return;
		lastKey = now;
		noise(2400 * Math.pow(2, (Math.random() - 0.5) / 4), { gain: 0.022, dur: 0.006 });
	}
};

function unlessCued(play: () => void) {
	const before = cues;
	setTimeout(() => cues === before && play(), 0);
}

function onClick(e: Event) {
	const el = (e.target as Element | null)?.closest?.(PRESSABLE);
	if (!el || el.closest('[data-sfx-off]')) return;
	unlessCued(sfx.press);
}

function onInput(e: Event) {
	const el = e.target as HTMLInputElement | null;
	if (!el?.matches || el.closest('[data-sfx-off]')) return;
	if (el.matches('input[type="range"]')) {
		const min = Number(el.min) || 0;
		const span = (Number(el.max) || 100) - min || 1;
		unlessCued(() => sfx.notch((Number(el.value) - min) / span));
	} else if (el.matches('input[type="color"]')) unlessCued(() => sfx.notch(0.5));
	else if (el.matches(TYPED)) unlessCued(sfx.key);
}

function onChange(e: Event) {
	const el = e.target as Element | null;
	if (!el?.matches?.('select, input[type="file"]') || el.closest('[data-sfx-off]')) return;
	unlessCued(sfx.select);
}

export function attachSfx(): () => void {
	live = true;
	window.addEventListener('click', onClick, true);
	window.addEventListener('input', onInput, true);
	window.addEventListener('change', onChange, true);
	return () => {
		live = false;
		window.removeEventListener('click', onClick, true);
		window.removeEventListener('input', onInput, true);
		window.removeEventListener('change', onChange, true);
	};
}
