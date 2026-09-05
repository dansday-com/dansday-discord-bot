<script lang="ts">
	import { onDestroy } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import type { RobloxEntry } from '$lib/frontend/public/catalog/index.js';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	let loaded = $state<RobloxEntry[]>([...data.items]);
	let loading = $state(false);
	let exhausted = $state(data.items.length >= data.tracked);
	let sentinel: HTMLDivElement | null = $state(null);

	async function loadMore() {
		if (loading || exhausted) return;
		loading = true;
		try {
			const res = await fetch(`/api/public-catalog/roblox?offset=${loaded.length}`);
			const payload = (await res.json()) as { items?: RobloxEntry[]; limit?: number };
			const batch = Array.isArray(payload.items) ? payload.items : [];
			const seen = new Set(loaded.map((item) => item.asset_id));
			const fresh = batch.filter((item) => !seen.has(item.asset_id));
			loaded = [...loaded, ...fresh];
			if (fresh.length === 0 || batch.length < (payload.limit ?? batch.length)) exhausted = true;
		} catch (_) {
			exhausted = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const node = sentinel;
		if (!node || exhausted) return;
		const io = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) loadMore();
		});
		io.observe(node);
		return () => io.disconnect();
	});

	onDestroy(() => {
		loaded = [];
	});

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

	let query = $state('');
	let limitedOnly = $state(false);
	let broken = $state<Record<string, boolean>>({});

	const initials = (n: string) =>
		n
			.replace(/[^a-zA-Z0-9 ]/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase() || '?';

	const categories = $derived([...new Set(loaded.map((i) => i.category).filter(Boolean))].sort() as string[]);
	let category = $state('');

	const filtered = $derived(
		loaded.filter((item) => {
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
				{fmt(data.tracked)} items under watch, ordered by favourites. Prices and stock refresh as the notifier polls the catalog.
			</p>
		</section>

		{#if data.tracked > 0}
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
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {Math.min(i, 8) * 60}ms">
							<a
								href={`https://www.roblox.com/catalog/${item.asset_id}`}
								target="_blank"
								rel="noopener noreferrer"
								class="group border-base-300 bg-base-100 hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-sm border transition-colors"
							>
								{#if item.thumbnail_url && !broken[item.asset_id]}
									<img
										src={item.thumbnail_url}
										alt={item.name}
										loading="lazy"
										decoding="async"
										class="bg-base-200 aspect-square w-full object-cover"
										onerror={() => (broken[item.asset_id] = true)}
									/>
								{:else}
									<span class="bg-base-200 grid aspect-square w-full place-items-center">
										<span class="flex flex-col items-center gap-1.5">
											<i class="fas fa-cube text-base-content/20 text-[22px]"></i>
											<span class="text-base-content/35 text-[13px] font-black tracking-[0.1em] uppercase">{initials(item.name)}</span>
										</span>
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
										{#if item.notification_count > 0}
											<span class="text-base-content/60 font-bold">
												<i class="fas fa-bell text-[9px]"></i>
												{fmt(item.notification_count)}
											</span>
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
						</div>
					{/each}
				</div>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches that filter.</p>
				{/if}

				<div bind:this={sentinel} class="pt-8">
					{#if loading}
						<p class="text-base-content/45 text-[12px] font-bold tracking-[0.12em] uppercase">
							<i class="fas fa-spinner fa-spin text-[11px]"></i>
							Loading more
						</p>
					{:else if !exhausted}
						<button
							type="button"
							class="btn btn-sm btn-outline btn-primary rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase"
							onclick={loadMore}
						>
							Load more
						</button>
					{/if}
					<p class="text-base-content/35 mt-3 text-[11.5px] tabular-nums">
						{fmt(loaded.length)} of {fmt(data.tracked)} loaded{#if !exhausted}
							&nbsp;· filters search what is loaded{/if}
					</p>
				</div>
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No catalog items are being watched yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
