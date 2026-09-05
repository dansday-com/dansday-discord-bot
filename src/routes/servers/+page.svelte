<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

	let query = $state('');
	const filtered = $derived(data.entries.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())));
	const topXp = $derived(data.entries[0]?.xp ?? 0);

	const MEDAL = ['text-brand-gold', 'text-neutral', 'text-secondary'];
</script>

<svelte:head>
	<title>Server directory | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Every Discord server running {APP_NAME} Bot with public pages switched on, ranked by total XP earned. Browse member counts, messages and voice hours, then open any server's live public statistics."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell trailing="home">
	<div class="@container">
		<section class="pb-8">
			<p class="text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Directory</p>
			<h1 class="text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase">Every server, ranked</h1>
			<p class="text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch]">
				Communities running {APP_NAME} Bot with public pages switched on, ordered by total XP their members have earned.
			</p>

			{#if data.entries.length > 0}
				<div class="border-base-300 mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
					{#each [{ label: 'Servers', value: fmt(data.entries.length) }, { label: 'Members', value: fmt(data.totals.members_total) }, { label: 'XP earned', value: fmt(data.totals.leveling_total_xp) }, { label: 'Voice hours', value: fmt(data.totals.leveling_total_voice_minutes / 60) }] as stat, i}
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 70}ms">
							<p class="text-primary text-[clamp(20px,3.4vw,34px)] leading-none font-black tabular-nums">{stat.value}</p>
							<p class="text-base-content/45 mt-1.5 text-[10px] font-bold tracking-[0.14em] uppercase">{stat.label}</p>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.entries.length > 0}
			<section class="border-base-300 border-t py-8">
				<label class="input input-sm border-base-300 bg-base-100 mb-5 w-full rounded-sm sm:max-w-xs">
					<i class="fas fa-magnifying-glass text-base-content/40 text-[12px]"></i>
					<input type="search" bind:value={query} placeholder="Filter servers" aria-label="Filter servers by name" />
				</label>

				<div class="border-base-300 grid grid-cols-1 border-t">
					{#each filtered as entry (entry.slug)}
						<a
							href={publicServerPath(entry.slug)}
							class="group border-base-300 grid grid-cols-[2.2rem_38px_1fr] items-center gap-3 border-b py-3 sm:grid-cols-[2.6rem_38px_1fr_auto]"
						>
							<span class="flex items-center gap-1.5 text-[13px] font-black tabular-nums {entry.rank <= 3 ? MEDAL[entry.rank - 1] : 'text-base-content/30'}">
								{#if entry.rank <= 3}
									<i class="fas fa-medal text-[11px]"></i>
								{/if}
								{entry.rank}
							</span>
							<span class="bg-base-200 text-primary grid size-[38px] place-items-center overflow-hidden rounded-sm text-[14px] leading-none">
								{#if entry.server_icon}
									<img src={entry.server_icon} alt={entry.name} loading="lazy" decoding="async" width="38" height="38" class="size-full object-cover" />
								{:else}
									<i class="fas fa-server"></i>
								{/if}
							</span>
							<span class="min-w-0">
								<span
									class="text-base-content group-hover:text-primary block truncate text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase transition-colors"
								>
									{entry.name}
								</span>
								<span class="text-base-content/55 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums">
									<span>{fmt(entry.xp)} XP</span>
									<span class="opacity-40" aria-hidden="true">·</span>
									<span>{fmt(entry.members)} members</span>
									<span class="opacity-40" aria-hidden="true">·</span>
									<span>{fmt(entry.messages)} messages</span>
									<span class="opacity-40" aria-hidden="true">·</span>
									<span>{fmt(entry.voice_hours)}h voice</span>
									{#if entry.max_level > 0}
										<span class="opacity-40" aria-hidden="true">·</span>
										<span>top level {fmt(entry.max_level)}</span>
									{/if}
								</span>
								<span class="bg-base-300 mt-2 block h-1 w-full max-w-xs overflow-hidden rounded-full sm:hidden">
									<span class="bg-primary block h-full rounded-full" style="width: {topXp > 0 ? Math.max(2, (entry.xp / topXp) * 100) : 0}%"></span>
								</span>
							</span>
							<span class="hidden shrink-0 items-center gap-3 sm:flex">
								<span class="bg-base-300 block h-1 w-32 overflow-hidden rounded-full">
									<span class="bg-primary block h-full rounded-full" style="width: {topXp > 0 ? Math.max(2, (entry.xp / topXp) * 100) : 0}%"></span>
								</span>
								<i class="fas fa-arrow-right text-primary text-[12px] transition-transform group-hover:translate-x-0.5"></i>
							</span>
						</a>
					{/each}
				</div>

				{#if filtered.length === 0}
					<p class="text-base-content/45 py-8 text-[12.5px]">Nothing matches “{query}”.</p>
				{/if}
			</section>
		{:else}
			<section class="border-base-300 border-t py-10">
				<p class="text-base-content/45 text-[12.5px]">No servers have switched their public pages on yet.</p>
			</section>
		{/if}
	</div>
</PageShell>
