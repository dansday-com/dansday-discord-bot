<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import AddSelfbotModal from '$lib/components/AddSelfbotModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canEdit = $derived(data.user.account_type === 'superadmin' || data.user.account_type === 'owner');

	let showAdd = $state(false);

	type LiveBot = { status: string; process_id: number | null; uptime_ms: number };
	let liveData = $state<Record<number, LiveBot>>({});
	let uptimeTicks = $state<Record<number, number>>({});
	let tickBase: Record<number, number> = {};
	let intervals: Record<number, ReturnType<typeof setInterval>> = {};
	let streams: Record<number, EventSource> = {};

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function statusTextColor(status: string) {
		if (status === 'running') return 'text-green-400';
		if (status === 'starting' || status === 'stopping') return 'text-yellow-400';
		return 'text-ash-400';
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

	function startTick(id: number) {
		stopTick(id);
		tickBase[id] = Date.now();
		uptimeTicks[id] = 0;
		intervals[id] = setInterval(() => {
			uptimeTicks[id] = Date.now() - tickBase[id];
		}, 1000);
	}

	function stopTick(id: number) {
		if (intervals[id]) {
			clearInterval(intervals[id]);
			delete intervals[id];
		}
		uptimeTicks[id] = 0;
	}

	function subscribeBot(id: number) {
		if (streams[id]) return;
		const es = new EventSource(`/api/bots/${id}/stream`);
		es.onmessage = (e) => {
			const d = JSON.parse(e.data);
			liveData[id] = { status: d.status, process_id: d.process_id ?? null, uptime_ms: d.uptime_ms ?? 0 };
			if (d.status === 'running') {
				startTick(id);
			} else {
				stopTick(id);
			}
		};
		streams[id] = es;
	}

	onMount(() => {
		for (const bot of data.selfbots) {
			liveData[bot.id] = { status: bot.status, process_id: null, uptime_ms: 0 };
			subscribeBot(bot.id);
		}
	});

	onDestroy(() => {
		for (const es of Object.values(streams)) es.close();
		for (const id of Object.keys(intervals)) clearInterval(intervals[Number(id)]);
	});

	async function botAction(selfbotId: number, action: 'start' | 'stop' | 'restart') {
		const res = await fetch(`/api/${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ bot_id: selfbotId })
		});
		const d = await res.json();
		if (d.success || res.ok) {
			showToast(`Bot ${action} initiated`, 'success');
		} else {
			showToast(d.error || `Failed to ${action}`, 'error');
		}
	}

	async function deleteBot(selfbotId: number, name: string) {
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		const res = await fetch(`/api/servers/${data.serverId}/selfbot`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ selfbot_id: selfbotId })
		});
		const d = await res.json();
		if (d.success) {
			showToast('Selfbot deleted', 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Failed to delete', 'error');
		}
	}

	function getDisplayUptime(id: number): number {
		return (liveData[id]?.uptime_ms ?? 0) + (uptimeTicks[id] ?? 0);
	}
</script>

<svelte:head>
	<title>Selfbots | Dansday</title>
</svelte:head>

<AddSelfbotModal open={showAdd} serverId={data.serverId} onclose={() => (showAdd = false)} onadded={() => invalidateAll()} />

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-ash-100 flex items-center gap-2 text-xl font-bold">
			<i class="fas fa-robot text-ash-200"></i>Selfbots
		</h2>
		{#if canEdit}
			<button
				onclick={() => (showAdd = true)}
				class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:scale-105 active:scale-95"
			>
				<i class="fas fa-plus text-xs"></i>Add Selfbot
			</button>
		{/if}
	</div>

	{#if data.selfbots.length === 0}
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-8 text-center">
			<i class="fas fa-robot text-ash-600 mb-3 text-3xl"></i>
			<p class="text-ash-400 text-sm">No selfbots yet.</p>
		</div>
	{:else}
		{#each data.selfbots as bot (bot.id)}
			{@const live = liveData[bot.id] ?? { status: bot.status, process_id: null, uptime_ms: 0 }}
			{@const isRunning = live.status === 'running'}
			{@const isBusy = live.status === 'starting' || live.status === 'stopping'}
			{@const canStart = !isRunning && !isBusy}
			{@const canStop = isRunning || isBusy}

			<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
					<div class="flex min-w-0 flex-1 items-center gap-4">
						<div class="bg-ash-600 flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
							<i class="fas fa-robot text-ash-300 text-xl"></i>
						</div>
						<div class="min-w-0">
							<h3 class="text-ash-100 truncate text-lg font-bold">{bot.name}</h3>
							<div class="mt-1 flex items-center gap-2">
								<span class="h-2 w-2 rounded-full {statusColor(live.status)}"></span>
								<span class="text-sm capitalize {statusTextColor(live.status)}">{live.status}</span>
								{#if isRunning}
									<span class="text-ash-400 text-xs">{formatUptime(getDisplayUptime(bot.id))}</span>
								{/if}
							</div>
						</div>
					</div>

					{#if canEdit}
						<div class="flex shrink-0 flex-wrap items-center gap-2">
							{#if canStart}
								<button
									onclick={() => botAction(bot.id, 'start')}
									class="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white transition-all hover:scale-105 hover:bg-green-700 active:scale-95"
								>
									<i class="fas fa-play"></i>Start
								</button>
							{/if}
							{#if canStop}
								<button
									onclick={() => botAction(bot.id, 'stop')}
									class="bg-ash-400 hover:bg-ash-500 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all hover:scale-105 active:scale-95"
								>
									<i class="fas fa-stop"></i>Stop
								</button>
								<button
									onclick={() => botAction(bot.id, 'restart')}
									class="flex items-center gap-1.5 rounded-lg bg-yellow-600 px-3 py-2 text-xs font-medium text-white transition-all hover:scale-105 hover:bg-yellow-700 active:scale-95"
								>
									<i class="fas fa-redo"></i>Restart
								</button>
							{/if}
							<button
								onclick={() => deleteBot(bot.id, bot.name)}
								class="flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white transition-all hover:scale-105 hover:bg-red-800 active:scale-95"
							>
								<i class="fas fa-trash"></i>Delete
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>
