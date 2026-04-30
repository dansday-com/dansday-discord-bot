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
	let page = 1;
	const ITEMS_PER_PAGE = 20;

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

	function getDisplayName(member: MemberEngagement): string {
		return member.display_name || member.username || 'Unknown';
	}

	function formatNumber(n: number): string {
		return n.toLocaleString();
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
				return engagementData.all_members;
			case 'top':
			default:
				return engagementData.top_engaged;
		}
	}

	function totalPages(): number {
		const total = getViewData().length;
		return Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
	}

	function getPagedData(): MemberEngagement[] {
		const data = getViewData();
		const start = (page - 1) * ITEMS_PER_PAGE;
		return data.slice(start, start + ITEMS_PER_PAGE);
	}

	function avatarSrc(member: MemberEngagement): string {
		return (
			member.avatar ||
			`https://cdn.discordapp.com/embed/avatars/${Number(member.member_id) % 5 || 0}.png`
		);
	}

	$: viewCount = getViewData().length;
	$: tp = totalPages();
	$: paged = getPagedData();
</script>

<div class="flex flex-col gap-0">
	{#if loading}
		<div class="text-ash-400 py-10 text-center text-sm">
			<i class="fas fa-spinner fa-spin mr-2 text-cyan-400"></i>Loading engagement metrics…
		</div>
	{:else if error}
		<div class="text-ash-400 border-ash-600 bg-ash-800/60 rounded-lg border px-4 py-3 text-sm">
			<p class="text-ash-200 font-medium">Could not load engagement</p>
			<p class="text-ash-500 mt-1 text-xs">{error}</p>
		</div>
	{:else if engagementData}
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15">
					<i class="fas fa-star text-lg text-purple-400"></i>
				</div>
				<div>
					<h3 class="text-ash-100 text-base font-bold">Member engagement</h3>
					<p class="text-ash-400 mt-0.5 text-xs">
						{formatNumber(engagementData.total_members)} members tracked
					</p>
				</div>
			</div>
			<div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:justify-end">
				<button
					type="button"
					onclick={() => {
						view = 'top';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${view === 'top' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					Top
				</button>
				<button
					type="button"
					onclick={() => {
						view = 'low';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${view === 'low' ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					Low
				</button>
				<button
					type="button"
					onclick={() => {
						view = 'all';
						page = 1;
					}}
					class={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${view === 'all' ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/50' : 'bg-ash-800 border-ash-700 text-ash-300 hover:bg-ash-700 border'}`}
				>
					All
				</button>
			</div>
		</div>

		<p class="text-ash-500 mb-3 text-xs">
			{viewCount} member{viewCount !== 1 ? 's' : ''} in this view
		</p>

		{#if paged.length === 0}
			<div class="text-ash-400 py-10 text-center text-sm">No members in this view</div>
		{:else}
			<div class="mb-4 space-y-3">
				{#each paged as member (member.member_id)}
					<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-5">
						<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
							<div class="relative shrink-0">
								<img
									src={avatarSrc(member)}
									alt={getDisplayName(member)}
									class="border-ash-600 h-16 w-16 rounded-full border-2 object-cover sm:h-20 sm:w-20"
									onerror={(e) =>
										((e.currentTarget as HTMLImageElement).src =
											'https://cdn.discordapp.com/embed/avatars/0.png')}
								/>
							</div>

							<div class="w-full min-w-0 flex-1 text-center sm:text-left">
								<div class="mb-3 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
									<h4 class="text-ash-100 w-full truncate text-base font-bold sm:w-auto sm:text-lg">
										{getDisplayName(member)}
									</h4>
								</div>

								<div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
									<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
											<i class="fas fa-comments text-xs text-emerald-400"></i>
										</div>
										<div class="min-w-0">
											<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Messages (30d)</div>
											<div class="text-ash-100 text-sm font-bold">{formatNumber(num(member.messages_30d))}</div>
										</div>
									</div>
									<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
											<i class="fas fa-microphone text-xs text-cyan-400"></i>
										</div>
										<div class="min-w-0">
											<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Voice (30d)</div>
											<div class="text-ash-100 text-sm font-bold">{formatNumber(num(member.voice_minutes_30d))}m</div>
										</div>
									</div>
									<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
											<i class="fas fa-calendar text-xs text-indigo-400"></i>
										</div>
										<div class="min-w-0">
											<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Days active</div>
											<div class="text-ash-100 text-sm font-bold">{num(member.days_active_30d)}</div>
										</div>
									</div>
									<div class="bg-ash-800 border-ash-600 flex items-center gap-2 rounded-lg border p-2">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
											<i class="fas fa-fire text-xs text-amber-400"></i>
										</div>
										<div class="min-w-0">
											<div class="text-ash-400 text-[0.6rem] uppercase tracking-wide">Streak</div>
											<div class="text-ash-100 text-sm font-bold">{num(member.streak_days)}</div>
										</div>
									</div>
								</div>
							</div>

							<div class="flex shrink-0 flex-col items-center gap-2 sm:items-end sm:pt-1">
								<div class={`text-2xl font-bold ${getEngagementColor(num(member.engagement_score))}`}>
									{num(member.engagement_score).toFixed(1)}
								</div>
								<div class="bg-ash-800 h-2 w-28 max-w-full overflow-hidden rounded-full">
									<div
										class={`h-full transition-all ${num(member.engagement_score) >= 70 ? 'bg-emerald-500' : num(member.engagement_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
										style={`width: ${Math.min(100, num(member.engagement_score))}%`}
									></div>
								</div>
								<span class="text-ash-500 text-[0.65rem] uppercase tracking-wide">Score</span>
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
		<div class="text-ash-400 py-10 text-center text-sm">No engagement data available yet</div>
	{/if}
</div>
