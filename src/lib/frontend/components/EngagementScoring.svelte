<script lang="ts">
	import { onMount } from 'svelte';

	interface MemberEngagement {
		member_id: number;
		username: string;
		display_name: string;
		avatar: string;
		engagement_score: number;
		last_activity_at: string;
		messages_30d: number;
		voice_minutes_30d: number;
		days_active_30d: number;
		streak_days: number;
	}

	interface EngagementData {
		total_members: number;
		top_engaged: MemberEngagement[];
		low_engaged: MemberEngagement[];
		all_members: MemberEngagement[];
	}

	export let serverId: number;

	let engagementData: EngagementData | null = null;
	let loading = true;
	let error: string | null = null;
	let view: 'top' | 'low' | 'all' = 'top';

	onMount(async () => {
		try {
			const response = await fetch(`/api/servers/${serverId}/analytics?type=engagement`);
			if (!response.ok) throw new Error('Failed to fetch engagement metrics');
			engagementData = await response.json();
		} catch (err: any) {
			error = err.message;
		} finally {
			loading = false;
		}
	});

	function getEngagementColor(score: number): string {
		if (score >= 70) return 'text-emerald-400';
		if (score >= 40) return 'text-amber-400';
		return 'text-red-400';
	}

	function getEngagementBg(score: number): string {
		if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
		if (score >= 40) return 'bg-amber-500/10 border-amber-500/30';
		return 'bg-red-500/10 border-red-500/30';
	}

	function getDisplayName(member: MemberEngagement): string {
		return member.display_name || member.username || 'Unknown';
	}

	function formatNumber(num: number): string {
		return num.toLocaleString();
	}

	function num(value: unknown): number {
		const parsed = Number(value ?? 0);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function getViewData(): MemberEngagement[] {
		if (!engagementData) return [];
		switch (view) {
			case 'low':
				return engagementData.low_engaged;
			case 'all':
				return engagementData.all_members.slice(0, 50);
			case 'top':
			default:
				return engagementData.top_engaged;
		}
	}
</script>

<div class="space-y-4">
	{#if loading}
		<div class="bg-ash-700 border-ash-600 rounded-xl border p-8 text-center">
			<i class="fas fa-spinner fa-spin text-2xl text-blue-400"></i>
			<p class="text-ash-300 mt-3">Loading engagement metrics...</p>
		</div>
	{:else if error}
		<div class="bg-ash-700 border-red-600/50 rounded-xl border p-6">
			<div class="flex items-center gap-3">
				<i class="fas fa-exclamation-circle text-lg text-red-400"></i>
				<div>
					<h3 class="text-ash-100 font-semibold">Error loading engagement</h3>
					<p class="text-ash-300 text-sm">{error}</p>
				</div>
			</div>
		</div>
	{:else if engagementData}
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
						<i class="fas fa-star text-lg text-purple-400"></i>
					</div>
					<div>
						<h3 class="text-ash-100 text-base font-bold">Member Engagement Scoring</h3>
						<p class="text-ash-400 text-xs mt-0.5">{formatNumber(engagementData.total_members)} members tracked</p>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-2 sm:flex">
					<button
						on:click={() => (view = 'top')}
						class={`rounded px-2 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${view === 'top' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						<i class="fas fa-arrow-up text-[10px] mr-1"></i>Top
					</button>
					<button
						on:click={() => (view = 'low')}
						class={`rounded px-2 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${view === 'low' ? 'bg-red-500/20 text-red-300 border border-red-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						<i class="fas fa-arrow-down text-[10px] mr-1"></i>Low
					</button>
					<button
						on:click={() => (view = 'all')}
						class={`rounded px-2 py-1.5 text-[11px] font-medium transition-all sm:px-3 sm:text-xs ${view === 'all' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' : 'bg-ash-800 text-ash-300 hover:bg-ash-700'}`}
					>
						<i class="fas fa-list text-[10px] mr-1"></i>All
					</button>
				</div>
			</div>

			<div class="space-y-2 max-h-96 overflow-y-auto">
				{#each getViewData() as member, idx}
					<div class={`rounded-lg p-3 border transition-all ${getEngagementBg(num(member.engagement_score))}`}>
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-3 flex-1 min-w-0">
								<div class="flex-shrink-0">
									{#if member.avatar}
										<img src={member.avatar} alt={getDisplayName(member)} class="w-8 h-8 rounded-full" />
									{:else}
										<div class="w-8 h-8 rounded-full bg-ash-600 flex items-center justify-center">
											<i class="fas fa-user text-xs text-ash-400"></i>
										</div>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 font-medium truncate">{getDisplayName(member)}</p>
									<div class="flex flex-wrap gap-1 mt-1">
										<span class="text-ash-400 text-xs bg-ash-700/50 px-1.5 py-0.5 rounded">
											<i class="fas fa-comments text-xs mr-0.5"></i>{formatNumber(num(member.messages_30d))}
										</span>
										<span class="text-ash-400 text-xs bg-ash-700/50 px-1.5 py-0.5 rounded">
											<i class="fas fa-microphone text-xs mr-0.5"></i>{formatNumber(num(member.voice_minutes_30d))}m
										</span>
										<span class="text-ash-400 text-xs bg-ash-700/50 px-1.5 py-0.5 rounded">
											<i class="fas fa-calendar text-xs mr-0.5"></i>{num(member.days_active_30d)}d
										</span>
										{#if num(member.streak_days) > 0}
											<span class="text-amber-400 text-xs bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
												<i class="fas fa-fire text-xs mr-0.5"></i>{num(member.streak_days)} streak
											</span>
										{/if}
									</div>
								</div>
							</div>
							<div class="flex flex-col items-end gap-1 flex-shrink-0">
								<div class={`text-lg font-bold ${getEngagementColor(num(member.engagement_score))}`}>
									{num(member.engagement_score).toFixed(1)}
								</div>
								<div class="w-12 h-1.5 bg-ash-700 rounded-full overflow-hidden">
									<div
										class={`h-full transition-all ${num(member.engagement_score) >= 70 ? 'bg-emerald-500' : num(member.engagement_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
										style={`width: ${Math.min(100, num(member.engagement_score))}%`}
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
			<i class="fas fa-chart-line text-2xl text-ash-500"></i>
			<p class="text-ash-300 mt-3">No engagement data available yet</p>
		</div>
	{/if}
</div>
