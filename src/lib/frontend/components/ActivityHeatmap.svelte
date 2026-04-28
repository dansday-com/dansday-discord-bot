<script lang="ts">
	import { onMount } from 'svelte';

	interface HourlyData {
		date_hour: string;
		messages_count: number;
		voice_sessions: number;
		voice_minutes: number;
		active_members: number;
	}

	interface HeatmapData {
		period: { hours: number; start: string };
		data: HourlyData[];
	}

	export let serverId: number;

	let heatmapData: HeatmapData | null = null;
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const response = await fetch(`/api/servers/${serverId}/analytics?type=hourly`);
			if (!response.ok) throw new Error('Failed to fetch hourly analytics');
			heatmapData = await response.json();
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	function getHeatmapColor(value: number, max: number): string {
		const ratio = value / max;
		if (ratio === 0) return 'bg-ash-800';
		if (ratio < 0.2) return 'bg-blue-900/30';
		if (ratio < 0.4) return 'bg-blue-800/50';
		if (ratio < 0.6) return 'bg-blue-700/70';
		if (ratio < 0.8) return 'bg-blue-600/90';
		return 'bg-blue-500';
	}

	function formatHour(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
		} catch {
			return dateStr;
		}
	}

	function getMaxValue(data: HourlyData[]): number {
		return Math.max(...data.map((d) => d.messages_count), 1);
	}
</script>

<div class="space-y-4">
	{#if loading}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i>
			<p class="text-ash-300 mt-3">Loading activity heatmap...</p>
		</div>
	{:else if error}
		<div class="bg-ash-700 border-red-600/50 rounded-xl border p-6">
			<div class="flex items-center gap-3">
				<i class="fas fa-exclamation-circle text-lg text-red-400"></i>
				<div>
					<h3 class="text-ash-100 font-semibold">Error loading heatmap</h3>
					<p class="text-ash-300 text-sm">{error}</p>
				</div>
			</div>
		</div>
	{:else if heatmapData && heatmapData.data.length > 0}
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
					<i class="fas fa-fire text-lg text-blue-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Activity Heatmap (Last 24 Hours)</h3>
			</div>

			<div class="overflow-x-auto">
				<div class="flex gap-1 pb-4">
					{#each heatmapData.data as hour}
						<div class="flex flex-col items-center gap-2">
							<div
								class={`w-8 h-8 rounded transition-all hover:scale-110 cursor-pointer ${getHeatmapColor(hour.messages_count, getMaxValue(heatmapData.data))}`}
								title={`${formatHour(hour.date_hour)}: ${hour.messages_count} messages, ${hour.active_members} active members`}
							></div>
							<span class="text-ash-400 text-xs whitespace-nowrap">{formatHour(hour.date_hour)}</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="mt-4 pt-4 border-t border-ash-600">
				<p class="text-ash-400 text-xs mb-2">Color intensity represents message activity</p>
				<div class="flex items-center gap-2">
					<span class="text-ash-400 text-xs">Low</span>
					<div class="flex gap-1">
						<div class="w-4 h-4 rounded bg-ash-800"></div>
						<div class="w-4 h-4 rounded bg-blue-900/30"></div>
						<div class="w-4 h-4 rounded bg-blue-800/50"></div>
						<div class="w-4 h-4 rounded bg-blue-700/70"></div>
						<div class="w-4 h-4 rounded bg-blue-600/90"></div>
						<div class="w-4 h-4 rounded bg-blue-500"></div>
					</div>
					<span class="text-ash-400 text-xs">High</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<i class="fas fa-chart-line text-2xl text-ash-500"></i>
			<p class="text-ash-300 mt-3">No hourly data available yet</p>
		</div>
	{/if}
</div>
