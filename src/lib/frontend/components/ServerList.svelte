<script lang="ts">
	import Pagination from '$lib/frontend/components/Pagination.svelte';

	type Server = {
		id: number;
		discord_server_id: string;
		name: string | null;
		server_icon: string | null;
		total_members: number | null;
		total_channels: number | null;
		total_boosters: number | null;
		boost_level: number | null;
	};

	interface Props {
		servers: Server[];
		href?: (server: Server) => string;
	}

	let { servers, href }: Props = $props();

	const PAGE_SIZE = 20;

	let search = $state('');
	let page = $state(1);

	const q = $derived(search.trim().toLowerCase());
	const rows = $derived(q ? servers.filter((s) => (s.name ?? '').toLowerCase().includes(q) || s.discord_server_id.includes(q)) : servers);
	const totalPages = $derived(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
	const current = $derived(Math.min(page, totalPages));
	const pageRows = $derived(rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE));

	const count = (n: number | null, word: string) => `${Number(n || 0).toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
</script>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-6">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h3 class="text-ash-100 text-lg font-semibold">
			<i class="fas fa-server mr-2 text-violet-400"></i>Servers
		</h3>
		<span class="text-ash-400 text-xs tabular-nums sm:text-sm">{count(servers.length, 'server')}</span>
	</div>

	{#if servers.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No servers yet.</p>
	{:else}
		<div class="relative mb-3">
			<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
			<input
				type="text"
				bind:value={search}
				oninput={() => (page = 1)}
				placeholder="Search name or ID"
				class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
			/>
		</div>

		{#if rows.length === 0}
			<p class="text-ash-400 py-8 text-center text-sm">No servers match.</p>
		{:else}
			<ul class="space-y-2">
				{#each pageRows as s (s.id)}
					<li>
						<svelte:element
							this={href ? 'a' : 'div'}
							href={href?.(s)}
							class="bg-ash-700 border-ash-600 flex items-center gap-3 rounded-lg border p-3 {href ? 'hover:border-ash-500 transition-colors' : ''}"
						>
							<div class="bg-ash-600 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
								{#if s.server_icon}
									<img src={s.server_icon} alt="" loading="lazy" class="h-full w-full object-cover" />
								{:else}
									<i class="fas fa-server text-sm text-violet-300"></i>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-ash-100 flex items-center gap-1.5 text-sm font-semibold">
									<span class="truncate" title={s.name ?? ''}>{s.name || 'Unnamed Server'}</span>
									{#if (s.boost_level ?? 0) > 0}
										<span class="shrink-0 text-xs font-medium text-purple-400" title="Boost level"><i class="fas fa-gem mr-0.5"></i>LV {s.boost_level}</span>
									{/if}
								</p>
								<p class="text-ash-400 truncate text-xs tabular-nums">
									{count(s.total_members, 'member')} · {count(s.total_channels, 'channel')}{#if (s.total_boosters ?? 0) > 0}
										· {count(s.total_boosters, 'booster')}{/if}
								</p>
							</div>
							{#if href}
								<i class="fas fa-chevron-right text-ash-400 shrink-0 text-xs"></i>
							{/if}
						</svelte:element>
					</li>
				{/each}
			</ul>
		{/if}

		<Pagination bind:page {totalPages} />
	{/if}
</section>
