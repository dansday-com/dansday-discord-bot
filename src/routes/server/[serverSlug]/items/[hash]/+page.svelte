<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const CATEGORIES = [
		{ id: 'all', label: 'All', icon: 'fa-grip' },
		{ id: 'pvp', label: 'PvP', icon: 'fa-crosshairs' },
		{ id: 'boost', label: 'Boosts', icon: 'fa-bolt' },
		{ id: 'cosmetic', label: 'Cosmetic', icon: 'fa-palette' },
		{ id: 'fun', label: 'Fun', icon: 'fa-dice' }
	];
	const TARGETED = new Set(['xp_steal', 'xp_bomb', 'leech', 'gift', 'bounty']);

	let view = $state<'shop' | 'bag'>('shop');
	let activeCategory = $state('all');
	let busy = $state<number | null>(null);
	let pickingTargetFor = $state<any | null>(null);

	const visibleItems = $derived(activeCategory === 'all' ? data.items : data.items.filter((i: any) => i.category === activeCategory));

	function effectSummary(item: any): string {
		const c = item.config ?? {};
		switch (item.effect_type) {
			case 'xp_steal':
				return `Steal ${c.min_percent ?? 1}–${c.max_percent ?? 25}% of a member's total XP.`;
			case 'xp_bomb':
				return `Destroy ${c.min_percent ?? 1}–${c.max_percent ?? 50}% of a member's total XP.`;
			case 'xp_boost':
				return `${c.multiplier ?? 2}× XP for ${c.effect_duration_minutes ?? 60} min (${c.scope ?? 'all'}).`;
			case 'shield':
				return `Block incoming attacks for ${c.effect_duration_minutes ?? 60} min.`;
			case 'leech':
				return `Skim ${c.skim_percent ?? 10}% of a member's XP for ${c.effect_duration_minutes ?? 120} min.`;
			case 'gamble':
				return `Stake ${c.stake ?? 0} XP — ${c.win_chance ?? 50}% chance to win ${c.payout_multiplier ?? 2}× it.`;
			case 'bounty':
				return `Put ${c.bounty_amount ?? 0} XP on a member — collected by whoever robs them next.`;
			case 'reflect':
				return `Bounce the next attack back at the attacker for ${c.effect_duration_minutes ?? 60} min.`;
			case 'insurance':
				return `Refund your XP the next time you're robbed (${c.effect_duration_minutes ?? 60} min).`;
			case 'gift':
				return `Send ${c.gift_amount ?? 0} XP to a member${c.tax_percent ? ` (−${c.tax_percent}% tax)` : ''}.`;
			case 'cosmetic':
				return `Unlock a ${c.cosmetic_kind ?? 'cosmetic'} for your card.`;
			default:
				return item.description ?? '';
		}
	}

	async function buy(item: any) {
		if (!data.valid) return;
		busy = item.id;
		try {
			const res = await fetch(`/api/public-statistics/${encodeURIComponent(data.server.slug)}/items/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, item_id: item.id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) {
				showToast(`Bought ${item.name}!`, 'success');
				await invalidateAll();
			} else showToast(d.error || 'Purchase failed', 'error');
		} catch {
			showToast('Purchase failed', 'error');
		} finally {
			busy = null;
		}
	}

	function onUse(item: any) {
		if (TARGETED.has(item.effect_type)) pickingTargetFor = item;
		else use(item);
	}

	async function use(item: any, targetHash?: string) {
		busy = item.member_item_id;
		try {
			const res = await fetch(`/api/public-statistics/${encodeURIComponent(data.server.slug)}/items/use`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, target_card: targetHash, member_item_id: item.member_item_id })
			});
			const d = await res.json();
			if (d.success) {
				const detail = d.result?.xp ? ` (${d.result.xp} XP)` : '';
				showToast(`Used ${item.name}!${detail}`, 'success');
				pickingTargetFor = null;
				await invalidateAll();
			} else showToast(d.error || 'Failed to use item', 'error');
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Items · {data.server.name}</title></svelte:head>

<div class="m-items">
	<div class="m-items-bar">
		<div class="m-items-toggle">
			<button class="m-items-seg" class:m-items-seg--active={view === 'shop'} onclick={() => (view = 'shop')}><i class="fas fa-store"></i>Shop</button>
			<button class="m-items-seg" class:m-items-seg--active={view === 'bag'} onclick={() => (view = 'bag')} disabled={!data.valid}>
				<i class="fas fa-bag-shopping"></i>Bag{#if data.valid}<span class="m-items-count">{data.inventory.length}</span>{/if}
			</button>
		</div>
		{#if data.valid}<span class="m-items-who">{data.memberName}</span>{/if}
	</div>

	{#if !data.valid}
		<p class="m-items-anon">
			<i class="fas fa-circle-info"></i>
			Browsing read-only. Open <strong>Items</strong> from the bot menu to buy and use.
		</p>
	{/if}

	{#if view === 'shop'}
		<div class="m-items-tabs">
			{#each CATEGORIES as cat}
				<button class="m-items-tab" class:m-items-tab--active={activeCategory === cat.id} onclick={() => (activeCategory = cat.id)}>
					<i class="fas {cat.icon}"></i>{cat.label}
				</button>
			{/each}
		</div>

		{#if visibleItems.length === 0}
			<div class="m-members-empty">No items in this category.</div>
		{:else}
			<ul class="m-items-grid">
				{#each visibleItems as item (item.id)}
					<li class="m-items-card" data-cat={item.category}>
						<div class="m-items-accent"></div>
						<div class="m-items-card-top">
							<span class="m-items-medallion">{item.icon || '🎁'}</span>
							<div class="m-items-card-head">
								<span class="m-items-name">{item.name}</span>
								<span class="m-items-cat">{item.category}</span>
							</div>
						</div>
						<p class="m-items-desc">{item.description || effectSummary(item)}</p>
						<div class="m-items-foot">
							<span class="m-items-cost"><i class="fas fa-star"></i>{item.cost} XP</span>
							<button class="m-items-buy" disabled={busy === item.id || !data.valid} onclick={() => buy(item)}>
								{#if busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-cart-plus"></i>{/if}Buy
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if pickingTargetFor}
		<button class="m-items-back" onclick={() => (pickingTargetFor = null)}><i class="fas fa-arrow-left"></i>Back</button>
		<p class="m-items-pick-label">Pick a target for <strong>{pickingTargetFor.name}</strong>:</p>
		<ul class="m-items-targets">
			{#each data.targets as t}
				<li>
					<button class="m-items-target" disabled={busy === pickingTargetFor.member_item_id} onclick={() => use(pickingTargetFor, t.hash)}>{t.name}</button>
				</li>
			{/each}
		</ul>
	{:else if data.inventory.length === 0}
		<div class="m-members-empty">Your bag is empty. Buy items in the shop!</div>
	{:else}
		<ul class="m-items-grid">
			{#each data.inventory as item (item.member_item_id)}
				<li class="m-items-card" data-cat={item.category}>
					<div class="m-items-accent"></div>
					<span class="m-items-badge">×{item.quantity}</span>
					<div class="m-items-card-top">
						<span class="m-items-medallion">{item.icon || '🎁'}</span>
						<div class="m-items-card-head">
							<span class="m-items-name">{item.name}</span>
							<span class="m-items-cat">{item.category}</span>
						</div>
					</div>
					<p class="m-items-desc">{item.description || effectSummary(item)}</p>
					<div class="m-items-foot">
						<button class="m-items-buy m-items-buy--use" disabled={busy === item.member_item_id || item.quantity <= 0} onclick={() => onUse(item)}>
							{#if busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-bolt"></i>{/if}Use
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
