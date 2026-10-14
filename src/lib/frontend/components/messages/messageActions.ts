import { showToast, TOAST_MS } from '$lib/frontend/toast.svelte';

export async function deleteMessage(url: string): Promise<boolean> {
	const res = await fetch(url, { method: 'DELETE' });
	const out = await res.json().catch(() => ({}));
	if (!res.ok || !out.ok) {
		showToast(out.error || 'Could not delete the message', 'error', TOAST_MS.error);
		return false;
	}
	showToast(
		out.stripped ? 'Message deleted.' : 'Message deleted. A bot is offline, so some posted copies keep their buttons until it is back.',
		out.stripped ? 'success' : 'info',
		TOAST_MS.long
	);
	return true;
}
