<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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

	let activeCategory = $state('all');
	let buying = $state<number | null>(null);
	let cardToken = $state<string>('');

	onMount(() => {
		cardToken = page.url.searchParams.get('card') ?? '';
	});

	const slug = $derived(data.server.slug);
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
			case 'vault':
				return c.vault_direction === 'withdraw'
					? `Withdraw ${c.vault_amount ?? 0} XP from your vault.`
					: `Hide ${c.vault_amount ?? 0} XP in a vault, safe from theft.`;
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

	function cooldownLine(item: any): string | null {
		const c = item.config ?? {};
		if (c.cooldown_minutes) return `Cooldown: ${c.cooldown_minutes} min`;
		return null;
	}

	async function buy(item: any) {
		if (!cardToken) {
			showToast('Open the shop from the bot menu so we know who you are.', 'error');
			return;
		}
		buying = item.id;
		try {
			const res = await fetch(`/api/leaderboards/${encodeURIComponent(slug)}/shop/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: cardToken, item_id: item.id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) showToast(`Bought ${item.name}! Check your inventory.`, 'success');
			else showToast(d.error || 'Purchase failed', 'error');
		} catch {
			showToast('Purchase failed', 'error');
		} finally {
			buying = null;
		}
	}
</script>

<svelte:head><title>Shop · {data.server.name}</title></svelte:head>

<div class="m-shop-root mx-auto max-w-5xl px-4 py-6">
	<div class="mb-5">
		<h1 class="text-xl font-bold text-white">🛒 Shop</h1>
		<p class="text-sm text-white/60">Spend XP on boosts, defense, and PvP. Open from the bot menu to buy.</p>
		{#if !cardToken}
			<p class="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
				You're browsing anonymously. Use the <strong>Shop</strong> button in the bot menu to buy items.
			</p>
		{/if}
	</div>

	<div class="mb-5 flex flex-wrap gap-2">
		{#each CATEGORIES as cat}
			<button
				onclick={() => (activeCategory = cat.id)}
				class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all
					{activeCategory === cat.id ? 'bg-teal-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}"
			>
				<i class="fas {cat.icon} text-xs"></i>{cat.label}
			</button>
		{/each}
	</div>

	{#if visibleItems.length === 0}
		<div class="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/50">No items in this category.</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each visibleItems as item (item.id)}
				<div class="m-shop-card group relative rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-teal-500/50 hover:bg-white/[0.07]">
					<div class="flex items-start justify-between gap-2">
						<div class="flex items-center gap-2">
							<span class="text-2xl">{item.icon || '🎁'}</span>
							<div>
								<div class="font-semibold text-white">{item.name}</div>
								<div class="text-[10px] tracking-wide text-white/40 uppercase">{item.category}</div>
							</div>
						</div>
						<div class="shrink-0 rounded-lg bg-teal-500/15 px-2 py-1 text-sm font-semibold text-teal-300">{item.cost} XP</div>
					</div>

					<p class="mt-3 line-clamp-2 text-xs text-white/60">{item.description || effectSummary(item)}</p>

					<button
						onclick={() => buy(item)}
						disabled={buying === item.id || !cardToken}
						class="mt-4 w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white transition-all hover:bg-teal-500 disabled:opacity-50"
					>
						{#if buying === item.id}<i class="fas fa-spinner fa-spin mr-1"></i>{/if}Buy
					</button>

					<div
						class="m-shop-tooltip pointer-events-none absolute top-2 left-1/2 z-20 w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-teal-500/30 bg-[#10131a] p-3 opacity-0 shadow-2xl transition-all duration-200 group-hover:-translate-y-[calc(100%+8px)] group-hover:opacity-100"
					>
						<div class="mb-1 flex items-center gap-2 font-semibold text-white">{item.icon || '🎁'} {item.name}</div>
						<p class="text-xs text-white/70">{effectSummary(item)}</p>
						<div class="mt-2 space-y-0.5 text-[11px] text-white/50">
							<div>Cost: <span class="text-teal-300">{item.cost} XP</span></div>
							{#if cooldownLine(item)}<div>{cooldownLine(item)}</div>{/if}
							{#if item.config?.effect_duration_minutes}<div>Duration: {item.config.effect_duration_minutes} min</div>{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.m-shop-tooltip {
		visibility: hidden;
	}
	.m-shop-card:hover .m-shop-tooltip,
	.m-shop-card:focus-within .m-shop-tooltip {
		visibility: visible;
	}
</style>
