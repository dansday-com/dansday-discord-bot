<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canEdit = $derived(data.user.authenticated && (data.user.account_source === 'accounts' || data.user.account_type === 'owner'));

	let liveStatus = $state<string>(data.bot.status ?? 'stopped');
	let uptimeBase = $state<number>(0);
	let uptimeTick = $state<number>(0);
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let es: EventSource | null = null;

	function startTick() {
		if (tickInterval) return;
		const base = Date.now();
		tickInterval = setInterval(() => {
			uptimeTick = Date.now() - base;
		}, 1000);
	}

	function stopTick() {
		if (tickInterval) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
		uptimeTick = 0;
	}

	const displayUptime = $derived(liveStatus === 'running' ? uptimeBase + uptimeTick : 0);

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function formatUptime(ms: number): string {
		if (!ms) return '—';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	onMount(() => {
		es = new EventSource(`/api/bots/${data.bot.id}/stream`);
		es.onmessage = (e) => {
			const d = JSON.parse(e.data);
			liveStatus = d.status ?? liveStatus;
			uptimeBase = d.uptime_ms ?? 0;
			if (liveStatus === 'running') startTick();
			else stopTick();
		};
		if (liveStatus === 'running') startTick();
	});

	onDestroy(() => {
		es?.close();
		stopTick();
	});

	async function botAction(action: 'start' | 'stop' | 'restart') {
		const res = await fetch(`/api/${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ bot_id: data.bot.id })
		});
		const d = await res.json();
		if (d.success || res.ok) {
			showToast(`Bot ${action} initiated`, 'success');
			invalidateAll();
		} else {
			showToast(d.error || `Failed to ${action}`, 'error');
		}
	}

	async function deleteSelfbot() {
		if (!confirm(`Delete "${data.bot.name || `Selfbot #${data.bot.id}`}"? This cannot be undone.`)) return;
		const res = await fetch(`/api/servers/${data.serverId}/selfbot`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ selfbot_id: data.bot.id })
		});
		const d = await res.json();
		if (d.success) {
			showToast('Selfbot deleted', 'success');
			goto(`/bots/${data.botId}/servers/${data.serverId}/selfbot`);
		} else {
			showToast(d.error || 'Failed to delete', 'error');
		}
	}

	const isRunning = $derived(liveStatus === 'running');
	const isBusy = $derived(liveStatus === 'starting' || liveStatus === 'stopping');
	const canStart = $derived(!isRunning && !isBusy);
	const canStop = $derived(isRunning || isBusy);
</script>

<svelte:head>
	<title>{data.bot.name || `Selfbot #${data.bot.id}`} | Dansday</title>
</svelte:head>

<div class="space-y-4">
	<a
		href={`/bots/${data.botId}/servers/${data.serverId}/selfbot`}
		class="text-ash-400 hover:text-ash-100 inline-flex items-center gap-2 text-sm transition-colors"
	>
		<i class="fas fa-arrow-left"></i>Back to Selfbots
	</a>

	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex min-w-0 items-center gap-4">
				<div class="bg-ash-600 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
					<i class="fas fa-robot text-ash-300 text-2xl"></i>
				</div>
				<div class="min-w-0">
					<h2 class="text-ash-100 truncate text-xl font-bold sm:text-2xl">{data.bot.name || `Selfbot #${data.bot.id}`}</h2>
					<div class="mt-1 flex flex-wrap items-center gap-2">
						<span class="h-2 w-2 rounded-full {statusColor(liveStatus)}"></span>
						<span class="text-ash-300 text-xs capitalize">{liveStatus}</span>
						{#if liveStatus === 'running'}
							<span class="text-ash-500 text-xs">{formatUptime(displayUptime)}</span>
						{/if}
					</div>
				</div>
			</div>

			{#if canEdit}
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					{#if canStart}
						<button
							onclick={() => botAction('start')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-green-700 active:scale-95 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-play"></i>
							<span class="hidden sm:inline">Start</span>
						</button>
					{/if}
					{#if canStop}
						<button
							onclick={() => botAction('stop')}
							class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all hover:scale-105 active:scale-95 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-stop"></i>
							<span class="hidden sm:inline">Stop</span>
						</button>
						<button
							onclick={() => botAction('restart')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-yellow-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-yellow-700 active:scale-95 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-redo"></i>
							<span class="hidden sm:inline">Restart</span>
						</button>
					{/if}
					<button
						onclick={deleteSelfbot}
						class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-red-800 active:scale-95 sm:px-4 sm:text-sm"
					>
						<i class="fas fa-trash"></i>
						<span class="hidden sm:inline">Delete</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
