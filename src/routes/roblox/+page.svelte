<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

	let query = $state('');
	let limitedOnly = $state(false);

	const categories = $derived([...new Set(data.items.map((i) => i.category).filter(Boolean))].sort() as string[]);
	let category = $state('');

	const filtered = $derived(
		data.items.filter((item) => {
			if (limitedOnly && !item.limited) return false;
			if (category && item.category !== category) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return `${item.name} ${item.creator_name ?? ''}`.toLowerCase().includes(needle);
		})
	);
</script>

<svelte:head>
	<title>Roblox catalog directory | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every Roblox catalog item {APP_NAME} Bot watches, with price, lowest resale, favourites and remaining stock. Filter by category or narrow to limited items."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Roblox catalog</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				{data.items.length} items under watch, ordered by favourites. Prices and stock refresh as the notifier polls the catalog.
			</p>
		</section>

		{#if data.items.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-5 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter items" aria-label="Filter items" />
					</label>
					{#if categories.length > 1}
						<select class="select select-sm border-base-300 bg-base-100 w-auto rounded-sm" bind:value={category} aria-label="Filter by category">
							<option value="">All categories</option>
							{#each categories as c}
								<option value={c}>{c}</option>
							{/each}
						</select>
					{/if}
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {limitedOnly ? 'btn-primary' : 'btn-outline btn-primary'}"
						onclick={() => (limitedOnly = !limitedOnly)}
						aria-pressed={limitedOnly}
					>
						Limited only
					</button>
				</div>

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{#each filtered as item, i (item.asset_id)}
						<a
							href={`https://www.roblox.com/catalog/${item.asset_id}`}
							target="_blank"
							rel="noopener noreferrer"
							use:reveal
							class="{REVEAL_CLASS} group border-base-300 bg-base-100 hover:border-primary/40 flex flex-col overflow-hidden rounded-sm border transition-colors"
							style="transition-delay: {Math.min(i, 8) * 60}ms"
						>
							{#if item.thumbnail_url}
								<img src={item.thumbnail_url} alt={item.name} loading="lazy" class="bg-base-200 aspect-square w-full object-cover" />
							{:else}
								<span class="bg-base-200 text-base-content/25 grid aspect-square w-full place-items-center text-[24px]">
									<i class="fas fa-cube"></i>
								</span>
							{/if}
							<div class="flex flex-1 flex-col p-3">
								{#if item.category}
									<p class="text-base-content/40 mb-1 truncate text-[9.5px] font-bold tracking-[0.14em] uppercase">{item.category}</p>
								{/if}
								<h2 class="text-base-content group-hover:text-primary mb-1 line-clamp-2 text-[12px] leading-[1.35] font-extrabold transition-colors">
									{item.name}
								</h2>
								{#if item.creator_name}
									<p class="text-base-content/45 mb-2 truncate text-[11px]">by {item.creator_name}</p>
								{/if}
								<div class="border-base-300 mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t pt-2 text-[11px] tabular-nums">
									<span class="text-primary font-black">{item.price > 0 ? `${fmt(item.price)} R$` : 'Free'}</span>
									{#if item.price_delta !== 0}
										<span class={item.price_delta > 0 ? 'text-error font-bold' : 'text-success font-bold'}>
											{item.price_delta > 0 ? '+' : '−'}{fmt(Math.abs(item.price_delta))}
										</span>
									{/if}
									{#if item.limited}
										<span class="text-base-content/45">{fmt(item.units_available)} / {fmt(item.total_quantity)} left</span>
									{/if}
									{#if item.favorite_count > 0}
										<span class="text-base-content/45 ml-auto">
											<i class="fas fa-heart text-[9px]"></i>
											{fmt(item.favorite_count)}
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches that filter.</p>
				{/if}
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No catalog items are being watched yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
