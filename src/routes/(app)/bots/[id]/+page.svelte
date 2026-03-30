<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 9;
	let page = $state(1);

	const totalPages = $derived(Math.ceil(data.servers.length / SERVERS_PER_PAGE));
	const pagedServers = $derived(
		data.servers.slice((page - 1) * SERVERS_PER_PAGE, page * SERVERS_PER_PAGE)
	);

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
			showToast(d.error || `Failed to ${action} bot`, 'error');
		}
	}

	async function toggleMode() {
		const res = await fetch(`/api/bots/${data.bot.id}/mode`, {
			method: 'PUT',
			credentials: 'include'
		});
		const d = await res.json();
		if (d.success) {
			showToast(`Switched to ${data.bot.is_testing ? 'production' : 'testing'} mode`, 'success');
			invalidateAll();
		} else {
			showToast(d.error || 'Failed to switch mode', 'error');
		}
	}

	async function deleteBot() {
		if (!confirm(`Delete "${data.bot.name || `Bot #${data.bot.id}`}"? This cannot be undone.`)) return;
		const res = await fetch(`/api/bots/${data.bot.id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		const d = await res.json();
		if (d.success) {
			showToast('Bot deleted', 'success');
			goto('/');
		} else {
			showToast(d.error || 'Failed to delete bot', 'error');
		}
	}

	const isRunning = $derived(data.bot.status === 'running');
	const isBusy = $derived(data.bot.status === 'starting' || data.bot.status === 'stopping');
	const canStart = $derived(!isRunning && !isBusy);
	const canStop = $derived(isRunning || isBusy);
	const isAdmin = $derived(data.user.account_type === 'admin');
</script>

<svelte:head>
	<title>{data.bot.name || `Bot #${data.bot.id}`} | Dansday</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
	<!-- Back -->
	<a href="/" class="inline-flex items-center gap-2 text-ash-400 hover:text-ash-100 transition-colors text-sm mb-6">
		<i class="fas fa-arrow-left"></i>Back to Dashboard
	</a>

	<!-- Bot Header -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-6 mb-4 sm:mb-6">
		<div class="flex flex-col sm:flex-row sm:items-start gap-4">
			<!-- Icon + Name -->
			<div class="flex items-center gap-4 flex-1 min-w-0">
				<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ash-600 flex items-center justify-center overflow-hidden flex-shrink-0">
					{#if data.bot.bot_icon}
						<img src={data.bot.bot_icon} alt={data.bot.name} class="w-full h-full object-cover" />
					{:else}
						<i class="fas fa-robot text-ash-300 text-2xl sm:text-3xl"></i>
					{/if}
				</div>
				<div class="min-w-0">
					<h2 class="text-xl sm:text-2xl font-bold text-ash-100 truncate">
						{data.bot.name || `Bot #${data.bot.id}`}
					</h2>
					<div class="flex items-center gap-2 mt-1 flex-wrap">
						<span class="text-xs px-2 py-0.5 rounded-full bg-ash-700 text-ash-300 capitalize">
							{data.bot.bot_type}
						</span>
						{#if data.bot.bot_type === 'official'}
							<span class="text-xs px-2 py-0.5 rounded-full {data.bot.is_testing ? 'bg-yellow-900 text-yellow-300' : 'bg-ash-600 text-ash-200'}">
								{data.bot.is_testing ? 'Testing' : 'Production'}
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Admin Actions -->
			{#if isAdmin}
				<div class="flex items-center gap-2 flex-wrap flex-shrink-0">
					{#if canStart}
						<button
							onclick={() => botAction('start')}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-800 hover:bg-green-700 text-green-200 text-sm transition-colors"
						>
							<i class="fas fa-play text-xs"></i>Start
						</button>
					{/if}
					{#if canStop}
						<button
							onclick={() => botAction('stop')}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ash-700 hover:bg-ash-600 text-ash-200 text-sm transition-colors"
						>
							<i class="fas fa-stop text-xs"></i>Stop
						</button>
						<button
							onclick={() => botAction('restart')}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-200 text-sm transition-colors"
						>
							<i class="fas fa-rotate-right text-xs"></i>Restart
						</button>
					{/if}
					{#if data.bot.bot_type === 'official'}
						<button
							onclick={toggleMode}
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ash-700 hover:bg-ash-600 text-ash-200 text-sm transition-colors"
						>
							<i class="fas fa-toggle-{data.bot.is_testing ? 'on' : 'off'} text-xs"></i>
							{data.bot.is_testing ? 'Testing' : 'Production'}
						</button>
					{/if}
					<button
						onclick={deleteBot}
						class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 text-sm transition-colors"
					>
						<i class="fas fa-trash text-xs"></i>Delete
					</button>
				</div>
			{/if}
		</div>

		<!-- Status Info Grid -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
			<!-- Status -->
			<div class="bg-ash-700 rounded-lg p-3">
				<p class="text-xs text-ash-400 mb-1">Status</p>
				<div class="flex items-center gap-2">
					<span class="w-2 h-2 rounded-full {statusColor(data.bot.status)}"></span>
					<span class="text-sm font-medium capitalize {statusTextColor(data.bot.status)}">{data.bot.status}</span>
				</div>
			</div>

			<!-- Uptime (running only) -->
			{#if isRunning && data.bot.uptime_ms}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-xs text-ash-400 mb-1">Uptime</p>
					<p class="text-sm font-medium text-ash-100">{formatUptime(data.bot.uptime_ms)}</p>
				</div>
			{/if}

			<!-- PID (official + running) -->
			{#if data.bot.bot_type === 'official' && data.bot.process_id}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-xs text-ash-400 mb-1">Process ID</p>
					<p class="text-sm font-medium text-ash-100">{data.bot.process_id}</p>
				</div>
			{/if}

			<!-- Port (official) -->
			{#if data.bot.bot_type === 'official' && data.bot.port}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-xs text-ash-400 mb-1">Port</p>
					<p class="text-sm font-medium text-ash-100">{data.bot.port}</p>
				</div>
			{/if}

			<!-- Connected To (selfbot) -->
			{#if data.bot.bot_type === 'selfbot' && data.bot.connected_bot_name}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-xs text-ash-400 mb-1">Connected To</p>
					<p class="text-sm font-medium text-ash-100 truncate">{data.bot.connected_bot_name}</p>
				</div>
			{/if}

			<!-- Servers count -->
			<div class="bg-ash-700 rounded-lg p-3">
				<p class="text-xs text-ash-400 mb-1">Servers</p>
				<p class="text-sm font-medium text-ash-100">{data.servers.length}</p>
			</div>
		</div>
	</div>

	<!-- Server List -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-ash-100">
				<i class="fas fa-server mr-2 text-ash-300"></i>Servers
			</h3>
			{#if data.servers.length > 0}
				<p class="text-xs text-ash-500">
					{Math.min((page - 1) * SERVERS_PER_PAGE + 1, data.servers.length)}–{Math.min(page * SERVERS_PER_PAGE, data.servers.length)} of {data.servers.length}
				</p>
			{/if}
		</div>

		{#if data.servers.length === 0}
			<div class="text-center py-8">
				<i class="fas fa-server text-3xl text-ash-600 mb-3"></i>
				<p class="text-ash-400 text-sm">No servers yet</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
				{#each pagedServers as server (server.id)}
					{#if data.bot.bot_type === 'official'}
						<a
							href="/bots/{data.bot.id}/servers/{server.id}"
							class="bg-ash-700 rounded-lg p-3 hover:bg-ash-600 transition-colors flex items-center gap-3"
						>
							<div class="w-10 h-10 rounded-full bg-ash-500 flex items-center justify-center overflow-hidden flex-shrink-0">
								{#if server.server_icon}
									<img src={server.server_icon} alt={server.name} class="w-full h-full object-cover" />
								{:else}
									<i class="fas fa-server text-ash-300 text-sm"></i>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ash-100 truncate">{server.name}</p>
								<div class="flex items-center gap-3 mt-0.5 text-xs text-ash-400">
									<span><i class="fas fa-users mr-1"></i>{server.total_members ?? 0}</span>
									{#if server.boost_level > 0}
										<span><i class="fas fa-gem mr-1 text-purple-400"></i>{server.boost_level}</span>
									{/if}
									<span><i class="fas fa-hashtag mr-1"></i>{server.total_channels ?? 0}</span>
								</div>
							</div>
							<i class="fas fa-chevron-right text-ash-500 text-xs flex-shrink-0"></i>
						</a>
					{:else}
						<div class="bg-ash-700 rounded-lg p-3 flex items-center gap-3 opacity-75">
							<div class="w-10 h-10 rounded-full bg-ash-500 flex items-center justify-center overflow-hidden flex-shrink-0">
								{#if server.server_icon}
									<img src={server.server_icon} alt={server.name} class="w-full h-full object-cover" />
								{:else}
									<i class="fas fa-server text-ash-300 text-sm"></i>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-ash-100 truncate">{server.name}</p>
								<div class="flex items-center gap-3 mt-0.5 text-xs text-ash-400">
									<span><i class="fas fa-users mr-1"></i>{server.total_members ?? 0}</span>
									{#if server.boost_level > 0}
										<span><i class="fas fa-gem mr-1 text-purple-400"></i>{server.boost_level}</span>
									{/if}
									<span><i class="fas fa-hashtag mr-1"></i>{server.total_channels ?? 0}</span>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex items-center justify-between">
					<button
						onclick={() => (page = Math.max(1, page - 1))}
						disabled={page === 1}
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ash-700 hover:bg-ash-600 text-ash-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						<i class="fas fa-chevron-left text-xs"></i>Previous
					</button>
					<span class="text-sm text-ash-400">Page {page} of {totalPages}</span>
					<button
						onclick={() => (page = Math.min(totalPages, page + 1))}
						disabled={page === totalPages}
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ash-700 hover:bg-ash-600 text-ash-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					>
						Next<i class="fas fa-chevron-right text-xs"></i>
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
