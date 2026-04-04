type ToastType = 'success' | 'error' | 'info';

interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function showToast(message: string, type: ToastType = 'info', duration = 4000) {
	const id = nextId++;
	toasts.push({ id, message, type });
	setTimeout(() => {
		const idx = toasts.findIndex((t) => t.id === id);
		if (idx !== -1) toasts.splice(idx, 1);
	}, duration);
}

export function getToasts() {
	return toasts;
}
