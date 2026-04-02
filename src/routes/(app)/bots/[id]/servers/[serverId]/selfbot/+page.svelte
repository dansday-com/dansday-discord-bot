<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import AddSelfbotModal from '$lib/frontend/components/AddSelfbotModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const canEdit = $derived(data.user.authenticated && (data.user.account_source === 'accounts' || data.user.account_type === 'owner'));

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

			<a
				href={`/bots/${data.botId}/servers/${data.serverId}/selfbot/${bot.id}`}
				class="bg-ash-800 border-ash-700 hover:border-ash-500 flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
			>
				<!-- Bot icon + name -->
				<div class="flex items-center gap-3">
					<div class="bg-ash-600 flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
						<i class="fas fa-robot text-ash-300 text-lg"></i>
					</div>
					<div class="min-w-0">
						<p class="text-ash-100 truncate text-sm font-semibold sm:text-base">{bot.name || `Selfbot #${bot.id}`}</p>
						<span class="text-ash-400 text-xs">Selfbot</span>
					</div>
				</div>

				<!-- Status -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 rounded-full {statusColor(live.status)}"></span>
						<span class="text-ash-300 text-xs capitalize">{live.status}</span>
					</div>
					{#if live.status === 'running'}
						{@const uptime = getDisplayUptime(bot.id)}
						{#if uptime}
							<span class="text-ash-500 text-xs">{formatUptime(uptime)}</span>
						{/if}
					{/if}
				</div>
			</a>
		{/each}
	{/if}
</div>
