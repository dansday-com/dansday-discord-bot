<script lang="ts">
	import { getContext } from 'svelte';
	import { actionVerb } from '$lib/items.js';
	import { publicServerPath } from '$lib/url.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const base = $derived(`${publicServerPath(data.server.slug)}/items/history/${data.hash}`);

	function ago(ms: number): string {
		const s = Math.max(0, Math.floor((ctx.now - ms) / 1000));
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ago`;
		if (h > 0) return `${h}h ago`;
		if (m > 0) return `${m}m ago`;
		return `${s}s ago`;
	}

	function line(h: any): { icon: string; title: string; tone: string; deltaLabel: string } {
		if (h.action === 'buy') return { icon: 'fa-cart-shopping', title: `Bought ${h.itemName ?? 'item'}`, tone: 'spend', deltaLabel: `−${fmt(h.xpAmount)} XP` };
		if (h.action === 'gamble') {
			const won = h.outcome === 'win';
			return {
				icon: won ? 'fa-trophy' : 'fa-skull',
				title: won ? 'Gamble — Won' : 'Gamble — Lost',
				tone: won ? 'win' : 'lose',
				deltaLabel: `${h.xpAmount >= 0 ? '+' : '−'}${fmt(Math.abs(h.xpAmount))} XP`
			};
		}
		const verb = actionVerb(h.action);
		const target = h.targetName ? ` → ${h.targetName}` : '';
		let tone = 'neutral';
		let deltaLabel = '';
		if (h.outcome === 'blocked' || h.outcome === 'reflected') {
			tone = 'lose';
			deltaLabel = h.outcome === 'blocked' ? 'Blocked' : 'Reflected';
		} else if (h.action === 'steal' && h.xpAmount > 0) {
			tone = 'win';
			deltaLabel = `+${fmt(h.xpAmount)} XP`;
		} else if (h.action === 'bomb' && h.xpAmount > 0) {
			deltaLabel = `${fmt(h.xpAmount)} XP destroyed`;
		} else if (h.action === 'gift' && h.xpAmount > 0) {
			deltaLabel = `${fmt(h.xpAmount)} XP sent`;
		}
		return { icon: verb.icon, title: `${verb.label}${target}`, tone, deltaLabel };
	}
</script>

<svelte:head><title>History · {data.server.name}</title></svelte:head>

{#if data.historyTotal === 0}
	<div class="m-members-empty">No activity yet. Buy or use an item to start your history.</div>
{:else}
	<ul class="m-hist">
		{#each data.pagedHistory as h (h.id)}
			{@const l = line(h)}
			<li class="m-hist-row m-hist-row--{l.tone}">
				<span class="m-hist-icon"><i class="fas {l.icon}"></i></span>
				<span class="m-hist-body">
					<span class="m-hist-title">{l.title}</span>
					<span class="m-hist-time">{h.at ? ago(h.at) : ''}</span>
				</span>
				{#if l.deltaLabel}<span class="m-hist-delta m-hist-delta--{l.tone}">{l.deltaLabel}</span>{/if}
			</li>
		{/each}
	</ul>
	{#if data.totalPages > 1}
		<div class="m-hist-pager">
			{#if data.historyPage > 1}
				<a class="m-hist-page-btn" href="{base}?page={data.historyPage - 1}" data-sveltekit-preload-data="hover"><i class="fas fa-chevron-left"></i></a>
			{:else}
				<span class="m-hist-page-btn m-hist-page-btn--off"><i class="fas fa-chevron-left"></i></span>
			{/if}
			<span class="m-hist-page-info">{data.historyPage} / {data.totalPages}</span>
			{#if data.historyPage < data.totalPages}
				<a class="m-hist-page-btn" href="{base}?page={data.historyPage + 1}" data-sveltekit-preload-data="hover"><i class="fas fa-chevron-right"></i></a>
			{:else}
				<span class="m-hist-page-btn m-hist-page-btn--off"><i class="fas fa-chevron-right"></i></span>
			{/if}
		</div>
	{/if}
{/if}
