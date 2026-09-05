type ToastType = 'success' | 'error' | 'info';

export type Toast = {
	id: number;
	message: string;
	type: ToastType;
	duration: number;
};

const MAX_VISIBLE = 4;

type Timer = { handle: ReturnType<typeof setTimeout> | null; remaining: number; startedAt: number };

let toasts = $state<Toast[]>([]);
let nextId = 0;
const timers = new Map<number, Timer>();

function arm(id: number, ms: number) {
	const handle = setTimeout(() => dismissToast(id), ms);
	timers.set(id, { handle, remaining: ms, startedAt: Date.now() });
}

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
	const id = nextId++;
	toasts.push({ id, message, type, duration });
	while (toasts.length > MAX_VISIBLE) dismissToast(toasts[0].id);
	arm(id, duration);
	return id;
}

export function dismissToast(id: number) {
	const timer = timers.get(id);
	if (timer?.handle) clearTimeout(timer.handle);
	timers.delete(id);
	const index = toasts.findIndex((toast) => toast.id === id);
	if (index !== -1) toasts.splice(index, 1);
}

export function pauseToast(id: number) {
	const timer = timers.get(id);
	if (!timer?.handle) return;
	clearTimeout(timer.handle);
	timer.handle = null;
	timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
}

export function resumeToast(id: number) {
	const timer = timers.get(id);
	if (!timer || timer.handle) return;
	if (timer.remaining <= 0) {
		dismissToast(id);
		return;
	}
	timer.startedAt = Date.now();
	timer.handle = setTimeout(() => dismissToast(id), timer.remaining);
}

export function getToasts() {
	return toasts;
}
