<script lang="ts">
	import { getContext } from 'svelte';
	import { effectSummary } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { onUse, isBuffActive, effectIcon, effectLabel, actionVerb } = ctx;
</script>

<svelte:head><title>Bag · {data.server.name}</title></svelte:head>

{#if data.inventory.length === 0}
	<div class="m-members-empty">Your bag is empty. Buy items in the shop!</div>
{:else}
	<div class="m-cards">
		{#each data.inventory as item (item.member_item_id)}
			<article class="m-card" data-cat={item.effect_type}>
				<div class="m-card-glow"></div>
				<div class="m-card-top">
					<span class="m-card-medallion"><i class="fas {effectIcon(item.effect_type)}"></i><span class="m-card-qty">×{item.quantity}</span></span>
					<span class="m-card-tag">{effectLabel(item.effect_type)}</span>
				</div>
				<h3 class="m-card-name">{item.name}</h3>
				<p class="m-card-desc">{item.description || effectSummary(item)}</p>
				<div class="m-card-foot">
					{#if isBuffActive(item.effect_type)}
						<span class="m-card-active"><i class="fas fa-circle-check"></i>Active</span>
						<button class="m-card-btn m-card-btn--use" disabled><i class="fas fa-check"></i>In use</button>
					{:else}
						<span class="m-card-owned">Owned ×{item.quantity}</span>
						<button class="m-card-btn m-card-btn--use" disabled={ctx.busy === item.member_item_id || item.quantity <= 0} onclick={() => onUse(item)}>
							{#if ctx.busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas {actionVerb(item.effect_type).icon}"></i>{/if}
							{actionVerb(item.effect_type).label}
						</button>
					{/if}
				</div>
			</article>
		{/each}
	</div>
{/if}
