<script lang="ts">
	import { onMount } from 'svelte';

	interface ChannelMetric {
		channel_id: number;
		channel_name: string;
		channel_type: string;
		messages_count: number;
		unique_authors: number;
		voice_sessions: number;
		voice_minutes: number;
		avg_health_score: number;
	}

	interface ChannelAnalytics {
		period: { days: number; start: string };
		channels: ChannelMetric[];
	}

	interface Props {
		serverId: number;
	}

	let { serverId }: Props = $props();

	let channelData = $state<ChannelAnalytics | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sortBy = $state<'health' | 'messages' | 'authors'>('health');
	let page = $state(1);
	const ITEMS_PER_PAGE = 20;

	onMount(async () => {
		try {
			const response = await fetch(`/api/servers/${serverId}/analytics?type=channels`);
			if (!response.ok) throw new Error('Failed to fetch channel analytics');
			channelData = await response.json();
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	function getHealthColor(score: number): string {
		if (score >= 70) return 'text-emerald-400';
		if (score >= 40) return 'text-amber-400';
		return 'text-red-400';
	}

	function getChannelIcon(type: string): string {
		if (type?.includes('voice')) return 'fa-microphone';
		if (type?.includes('stage')) return 'fa-microphone-lines';
		if (type?.includes('announcement')) return 'fa-bullhorn';
		return 'fa-hashtag';
	}

	function formatNumber(n: number): string {
		return n.toLocaleString();
	}

	function num(value: unknown): number {
		const parsed = Number(value ?? 0);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	const sortedCount = $derived(channelData?.channels?.length ?? 0);

	const sortedChannels = $derived.by(() => {
		const list = channelData?.channels;
		if (!list?.length) return [];
		const sorted = [...list];
		switch (sortBy) {
			case 'messages':
				sorted.sort((a, b) => num(b.messages_count) - num(a.messages_count));
				break;
			case 'authors':
				sorted.sort((a, b) => num(b.unique_authors) - num(a.unique_authors));
				break;
			case 'health':
			default:
				sorted.sort((a, b) => num(b.avg_health_score) - num(a.avg_health_score));
				break;
		}
		return sorted;
	});

	const tp = $derived(Math.max(1, Math.ceil(sortedChannels.length / ITEMS_PER_PAGE)));

	const paged = $derived(sortedChannels.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE));
</script>

<div class="flex flex-col gap-0">
	{#if loading}
		<div class="text-ash-400 py-10 text-center text-sm">
			<i class="fas fa-spinner fa-spin mr-2 text-cyan-400"></i>Loading channel metrics…
		</div>
	{:else if error}
		<div class="text-ash-400 border-ash-600 bg-ash-800/60 rounded-lg border px-4 py-3 text-sm">
			<p class="text-ash-200 font-medium">Could not load channels</p>
			<p class="text-ash-500 mt-1 text-xs">{error}</p>
		</div>
	{:else if channelData && channelData.channels.length > 0}
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-ash-500 text-xs">
				{sortedCount} channel{sortedCount !== 1 ? 's' : ''}
			</p>
			<div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:justify-end">
				<button
					type="button"
					onclick={() => {
						sortBy = 'health';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${sortBy === 'health' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					Health
				</button>
				<button
					type="button"
					onclick={() => {
						sortBy = 'messages';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${sortBy === 'messages' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					Messages
				</button>
				<button
					type="button"
					onclick={() => {
						sortBy = 'authors';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${sortBy === 'authors' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					Authors
				</button>
			</div>
		</div>

		{#if paged.length === 0}
			<div class="text-ash-400 py-10 text-center text-sm">No channels found</div>
		{:else}
			<div class="mb-4 space-y-3">
				{#each paged as channel, i (channel.channel_id ?? `ch-${i}`)}
					<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-5">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div class="flex min-w-0 flex-1 items-start gap-3">
								<div class="border-ash-600 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-ash-800">
									<i class={`fas ${getChannelIcon(channel.channel_type)} text-sm text-ash-300`}></i>
								</div>
								<div class="min-w-0 flex-1">
									<h4 class="text-ash-100 truncate text-base font-bold sm:text-lg">
										{channel.channel_name || 'Unnamed channel'}
									</h4>
									<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
										<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
												<i class="fas fa-comments text-xs text-emerald-400"></i>
											</div>
											<div class="min-w-0">
												<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Messages</div>
												<div class="text-ash-100 text-sm font-bold">{formatNumber(num(channel.messages_count))}</div>
											</div>
										</div>
										<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20">
												<i class="fas fa-user text-xs text-sky-400"></i>
											</div>
											<div class="min-w-0">
												<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Authors</div>
												<div class="text-ash-100 text-sm font-bold">{formatNumber(num(channel.unique_authors))}</div>
											</div>
										</div>
										<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20">
												<i class="fas fa-headphones text-xs text-violet-400"></i>
											</div>
											<div class="min-w-0">
												<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Voice sessions</div>
												<div class="text-ash-100 text-sm font-bold">{formatNumber(num(channel.voice_sessions))}</div>
											</div>
										</div>
										<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
											<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
												<i class="fas fa-microphone text-xs text-cyan-400"></i>
											</div>
											<div class="min-w-0">
												<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Voice min</div>
												<div class="text-ash-100 text-sm font-bold">{formatNumber(num(channel.voice_minutes))}</div>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="flex shrink-0 flex-col items-end gap-2 sm:pt-1">
								<div class={`text-2xl font-bold ${getHealthColor(num(channel.avg_health_score))}`}>
									{num(channel.avg_health_score).toFixed(1)}
								</div>
								<div class="bg-ash-800 h-2 w-28 max-w-full overflow-hidden rounded-full">
									<div
										class={`h-full transition-all ${num(channel.avg_health_score) >= 70 ? 'bg-emerald-500' : num(channel.avg_health_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
										style={`width: ${Math.min(100, num(channel.avg_health_score))}%`}
									></div>
								</div>
								<span class="text-ash-500 text-[0.65rem] uppercase tracking-wide">Health</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if tp > 1}
				<div class="flex items-center justify-between">
					<button
						type="button"
						onclick={() => (page = Math.max(1, page - 1))}
						disabled={page === 1}
						class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					>
						<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
					</button>
					<span class="text-ash-400 text-sm">Page {page} of {tp}</span>
					<button
						type="button"
						onclick={() => (page = Math.min(tp, page + 1))}
						disabled={page === tp}
						class="bg-ash-800 border-ash-700 hover:bg-ash-700 text-ash-200 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					>
						Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
					</button>
				</div>
			{/if}
		{/if}
	{:else}
		<div class="text-ash-400 py-10 text-center text-sm">No channel data available yet</div>
	{/if}
</div>
