<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));
	const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
	const when = (v: string | null) => (v ? dateFmt.format(new Date(v)) : '');

	let query = $state('');
	let sortBy = $state<'members' | 'name'>('members');
	let broken = $state<Record<string, boolean>>({});

	const filtered = $derived(
		[...data.sources.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))].sort((a, b) =>
			sortBy === 'name' ? a.name.localeCompare(b.name) : b.members - a.members
		)
	);

	const totalMembers = $derived(data.sources.reduce((sum, s) => sum + s.members, 0));
	const totalChannels = $derived(data.sources.reduce((sum, s) => sum + s.channels, 0));
</script>

<svelte:head>
	<title>Forwarder source servers | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every Discord server you can forward messages from with {APP_NAME} Bot. Pull drops, jobs and announcements into your own channels, filtered by keyword so only what you care about lands."
	/>
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Forward from here</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				Pull drops, jobs and announcements out of any server on this list, straight into your own channels. Filter by keyword so only what you care about lands.
				Pick a source, then set the channels and target in your panel.
			</p>

			{#if data.sources.length > 0}
				<div class="border-base-300 mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
					{#each [{ label: 'Sources', value: fmt(data.sources.length) }, { label: 'Members reachable', value: fmt(totalMembers) }, { label: 'Channels', value: fmt(totalChannels) }, { label: 'Largest', value: fmt(data.sources[0]?.members ?? 0) }] as stat, i (stat.label)}
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 70}ms">
							<p class="text-primary text-[clamp(20px,3.4cqw,34px)] leading-none font-black tabular-nums">{stat.value}</p>
							<p class="text-base-content/45 mt-1.5 text-[10px] font-bold tracking-[0.14em] uppercase">{stat.label}</p>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.sources.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-5 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter servers" aria-label="Filter source servers by name" />
					</label>
					{#each [{ id: 'members' as const, label: 'Biggest' }, { id: 'name' as const, label: 'A–Z' }] as option (option.id)}
						<button
							type="button"
							class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {sortBy === option.id
								? 'btn-primary'
								: 'btn-outline btn-primary'}"
							onclick={() => (sortBy = option.id)}
							aria-pressed={sortBy === option.id}
						>
							{option.label}
						</button>
					{/each}
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each filtered as source, i (source.discord_server_id)}
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {Math.min(i, 8) * 60}ms">
							<article class="border-base-300 bg-base-100 hover:border-primary/40 flex h-full gap-3.5 rounded-sm border p-4 transition-colors">
								<span class="bg-base-200 text-primary grid size-11 shrink-0 place-items-center overflow-hidden rounded-sm text-[15px] leading-none">
									{#if source.server_icon && !broken[source.discord_server_id]}
										<img
											src={source.server_icon}
											alt={source.name}
											loading="lazy"
											decoding="async"
											width="44"
											height="44"
											class="size-full object-cover"
											onerror={() => (broken[source.discord_server_id] = true)}
										/>
									{:else}
										<i class="fas fa-satellite-dish"></i>
									{/if}
								</span>

								<div class="min-w-0 flex-1">
									<h2 class="text-base-content truncate text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{source.name}</h2>
									<p class="text-base-content/55 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] tabular-nums">
										<span>{fmt(source.members)} members</span>
										{#if source.channels > 0}
											<span class="opacity-40" aria-hidden="true">·</span>
											<span>{fmt(source.channels)} channels</span>
										{/if}
										{#if source.created_at}
											<span class="opacity-40" aria-hidden="true">·</span>
											<span>since {when(source.created_at)}</span>
										{/if}
									</p>
									{#if source.boost_level > 0}
										<p class="text-secondary mt-2 text-[10px] font-extrabold tracking-[0.14em] uppercase">
											<i class="fas fa-angles-up text-[9px]"></i>
											Boost level {source.boost_level}
										</p>
									{/if}
								</div>
							</article>
						</div>
					{/each}
				</div>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches “{query}”.</p>
				{/if}
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No source servers are available to forward from yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
