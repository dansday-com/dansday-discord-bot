<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import AddSelfbotModal from '$lib/frontend/components/AddSelfbotModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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
		const es = new EventSource(`/api/selfbots/${id}/stream`);
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

	async function deleteBot(selfbotId: number, name: string) {
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		const res = await fetch('/api/panel/selfbots', {
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
	<title>Selfbots | {APP_NAME} Discord Bot</title>
</svelte:head>

<AddSelfbotModal open={showAdd} onclose={() => (showAdd = false)} onadded={() => invalidateAll()} />

<div class="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
	<div class="min-w-0">
		<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
			<i class="fas fa-user-secret mr-2 text-fuchsia-400"></i>Selfbots
		</h2>
		<p class="text-ash-400 text-xs sm:text-sm">
			{data.selfbots.length === 0 ? 'No selfbots yet' : `${data.selfbots.length} selfbot${data.selfbots.length === 1 ? '' : 's'}`}
		</p>
	</div>
	<div class="flex items-center gap-2 sm:gap-3">
		<button
			onclick={() => (showAdd = true)}
			class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
		>
			<i class="fas fa-plus text-xs text-fuchsia-300 sm:text-sm"></i>
			<span class="sm:inline">Add Selfbot</span>
		</button>
	</div>
</div>

{#if data.selfbots.length === 0}
	<div class="py-8 text-center sm:py-12">
		<div class="bg-ash-800 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20">
			<i class="fas fa-user-secret text-3xl text-fuchsia-300 sm:text-4xl"></i>
		</div>
		<h3 class="text-ash-100 mb-2 text-lg font-semibold sm:text-xl">No selfbots yet</h3>
		<p class="text-ash-400 mb-4 text-sm sm:mb-6 sm:text-base">Get started by adding your first selfbot</p>
		<button
			onclick={() => (showAdd = true)}
			class="bg-ash-400 hover:bg-ash-500 text-ash-100 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all duration-200 hover:scale-105 active:scale-95 sm:px-6 sm:py-3 sm:text-base"
		>
			<i class="fas fa-plus text-fuchsia-300"></i>Add Your First Selfbot
		</button>
	</div>
{:else}
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
		{#each data.selfbots as bot (bot.id)}
			{@const live = liveData[bot.id] ?? { status: bot.status, process_id: null, uptime_ms: 0 }}

			<a
				href="/selfbots/{bot.id}"
				class="bg-ash-800 border-ash-700 hover:border-ash-500 flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
			>
				<div class="flex items-center gap-3">
					<div class="bg-ash-600 flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
						{#if bot.bot_icon}
							<img src={bot.bot_icon} alt="" class="h-full w-full object-cover" />
						{:else}
							<i class="fas fa-user-secret text-lg text-fuchsia-300"></i>
						{/if}
					</div>
					<div class="min-w-0">
						<p class="text-ash-100 truncate text-sm font-semibold sm:text-base">{bot.name || `Selfbot #${bot.id}`}</p>
						<span class="text-ash-400 text-xs">Selfbot</span>
					</div>
				</div>

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
	</div>
{/if}
