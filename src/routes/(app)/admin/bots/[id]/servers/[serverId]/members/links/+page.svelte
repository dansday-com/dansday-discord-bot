<script lang="ts">
	import Pagination from '$lib/frontend/components/Pagination.svelte';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import { INVITE_SOURCE_LABEL, INVITE_SOURCE_TONE } from '$lib/invites.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 50;

	let search = $state('');
	let page = $state(1);

	const base = $derived(adminServerSectionPath(data.botId, data.serverId, 'members'));
	const q = $derived(search.trim().toLowerCase());
	const links = $derived(data.links.filter((c) => !q || c.code.toLowerCase().includes(q) || (c.inviter_name ?? '').toLowerCase().includes(q)));
	const totalPages = $derived(Math.max(1, Math.ceil(links.length / PAGE_SIZE)));
	const start = $derived((Math.min(page, totalPages) - 1) * PAGE_SIZE);

	$effect(() => {
		void search;
		page = 1;
	});
</script>

<section class="bg-ash-800 border-ash-700 rounded-xl border p-3 sm:p-6">
	<div class="relative mb-4">
		<i class="fas fa-search absolute top-1/2 left-3 -translate-y-1/2 text-sm text-cyan-300"></i>
		<input
			type="text"
			bind:value={search}
			placeholder="Search code or owner"
			class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm focus:ring-2 focus:outline-none"
		/>
	</div>

	{#if links.length === 0}
		<p class="text-ash-400 py-8 text-center text-sm">No invite links used yet.</p>
	{:else}
		<ul class="space-y-2">
			{#each links.slice(start, start + PAGE_SIZE) as c (c.code)}
				{@const tone = INVITE_SOURCE_TONE[c.source ?? 'unknown'] ?? INVITE_SOURCE_TONE.unknown}
				<li>
					<svelte:element
						this={c.inviter_discord_id ? 'a' : 'div'}
						href={c.inviter_discord_id ? `${base}/${c.inviter_discord_id}` : undefined}
						class="bg-ash-700 border-ash-600 flex items-center gap-3 rounded-lg border p-3 transition-colors {c.inviter_discord_id
							? 'hover:border-ash-500'
							: ''}"
					>
						<i class="fas fa-link shrink-0 {tone}"></i>
						<div class="min-w-0 flex-1">
							<p class="text-ash-100 truncate font-mono text-sm">{c.code}</p>
							<p class="truncate text-xs">
								<span class={tone}>{INVITE_SOURCE_LABEL[c.source ?? 'unknown'] ?? 'Unknown'}</span>
								<span class="text-ash-400">· {c.inviter_name ?? 'No owner'}</span>
							</p>
						</div>
						<div class="shrink-0 text-right">
							<div class="text-ash-100 text-sm font-bold tabular-nums">{c.active.toLocaleString()} / {c.joins.toLocaleString()}</div>
							<div class="text-ash-400 text-[0.6rem] tracking-wide uppercase">still here / joins</div>
						</div>
					</svelte:element>
				</li>
			{/each}
		</ul>
	{/if}

	<Pagination bind:page {totalPages} />
</section>
