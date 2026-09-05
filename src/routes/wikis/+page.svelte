<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	let query = $state('');
	let activeOnly = $state(false);

	const filtered = $derived(
		data.wikis.filter((w) => {
			if (activeOnly && !w.active) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return `${w.name} ${w.description ?? ''} ${w.site_host ?? ''}`.toLowerCase().includes(needle);
		})
	);
	const activeCount = $derived(data.wikis.filter((w) => w.active).length);
	const index = (n: number) => String(n).padStart(2, '0');
</script>

<svelte:head>
	<title>Wiki knowledge directory | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Every wiki {APP_NAME} Bot can look up, and whether it is active or disabled." />
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Wiki knowledge</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				Every wiki the bot can look up, in every server the bot is in. Disabled entries stay listed so you can see what is wired but off.
			</p>

			<div class="border-base-300 mt-6 grid grid-cols-3 gap-x-6 border-t pt-5">
				{#each [{ label: 'Wikis', value: data.wikis.length }, { label: 'Active', value: activeCount }, { label: 'Disabled', value: data.wikis.length - activeCount }] as stat, i (stat.label)}
					<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 70}ms">
						<p class="text-primary text-[clamp(20px,3.4cqw,34px)] leading-none font-black tabular-nums">{stat.value}</p>
						<p class="text-base-content/45 mt-1.5 text-[10px] font-bold tracking-[0.14em] uppercase">{stat.label}</p>
					</div>
				{/each}
			</div>
		</section>

		{#if data.wikis.length > 0}
			<section class="border-base-300 border-t py-8">
				<div class="mb-6 flex flex-wrap items-center gap-2.5">
					<label class="input input-sm border-base-300 bg-base-100 w-full rounded-sm sm:max-w-xs">
						<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
						<input type="search" bind:value={query} placeholder="Filter wikis" aria-label="Filter wikis" />
					</label>
					<button
						type="button"
						class="btn btn-sm rounded-sm text-[10.5px] font-extrabold tracking-[0.12em] uppercase {activeOnly ? 'btn-primary' : 'btn-outline btn-primary'}"
						onclick={() => (activeOnly = !activeOnly)}
						aria-pressed={activeOnly}
					>
						<span class="size-1.5 rounded-full bg-current motion-safe:animate-pulse"></span>
						Active only
					</button>
				</div>

				<ol class="border-base-300 border-t">
					{#each filtered as wiki, i (wiki.id)}
						<li
							use:reveal
							class="{REVEAL_CLASS} border-base-300 flex flex-col gap-3 border-b py-5 sm:flex-row sm:gap-6"
							style="transition-delay: {Math.min(i, 8) * 60}ms"
						>
							<span class="text-primary/30 shrink-0 text-[clamp(20px,3.6cqw,34px)] leading-none font-black tabular-nums">{index(i + 1)}</span>

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
									<h2 class="text-base-content text-[clamp(16px,2.6cqw,26px)] leading-[1.05] font-black tracking-[-0.025em] uppercase">{wiki.name}</h2>
									{#if wiki.site_url}
										<a
											href={wiki.site_url}
											target="_blank"
											rel="noopener noreferrer"
											class="text-base-content/45 hover:text-primary text-[11.5px] lowercase underline underline-offset-4 transition-colors"
										>
											{wiki.site_host}
										</a>
									{:else}
										<span class="text-base-content/30 text-[11.5px] lowercase">no public site</span>
									{/if}
								</div>

								{#if wiki.description}
									<p class="text-base-content/60 mt-2.5 text-[12.5px] leading-[1.55] sm:max-w-[66ch]">{wiki.description}</p>
								{/if}
							</div>

							<span class="flex shrink-0 items-center gap-1.5 self-start sm:self-center">
								<span class="size-1.5 {wiki.active ? 'bg-primary' : 'bg-base-content/20'}"></span>
								<span class="text-[9.5px] font-extrabold tracking-[0.16em] uppercase {wiki.active ? 'text-primary' : 'text-base-content/35'}">
									{wiki.active ? 'Active' : 'Disabled'}
								</span>
							</span>
						</li>
					{/each}
				</ol>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches that filter.</p>
				{/if}
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No wiki has been connected yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
