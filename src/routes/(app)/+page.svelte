<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import AddBotModal from '$lib/frontend/components/AddBotModal.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { dbDateTimeToMs } from '$lib/utils/datetime.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showAddBot = $state(false);
	let sortBy = $state('oldest');

	const botSortOptions: LabeledSelectOption[] = [
		{ value: 'oldest', label: 'Oldest First' },
		{ value: 'newest', label: 'Newest First' },
		{ value: 'name', label: 'Name (A-Z)' }
	];

	type LiveBot = { status: string; uptimeBase: number; uptimeTick: number };
	let liveMap = $state<Record<number, LiveBot>>({});
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let streams: EventSource[] = [];

	const sortedBots = $derived(
		[...data.bots].sort((a: { name: string; created_at: string }, b: { name: string; created_at: string }) => {
			if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
			if (sortBy === 'newest') return dbDateTimeToMs(b.created_at) - dbDateTimeToMs(a.created_at);
			return dbDateTimeToMs(a.created_at) - dbDateTimeToMs(b.created_at);
		})
	);

	onMount(() => {
		const initial: Record<number, LiveBot> = {};
		for (const bot of data.bots) {
			initial[bot.id] = { status: bot.status, uptimeBase: bot.uptime_ms ?? 0, uptimeTick: 0 };
		}
		liveMap = initial;

		for (const bot of data.bots) {
			const es = new EventSource(`/api/bots/${bot.id}/stream`);
			es.onmessage = (e) => {
				const d = JSON.parse(e.data);
				liveMap = {
					...liveMap,
					[bot.id]: { status: d.status, uptimeBase: d.uptime_ms ?? 0, uptimeTick: 0 }
				};
			};
			streams.push(es);
		}

		const base = Date.now();
		tickInterval = setInterval(() => {
			const elapsed = Date.now() - base;
			const next: Record<number, LiveBot> = {};
			for (const [id, live] of Object.entries(liveMap)) {
				next[Number(id)] = live.status === 'running' ? { ...live, uptimeTick: elapsed } : live;
			}
			liveMap = next;
		}, 1000);
	});

	onDestroy(() => {
		streams.forEach((es) => es.close());
		if (tickInterval) clearInterval(tickInterval);
	});

	function getLiveStatus(botId: number, fallback: string) {
		return liveMap[botId]?.status ?? fallback;
	}

	function getLiveUptime(botId: number, fallback: number) {
		const live = liveMap[botId];
		if (!live) return fallback;
		return live.status === 'running' ? live.uptimeBase + live.uptimeTick : 0;
	}

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function formatUptime(ms: number): string {
		if (!ms) return '';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}
</script>

<svelte:head>
	<title>Dashboard | Dansday Discord Bot</title>
</svelte:head>

<AddBotModal open={showAddBot} onclose={() => (showAddBot = false)} onadded={() => invalidateAll()} />

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	<div class="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
				<i class="fas fa-robot mr-2 text-violet-400"></i>Bots List
			</h2>
			<p class="text-ash-400 text-xs sm:text-sm">
				{data.bots.length === 0 ? 'No bots yet' : `${data.bots.length} bot${data.bots.length === 1 ? '' : 's'}`}
			</p>
		</div>
		<div class="flex items-center gap-2 sm:gap-3">
			<LabeledSelect
				id="dashboard-bots-sort"
				label="Sort by:"
				labelTone="cyan"
				labelIconClass="fas fa-filter text-cyan-300"
				appearance="dashboard"
				options={botSortOptions}
				bind:value={sortBy}
			/>
			{#if data.user.authenticated && data.user.account_source === 'accounts'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:scale-105 active:scale-95 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
				>
					<i class="fas fa-plus text-xs text-violet-300 sm:text-sm"></i>
					<span class="sm:inline">Add Bot</span>
				</button>
			{/if}
		</div>
	</div>

	{#if sortedBots.length === 0}
		<div class="py-8 text-center sm:py-12">
			<div class="bg-ash-800 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20">
				<i class="fas fa-robot text-3xl text-violet-300 sm:text-4xl"></i>
			</div>
			<h3 class="text-ash-100 mb-2 text-lg font-semibold sm:text-xl">No bots yet</h3>
			<p class="text-ash-400 mb-4 text-sm sm:mb-6 sm:text-base">Get started by adding your first bot</p>
			{#if data.user.authenticated && data.user.account_source === 'accounts'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all duration-200 hover:scale-105 active:scale-95 sm:px-6 sm:py-3 sm:text-base"
				>
					<i class="fas fa-plus text-violet-300"></i>Add Your First Bot
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
			{#each sortedBots as bot (bot.id)}
				<a
					href="/bots/{bot.id}"
					class="bg-ash-800 border-ash-700 hover:border-ash-500 flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
				>
					<div class="flex items-center gap-3">
						<div class="bg-ash-600 flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
							{#if bot.bot_icon}
								<img src={bot.bot_icon} alt={bot.name} class="h-full w-full object-cover" />
							{:else}
								<i class="fas fa-robot text-lg text-violet-300"></i>
							{/if}
						</div>
						<div class="min-w-0">
							<p class="text-ash-100 truncate text-sm font-semibold sm:text-base">{bot.name || `Bot #${bot.id}`}</p>
							<span class="text-ash-400 text-xs">Official</span>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="h-2 w-2 rounded-full {statusColor(getLiveStatus(bot.id, bot.status))}"></span>
							<span class="text-ash-300 text-xs capitalize">{getLiveStatus(bot.id, bot.status)}</span>
						</div>
						{#if getLiveStatus(bot.id, bot.status) === 'running'}
							{@const uptime = getLiveUptime(bot.id, bot.uptime_ms ?? 0)}
							{#if uptime}
								<span class="text-ash-500 text-xs">{formatUptime(uptime)}</span>
							{/if}
						{/if}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
