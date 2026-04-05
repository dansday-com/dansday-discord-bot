<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 9;
	let page = $state(1);

	const totalPages = $derived(Math.ceil(data.servers.length / SERVERS_PER_PAGE));
	const pagedServers = $derived(data.servers.slice((page - 1) * SERVERS_PER_PAGE, page * SERVERS_PER_PAGE));

	const canControlSelfbot = $derived(
		data.user.authenticated &&
			(data.user.account_source === 'accounts' || (data.user.account_source === 'server_accounts' && data.user.account_type === 'owner'))
	);

	let liveOverride: { status: string; process_id: number | null } | null = $state(null);
	const liveBot = $derived(liveOverride ?? { status: data.bot.status, process_id: data.bot.process_id ?? null });

	let uptimeBase = $state(0);
	let uptimeTick = $state(0);
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let es: EventSource | null = null;

	const displayUptime = $derived(liveBot.status === 'running' ? uptimeBase + uptimeTick : 0);

	function startTick() {
		if (tickInterval) return;
		const base = Date.now();
		tickInterval = setInterval(() => {
			uptimeTick = Date.now() - base;
		}, 1000);
	}

	function stopTick() {
		if (tickInterval) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
		uptimeTick = 0;
	}

	function statusColor(status: string) {
		if (status === 'running') return 'bg-green-500';
		if (status === 'starting' || status === 'stopping') return 'bg-yellow-500';
		return 'bg-ash-500';
	}

	function statusTextColor(status: string) {
		if (status === 'running') return 'text-green-400';
		if (status === 'starting' || status === 'stopping') return 'text-yellow-400';
		return 'text-ash-400';
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

	onMount(() => {
		liveOverride = { status: data.bot.status, process_id: data.bot.process_id ?? null };
		if (data.bot.status === 'running') {
			uptimeBase = data.bot.uptime_ms ?? 0;
			startTick();
		}

		const myEs = new EventSource(`/api/bots/${data.bot.id}/stream?kind=selfbot`);
		es = myEs;
		myEs.onmessage = (e) => {
			if (es !== myEs) return;
			const d = JSON.parse(e.data);
			liveOverride = {
				status: d.status ?? 'stopped',
				process_id: d.process_id ?? null
			};
			if (d.status === 'running') {
				uptimeBase = d.uptime_ms ?? 0;
				uptimeTick = 0;
				startTick();
			} else {
				uptimeBase = 0;
				stopTick();
			}
		};
	});

	onDestroy(() => {
		es?.close();
		stopTick();
	});

	async function botAction(action: 'start' | 'stop' | 'restart') {
		const res = await fetch(`/api/${action}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ bot_id: data.bot.id })
		});
		const d = await res.json();
		if (d.success || res.ok) {
			showToast(`Bot ${action} initiated`, 'success');
			invalidateAll();
		} else {
			showToast(d.error || `Failed to ${action}`, 'error');
		}
	}

	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	async function deleteSelfbot() {
		deleting = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/selfbot`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ selfbot_id: data.bot.id })
			});
			const d = await res.json();
			if (d.success) {
				showToast('Selfbot deleted', 'success');
				goto(`/bots/${data.botId}/servers/${data.serverId}/selfbot`);
			} else {
				showToast(d.error || 'Failed to delete', 'error');
			}
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}

	const isRunning = $derived(liveBot.status === 'running');
	const isBusy = $derived(liveBot.status === 'starting' || liveBot.status === 'stopping');
	const canStart = $derived(!isRunning && !isBusy);
	const canStop = $derived(isRunning || isBusy);
</script>

<svelte:head>
	<title>{data.bot.name || `Selfbot #${data.bot.id}`} | Dansday Discord Bot</title>
</svelte:head>

