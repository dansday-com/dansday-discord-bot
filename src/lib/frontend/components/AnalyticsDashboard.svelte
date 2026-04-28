<script lang="ts">
	import { onMount } from 'svelte';

	interface AnalyticsData {
		period: { start: string; end: string; days: number };
		activity: {
			total_messages: number;
			total_voice_minutes: number;
			avg_active_members: number;
			days_tracked: number;
		};
		engagement: {
			total_members: number;
			avg_engagement_score: number;
			highly_engaged: number;
			moderately_engaged: number;
			low_engaged: number;
		};
		retention: {
			avg_retention_rate: number;
			max_retention_rate: number;
			min_retention_rate: number;
		};
		channels: {
			total_channels: number;
			avg_health_score: number;
			healthy_channels: number;
			dead_channels: number;
		};
	}

	export let serverId: number;

	let analytics: AnalyticsData | null = null;
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const response = await fetch(`/api/servers/${serverId}/analytics?type=overview`);
			if (!response.ok) throw new Error('Failed to fetch analytics');
			analytics = await response.json();
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	function getEngagementColor(score: number): string {
		if (score >= 70) return 'text-emerald-400';
		if (score >= 40) return 'text-amber-400';
		return 'text-red-400';
	}

	function getHealthColor(score: number): string {
		if (score >= 70) return 'text-emerald-400';
		if (score >= 40) return 'text-amber-400';
		return 'text-red-400';
	}
</script>

<div class="space-y-6">
	{#if loading}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<div class="inline-block">
				<i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i>
			</div>
			<p class="text-ash-300 mt-3">Loading analytics...</p>
		</div>
	{:else if error}
		<div class="bg-ash-700 border-red-600/50 rounded-xl border p-6">
			<div class="flex items-center gap-3">
				<i class="fas fa-exclamation-circle text-lg text-red-400"></i>
				<div>
					<h3 class="text-ash-100 font-semibold">Error loading analytics</h3>
					<p class="text-ash-300 text-sm">{error}</p>
				</div>
			</div>
		</div>
	{:else if analytics}
		<!-- Activity Overview -->
		<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-4">
			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-3 flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
						<i class="fas fa-comments text-sm text-blue-400"></i>
					</div>
					<h3 class="text-ash-100 text-sm font-semibold">Messages (30d)</h3>
				</div>
				<div class="text-ash-100 text-2xl font-bold">{formatNumber(analytics.activity.total_messages)}</div>
				<p class="text-ash-400 text-xs mt-1">Total messages sent</p>
			</div>

			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-3 flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
						<i class="fas fa-microphone text-sm text-purple-400"></i>
					</div>
					<h3 class="text-ash-100 text-sm font-semibold">Voice Minutes (30d)</h3>
				</div>
				<div class="text-ash-100 text-2xl font-bold">{formatNumber(analytics.activity.total_voice_minutes)}</div>
				<p class="text-ash-400 text-xs mt-1">Total voice activity</p>
			</div>

			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-3 flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
						<i class="fas fa-users text-sm text-green-400"></i>
					</div>
					<h3 class="text-ash-100 text-sm font-semibold">Avg Active Members</h3>
				</div>
				<div class="text-ash-100 text-2xl font-bold">{formatNumber(analytics.activity.avg_active_members)}</div>
				<p class="text-ash-400 text-xs mt-1">Daily average</p>
			</div>

			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-3 flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
						<i class="fas fa-calendar text-sm text-amber-400"></i>
					</div>
					<h3 class="text-ash-100 text-sm font-semibold">Days Tracked</h3>
				</div>
				<div class="text-ash-100 text-2xl font-bold">{analytics.activity.days_tracked}</div>
				<p class="text-ash-400 text-xs mt-1">Data collection period</p>
			</div>
		</div>

		<!-- Engagement Metrics -->
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15">
					<i class="fas fa-chart-pie text-lg text-cyan-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Member Engagement</h3>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Total Members</p>
					<p class="text-ash-100 text-2xl font-bold mt-2">{formatNumber(analytics.engagement.total_members)}</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Avg Engagement Score</p>
					<p class={`text-2xl font-bold mt-2 ${getEngagementColor(analytics.engagement.avg_engagement_score)}`}>
						{analytics.engagement.avg_engagement_score}
					</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Highly Engaged</p>
					<p class="text-emerald-400 text-2xl font-bold mt-2">{formatNumber(analytics.engagement.highly_engaged)}</p>
					<p class="text-ash-400 text-xs mt-1">Score ≥ 70</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Moderately Engaged</p>
					<p class="text-amber-400 text-2xl font-bold mt-2">{formatNumber(analytics.engagement.moderately_engaged)}</p>
					<p class="text-ash-400 text-xs mt-1">Score 40-70</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Low Engagement</p>
					<p class="text-red-400 text-2xl font-bold mt-2">{formatNumber(analytics.engagement.low_engaged)}</p>
					<p class="text-ash-400 text-xs mt-1">Score &lt; 40</p>
				</div>
			</div>
		</div>

		<!-- Retention Metrics -->
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15">
					<i class="fas fa-arrow-trend-up text-lg text-indigo-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Retention Metrics</h3>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Average Retention Rate</p>
					<p class="text-emerald-400 text-2xl font-bold mt-2">{analytics.retention.avg_retention_rate}%</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Peak Retention</p>
					<p class="text-blue-400 text-2xl font-bold mt-2">{analytics.retention.max_retention_rate}%</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Lowest Retention</p>
					<p class="text-orange-400 text-2xl font-bold mt-2">{analytics.retention.min_retention_rate}%</p>
				</div>
			</div>
		</div>

		<!-- Channel Health -->
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15">
					<i class="fas fa-heartbeat text-lg text-rose-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Channel Health</h3>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Total Channels</p>
					<p class="text-ash-100 text-2xl font-bold mt-2">{formatNumber(analytics.channels.total_channels)}</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Avg Health Score</p>
					<p class={`text-2xl font-bold mt-2 ${getHealthColor(analytics.channels.avg_health_score)}`}>
						{analytics.channels.avg_health_score}
					</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Healthy Channels</p>
					<p class="text-emerald-400 text-2xl font-bold mt-2">{formatNumber(analytics.channels.healthy_channels)}</p>
					<p class="text-ash-400 text-xs mt-1">Score ≥ 70</p>
				</div>
				<div class="bg-ash-800/50 rounded-lg p-4">
					<p class="text-ash-400 text-xs font-medium">Dead Channels</p>
					<p class="text-red-400 text-2xl font-bold mt-2">{formatNumber(analytics.channels.dead_channels)}</p>
					<p class="text-ash-400 text-xs mt-1">Score &lt; 30</p>
				</div>
			</div>
		</div>
	{/if}
</div>
