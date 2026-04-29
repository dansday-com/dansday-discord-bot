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

	export let serverId: number;

	let channelData: ChannelAnalytics | null = null;
	let loading = true;
	let error: string | null = null;
	let sortBy: 'health' | 'messages' | 'authors' = 'health';

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

	function getHealthBg(score: number): string {
		if (score >= 70) return 'bg-emerald-500/10';
		if (score >= 40) return 'bg-amber-500/10';
		return 'bg-red-500/10';
	}

	function getChannelIcon(type: string): string {
		if (type?.includes('voice')) return 'fa-microphone';
		if (type?.includes('stage')) return 'fa-microphone-lines';
		if (type?.includes('announcement')) return 'fa-bullhorn';
		return 'fa-hashtag';
	}

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	function num(value: unknown): number {
		const parsed = Number(value ?? 0);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function getSortedChannels(): ChannelMetric[] {
		if (!channelData?.channels) return [];
		const sorted = [...channelData.channels];
		switch (sortBy) {
			case 'messages':
				return sorted.sort((a, b) => num(b.messages_count) - num(a.messages_count));
			case 'authors':
				return sorted.sort((a, b) => num(b.unique_authors) - num(a.unique_authors));
			case 'health':
			default:
				return sorted.sort((a, b) => num(b.avg_health_score) - num(a.avg_health_score));
		}
	}
</script>

<div class="space-y-4">
	{#if loading}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i>
			<p class="text-ash-300 mt-3">Loading channel metrics...</p>
		</div>
	{:else if error}
		<div class="bg-ash-700 border-red-600/50 rounded-xl border p-6">
			<div class="flex items-center gap-3">
				<i class="fas fa-exclamation-circle text-lg text-red-400"></i>
				<div>
					<h3 class="text-ash-100 font-semibold">Error loading channels</h3>
					<p class="text-ash-300 text-sm">{error}</p>
				</div>
			</div>
		</div>
	{:else if channelData && channelData.channels.length > 0}
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15">
						<i class="fas fa-heartbeat text-lg text-rose-400"></i>
					</div>
					<h3 class="text-ash-100 text-base font-bold">Channel Health Metrics</h3>
				</div>
				<div class="grid grid-cols-3 gap-2 sm:flex">
					<button
						on:click={() => (sortBy = 'health')}
						class={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${sortBy === 'health' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						Health
					</button>
					<button
						on:click={() => (sortBy = 'messages')}
						class={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${sortBy === 'messages' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						Messages
					</button>
					<button
						on:click={() => (sortBy = 'authors')}
						class={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${sortBy === 'authors' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						Authors
					</button>
				</div>
			</div>

			<div class="space-y-2 max-h-96 overflow-y-auto">
				{#each getSortedChannels() as channel}
					<div class={`bg-ash-800/50 rounded-lg p-3 border border-ash-700/50 hover:border-ash-600 transition-all ${getHealthBg(num(channel.avg_health_score))}`}>
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-start gap-3 flex-1 min-w-0">
								<div class="flex h-8 w-8 items-center justify-center rounded bg-ash-700 flex-shrink-0">
									<i class={`fas ${getChannelIcon(channel.channel_type)} text-xs text-ash-400`}></i>
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 font-medium truncate">{channel.channel_name}</p>
									<div class="flex flex-wrap gap-2 mt-1">
										<span class="text-ash-400 text-xs bg-ash-700/50 px-2 py-0.5 rounded">
											<i class="fas fa-comments text-xs mr-1"></i>{formatNumber(num(channel.messages_count))} msgs
										</span>
										<span class="text-ash-400 text-xs bg-ash-700/50 px-2 py-0.5 rounded">
											<i class="fas fa-user text-xs mr-1"></i>{formatNumber(num(channel.unique_authors))} authors
										</span>
										{#if num(channel.voice_sessions)}
											<span class="text-ash-400 text-xs bg-ash-700/50 px-2 py-0.5 rounded">
												<i class="fas fa-microphone text-xs mr-1"></i>{formatNumber(num(channel.voice_minutes))} min
											</span>
										{/if}
									</div>
								</div>
							</div>
							<div class="flex flex-col items-end gap-1 flex-shrink-0">
								<div class={`text-lg font-bold ${getHealthColor(num(channel.avg_health_score))}`}>
									{num(channel.avg_health_score).toFixed(1)}
								</div>
								<div class="w-16 h-1.5 bg-ash-700 rounded-full overflow-hidden">
									<div
										class={`h-full transition-all ${num(channel.avg_health_score) >= 70 ? 'bg-emerald-500' : num(channel.avg_health_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
										style={`width: ${Math.min(100, num(channel.avg_health_score))}%`}
									></div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<i class="fas fa-chart-bar text-2xl text-ash-500"></i>
			<p class="text-ash-300 mt-3">No channel data available yet</p>
		</div>
	{/if}
</div>
