<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { DASHBOARD_PATH } from '$lib/frontend/redirect.js';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const isDemo = $derived(data?.user?.authenticated === true && data?.user?.is_demo === true);
	const demoExpiresAt = $derived(isDemo ? (data.user as any).session_expires_at : undefined);
	let demoRemainingMs = $state<number | null>(null);
	let demoTimer: number | null = null;

	function fmtCountdown(ms: number): string {
		const t = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(t / 60);
		const s = t % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	async function handleLogout() {
		await fetch('/api/panel/logout', { method: 'POST', credentials: 'include' });
		goto('/login');
	}

	onMount(() => {
		if (!isDemo || typeof demoExpiresAt !== 'number') return;
		const tick = async () => {
			const left = demoExpiresAt - Date.now();
			demoRemainingMs = left;
			if (left <= 0) {
				if (demoTimer) window.clearInterval(demoTimer);
				demoTimer = null;
				try {
					await fetch('/api/panel/logout', { method: 'POST', credentials: 'include' });
				} catch (_) {}
				showToast('Demo session expired', 'error');
				goto('/login');
			}
		};
		tick();
		demoTimer = window.setInterval(tick, 1000);
	});

	onDestroy(() => {
		if (demoTimer) window.clearInterval(demoTimer);
		demoTimer = null;
	});
</script>

<div class="bg-ash-950 text-ash-100 flex min-h-screen flex-col">
	<header class="bg-ash-800 border-ash-700 sticky top-0 z-40 flex-shrink-0 border-b">
		<div class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 lg:px-8">
			<a href={DASHBOARD_PATH} class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
				<div class="bg-ash-400 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10">
					<i class="fas fa-bolt text-ash-100 text-sm sm:text-base"></i>
				</div>
				<h1 class="text-ash-100 truncate text-base font-bold sm:text-xl">Dansday Discord Bot Panel</h1>
				{#if isDemo}
					<span class="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-200"> DEMO </span>
				{/if}
			</a>
			<div class="flex flex-shrink-0 items-center gap-2">
				{#if isDemo && typeof demoRemainingMs === 'number'}
					<span class="text-ash-300 text-xs">
						<span class="text-ash-500">Demo ends in</span>
						<span class="font-semibold text-cyan-200 tabular-nums">{fmtCountdown(demoRemainingMs)}</span>
					</span>
				{/if}
				<button
					onclick={handleLogout}
					class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
				>
					<i class="fas fa-sign-out-alt text-xs sm:text-sm"></i>
					<span class="hidden sm:inline">Logout</span>
				</button>
			</div>
		</div>
	</header>

	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>

	<MainFooter palette="dark" />
</div>
