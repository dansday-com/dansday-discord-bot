<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AddBotModal from '$lib/components/AddBotModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showAddBot = $state(false);
	let sortBy = $state('oldest');

	const officialBots = $derived(data.bots.filter((b: { bot_type: string }) => b.bot_type === 'official'));

	const sortedBots = $derived([...data.bots].sort((a: { name: string; created_at: string }, b: { name: string; created_at: string }) => {
		if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
		if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
	}));

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
	<title>Dashboard | Dansday</title>
</svelte:head>

<AddBotModal
	open={showAddBot}
	{officialBots}
	onclose={() => (showAddBot = false)}
	onadded={() => invalidateAll()}
/>

<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
	<!-- Header row -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
		<div class="min-w-0">
			<h2 class="text-xl sm:text-2xl font-bold text-ash-100 mb-1">
				<i class="fas fa-robot mr-2 text-ash-200"></i>Bots List
			</h2>
			<p class="text-ash-400 text-xs sm:text-sm">
				{data.bots.length === 0 ? 'No bots yet' : `${data.bots.length} bot${data.bots.length === 1 ? '' : 's'}`}
			</p>
		</div>
		<div class="flex items-center gap-2 sm:gap-3">
			<label class="text-xs sm:text-sm text-ash-400 flex items-center gap-1 sm:gap-2 whitespace-nowrap">
				<i class="fas fa-filter"></i>
				<span class="sm:inline">Sort by:</span>
			</label>
			<select
				bind:value={sortBy}
				class="bg-ash-800 border border-ash-600 text-ash-100 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ash-500 transition-all"
			>
				<option value="oldest">Oldest First</option>
				<option value="newest">Newest First</option>
				<option value="name">Name (A-Z)</option>
			</select>
			{#if data.user.account_type === 'admin'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
				>
					<i class="fas fa-plus text-xs sm:text-sm"></i>
					<span class="sm:inline">Add Bot</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Bot grid -->
	{#if sortedBots.length === 0}
		<div class="text-center py-8 sm:py-12">
			<div class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-ash-800 rounded-full mb-4">
				<i class="fas fa-robot text-3xl sm:text-4xl text-ash-600"></i>
			</div>
			<h3 class="text-lg sm:text-xl font-semibold text-ash-100 mb-2">No bots yet</h3>
			<p class="text-ash-400 text-sm sm:text-base mb-4 sm:mb-6">Get started by adding your first bot</p>
			{#if data.user.account_type === 'admin'}
				<button
					onclick={() => (showAddBot = true)}
					class="bg-ash-400 hover:bg-ash-500 text-ash-100 px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 inline-flex items-center gap-2 text-sm sm:text-base"
				>
					<i class="fas fa-plus"></i>Add Your First Bot
				</button>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
			{#each sortedBots as bot (bot.id)}
				<a
					href="/bots/{bot.id}"
					class="bg-ash-800 rounded-xl border border-ash-700 p-4 hover:border-ash-500 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 flex flex-col gap-3"
				>
					<!-- Bot icon + name -->
					<div class="flex items-center gap-3">
						<div class="w-12 h-12 rounded-full bg-ash-600 flex items-center justify-center overflow-hidden flex-shrink-0">
							{#if bot.bot_icon}
								<img src={bot.bot_icon} alt={bot.name} class="w-full h-full object-cover" />
							{:else}
								<i class="fas fa-robot text-ash-300 text-lg"></i>
							{/if}
						</div>
						<div class="min-w-0">
							<p class="font-semibold text-ash-100 truncate text-sm sm:text-base">{bot.name || `Bot #${bot.id}`}</p>
							<span class="text-xs text-ash-400 capitalize">{bot.bot_type}</span>
						</div>
					</div>

					<!-- Status -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full {statusColor(bot.status)}"></span>
							<span class="text-xs text-ash-300 capitalize">{bot.status}</span>
						</div>
						{#if bot.status === 'running' && bot.uptime_ms}
							<span class="text-xs text-ash-500">{formatUptime(bot.uptime_ms)}</span>
						{/if}
					</div>

					{#if bot.bot_type === 'selfbot' && bot.connected_bot_name}
						<p class="text-xs text-ash-500 truncate">
							<i class="fas fa-link mr-1"></i>{bot.connected_bot_name}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
