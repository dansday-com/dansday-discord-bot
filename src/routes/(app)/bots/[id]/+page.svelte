<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 9;
	let page = $state(1);

	const totalPages = $derived(Math.ceil(data.servers.length / SERVERS_PER_PAGE));
	const pagedServers = $derived(data.servers.slice((page - 1) * SERVERS_PER_PAGE, page * SERVERS_PER_PAGE));
</script>

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
				<a
					href="/bots/{data.bot.id}/servers/{server.id}"
					class="bg-ash-700 border-ash-600 hover:border-ash-500 block rounded-lg border p-4 transition-all duration-200"
				>
					<div class="mb-3 flex items-center gap-3">
						<div class="bg-ash-600 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
							{#if server.server_icon}
								<img src={server.server_icon} alt={server.name} class="h-full w-full object-cover" />
							{:else}
								<i class="fas fa-server text-lg text-violet-300"></i>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<h4 class="text-ash-100 truncate text-sm font-semibold sm:text-base" title={server.name}>{server.name || 'Unnamed Server'}</h4>
						</div>
						<i class="fas fa-cog text-violet-300 transition-colors hover:text-violet-200"></i>
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
				</a>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<button
					onclick={() => (page = Math.max(1, page - 1))}
					disabled={page === 1}
					class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					<i class="fas fa-chevron-left text-xs"></i>Previous
				</button>
				<span class="text-ash-400 text-sm">Page {page} of {totalPages}</span>
				<button
					onclick={() => (page = Math.min(totalPages, page + 1))}
					disabled={page === totalPages}
					class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				>
					Next<i class="fas fa-chevron-right text-xs"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>