<div class="space-y-4">
	<a
		href={`/bots/${data.botId}/servers/${data.serverId}/selfbot`}
		class="text-ash-400 hover:text-ash-100 mb-6 inline-flex items-center gap-2 text-sm transition-colors"
	>
		<i class="fas fa-arrow-left text-violet-300"></i>Back to Selfbots
	</a>

	{#if data.selfbotViewOnly}
		<div class="mb-4 flex items-start gap-2 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-100/95" role="status">
			<i class="fas fa-eye mt-0.5 shrink-0 text-amber-400" aria-hidden="true"></i>
			<span><strong class="text-amber-50">View only.</strong> Status and uptime update live; start, stop, restart, and delete are owner-only.</span>
		</div>
	{/if}

	<div class="bg-ash-800 border-ash-700 mb-4 rounded-xl border p-4 sm:mb-6 sm:p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<div class="flex min-w-0 flex-1 items-center gap-4">
				<div class="bg-ash-600 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-20 sm:w-20">
					{#if data.bot.bot_icon}
						<img src={data.bot.bot_icon} alt={data.bot.name || 'Selfbot'} class="h-full w-full object-cover" />
					{:else}
						<i class="fas fa-robot text-2xl text-violet-300 sm:text-3xl"></i>
					{/if}
				</div>
				<div class="min-w-0">
					<h2 class="text-ash-100 truncate text-xl font-bold sm:text-2xl">
						{data.bot.name || `Selfbot #${data.bot.id}`}
					</h2>
				</div>
			</div>

			{#if canControlSelfbot}
				<div class="flex shrink-0 flex-wrap items-center gap-2">
					{#if canStart}
						<button
							onclick={() => botAction('start')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-green-700 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-play text-sm text-green-200 sm:text-base"></i>
							<span class="hidden sm:inline">Start</span>
						</button>
					{/if}
					{#if canStop}
						<button
							onclick={() => botAction('stop')}
							class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all hover:scale-105 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-stop text-sm text-rose-200 sm:text-base"></i>
							<span class="hidden sm:inline">Stop</span>
						</button>
						<button
							onclick={() => botAction('restart')}
							class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-yellow-600 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-yellow-700 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
						>
							<i class="fas fa-redo text-sm text-yellow-200 sm:text-base"></i>
							<span class="hidden sm:inline">Restart</span>
						</button>
					{/if}
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="text-ash-100 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-medium transition-all hover:scale-105 hover:bg-red-800 active:scale-95 sm:h-10 sm:px-4 sm:text-sm"
					>
						<i class="fas fa-trash text-sm text-red-300 sm:text-base"></i>
						<span class="hidden sm:inline">Delete</span>
					</button>
				</div>
			{/if}
		</div>

		<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div class="bg-ash-700 rounded-lg p-3">
				<p class="text-ash-400 mb-1 text-xs">Status</p>
				<div class="flex items-center gap-2">
					<span class="h-2 w-2 rounded-full {statusColor(liveBot.status)}"></span>
					<span class="text-sm font-medium capitalize {statusTextColor(liveBot.status)}">{liveBot.status}</span>
				</div>
			</div>

			{#if isRunning}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-ash-400 mb-1 text-xs">Uptime</p>
					<p class="text-ash-100 text-sm font-medium">{formatUptime(displayUptime)}</p>
				</div>
			{/if}

			{#if liveBot.process_id}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-ash-400 mb-1 text-xs">Process ID</p>
					<p class="text-ash-100 text-sm font-medium">{liveBot.process_id}</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-ash-100 text-lg font-semibold">
				<i class="fas fa-server mr-2 text-violet-400"></i>Servers
			</h3>
			<span class="text-ash-400 text-xs sm:text-sm">
				{data.servers.length} server{data.servers.length !== 1 ? 's' : ''}
			</span>
		</div>

		{#if data.servers.length === 0}
			<div class="py-8 text-center">
				<i class="fas fa-server mb-3 text-3xl text-violet-300"></i>
				<p class="text-ash-400 text-sm">No servers yet</p>
			</div>
		{:else}
			<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each pagedServers as server (server.id)}
					<div class="bg-ash-700 border-ash-600 cursor-default rounded-lg border p-4" role="presentation">
						<div class="mb-3 flex items-center gap-3">
							<div class="bg-ash-600 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
								{#if server.server_icon}
									<img src={server.server_icon} alt={server.name || ''} class="h-full w-full object-cover" />
								{:else}
									<i class="fas fa-server text-lg text-violet-300"></i>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<h4 class="text-ash-100 truncate text-sm font-semibold sm:text-base" title={server.name || ''}>
									{server.name || 'Unnamed Server'}
								</h4>
							</div>
						</div>
						<div class="space-y-2 text-xs sm:text-sm">
							<div class="flex items-center justify-between">
								<span class="text-ash-400 flex items-center gap-1.5"><i class="fas fa-users w-4 text-blue-400"></i>Members</span>
								<span class="text-ash-100 font-medium">{(server.total_members ?? 0).toLocaleString()}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-ash-400 flex items-center gap-1.5"><i class="fas fa-star w-4 text-amber-400"></i>Boost Level</span>
								<span class="text-ash-100 font-medium">{server.boost_level ?? 0}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-ash-400 flex items-center gap-1.5"><i class="fas fa-gift w-4 text-emerald-400"></i>Total Boosters</span>
								<span class="text-ash-100 font-medium">{(server.total_boosters ?? 0).toLocaleString()}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-ash-400 flex items-center gap-1.5"><i class="fas fa-hashtag w-4 text-violet-400"></i>Channels</span>
								<span class="text-ash-100 font-medium">{(server.total_channels ?? 0).toLocaleString()}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="flex items-center justify-between">
					<button
						onclick={() => (page = Math.max(1, page - 1))}
						disabled={page === 1}
						class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					>
						<i class="fas fa-chevron-left text-xs text-violet-300"></i>Previous
					</button>
					<span class="text-ash-400 text-sm">Page {page} of {totalPages}</span>
					<button
						onclick={() => (page = Math.min(totalPages, page + 1))}
						disabled={page === totalPages}
						class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
					>
						Next<i class="fas fa-chevron-right text-xs text-violet-300"></i>
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<ConfirmModal
	open={showDeleteConfirm}
	title="Delete Selfbot"
	message="Delete &quot;{data.bot.name || `Selfbot #${data.bot.id}`}&quot;? This cannot be undone."
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={deleteSelfbot}
	oncancel={() => (showDeleteConfirm = false)}
/>
