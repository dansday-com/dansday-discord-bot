<script lang="ts">
	import { getContext } from 'svelte';
	import { effectSummary } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt, canAfford, buy, openGamble, effectIcon, effectLabel } = ctx;
</script>

<svelte:head><title>Shop · {data.server.name}</title></svelte:head>

{#if data.visibleItems.length === 0}
	<div class="m-members-empty">No items in this category.</div>
{:else}
	<div class="m-cards">
		{#each data.visibleItems as item (item.id)}
			{@const affordable = canAfford(item)}
			<article class="m-card" class:m-card--locked={!affordable} class:m-card--burst={ctx.burstId === item.id} data-cat={item.effect_type}>
				<div class="m-card-glow"></div>
				<div class="m-card-top">
					<span class="m-card-medallion"><i class="fas {effectIcon(item.effect_type)}"></i></span>
					<span class="m-card-tag">{effectLabel(item.effect_type)}</span>
				</div>
				{#if item.availableUntil && item.availableUntil > ctx.now}
					<span class="m-card-timer"><i class="fas fa-hourglass-half"></i>Ends in {ctx.remainingLabel(item.availableUntil)}</span>
				{/if}
				<h3 class="m-card-name">{item.name}</h3>
				<p class="m-card-desc">{item.description || effectSummary(item)}</p>
				<div class="m-card-foot">
					{#if item.effect_type === 'gamble'}
						<span class="m-card-price m-card-price--wager"><i class="fas fa-dice"></i>Wager</span>
						<button class="m-card-btn m-card-btn--play" onclick={() => openGamble(item)}>
							<i class="fas fa-dice"></i>Play
						</button>
					{:else}
						<span class="m-card-price" class:m-card-price--short={!affordable}><i class="fas fa-star"></i>{fmt(item.cost)}</span>
						<button class="m-card-btn" disabled={ctx.busy === item.id || !affordable} onclick={(e) => buy(item, e)}>
							{#if ctx.busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else if !affordable}<i class="fas fa-lock"></i>{:else}<i
									class="fas fa-cart-plus"
								></i>{/if}
							{affordable ? 'Buy' : 'Locked'}
						</button>
					{/if}
				</div>
			</article>
		{/each}
	</div>
{/if}
