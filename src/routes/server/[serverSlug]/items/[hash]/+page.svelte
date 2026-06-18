<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';

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

	let liveXp = $state(data.balance?.experience ?? 0);
	let level = $state(data.balance?.level ?? 1);
	let rank = $state(data.balance?.rank ?? null);
	let xpBumped = $state(false);
	let lastDelta = $state<number | null>(null);

	let displayXp = $state(data.balance?.experience ?? 0);
	let rafId: number | null = null;

	function animateTo(target: number) {
		if (rafId) cancelAnimationFrame(rafId);
		const start = displayXp;
		const diff = target - start;
		if (diff === 0) return;
		const dur = 650;
		let t0: number | null = null;
		const step = (ts: number) => {
			if (t0 === null) t0 = ts;
			const p = Math.min(1, (ts - t0) / dur);
			const eased = 1 - Math.pow(1 - p, 3);
			displayXp = Math.round(start + diff * eased);
			if (p < 1) rafId = requestAnimationFrame(step);
			else displayXp = target;
		};
		rafId = requestAnimationFrame(step);
	}

	function setXp(next: number) {
		const prev = liveXp;
		if (next === prev) return;
		lastDelta = next - prev;
		liveXp = next;
		animateTo(next);
		xpBumped = true;
		setTimeout(() => (xpBumped = false), 700);
	}

	let es: EventSource | null = null;

	onMount(() => {
		if (!data.valid || !data.memberDiscordId) return;
		const url = `/api/public-statistics/${encodeURIComponent(data.server.slug)}/members-stream`;
		const source = new EventSource(url);
		es = source;
		source.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data) as PublicMembersStreamPayload;
				const me = payload?.members?.find((m: any) => String(m.discord_member_id) === data.memberDiscordId);
				if (me) {
					if (me.experience != null) setXp(Number(me.experience) || 0);
					if (me.level != null) level = Number(me.level) || 1;
					if (me.rank != null) rank = Number(me.rank);
				}
			} catch (_) {}
		};
		source.onerror = () => {};
	});

	onDestroy(() => {
		es?.close();
		if (rafId) cancelAnimationFrame(rafId);
	});

	function fmt(n: number): string {
		return Number(n ?? 0).toLocaleString();
	}

	const visibleItems = $derived(activeCategory === 'all' ? data.items : data.items.filter((i: any) => i.category === activeCategory));

	function canAfford(item: any): boolean {
		if (!data.valid) return true;
		return liveXp >= (Number(item.cost) || 0);
	}

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

	let burstId = $state<number | null>(null);
	function burst(id: number) {
		burstId = id;
		setTimeout(() => {
			if (burstId === id) burstId = null;
		}, 600);
	}

	async function buy(item: any) {
		if (!data.valid) return;
		if (!canAfford(item)) {
			showToast(`Not enough XP — need ${fmt(item.cost)}`, 'error');
			return;
		}
		busy = item.id;
		const optimistic = Math.max(0, liveXp - (Number(item.cost) || 0));
		try {
			const res = await fetch(`/api/public-statistics/${encodeURIComponent(data.server.slug)}/items/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, item_id: item.id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) {
				burst(item.id);
				setXp(optimistic);
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

	function useOutcomeToast(item: any, d: any) {
		const r = d.result ?? {};
		const outcome = d.outcome ?? r.outcome;
		const amt = r.xp ? ` (${fmt(r.xp)} XP)` : '';
		switch (item.effect_type) {
			case 'gamble':
				if (r.won) return showToast(`🎲 You won!${r.net != null ? ` +${fmt(r.net)} XP` : ''}`, 'success');
				return showToast(`🎲 You lost the gamble${r.stake ? ` (−${fmt(r.stake)} XP)` : ''}.`, 'error');
			case 'xp_steal':
				if (outcome === 'blocked') return showToast('🛡️ Blocked by their shield.', 'error');
				if (outcome === 'reflected') return showToast(`🪞 Reflected back at you!${amt}`, 'error');
				return showToast(`💰 Robbed them${amt}!`, 'success');
			case 'xp_bomb':
				if (outcome === 'blocked') return showToast('🛡️ Blocked by their shield.', 'error');
				if (outcome === 'reflected') return showToast(`🪞 Reflected back at you!${amt}`, 'error');
				return showToast(`💥 Bombed them${amt}!`, 'success');
			case 'gift':
				return showToast(`🎁 Gift sent${amt}!`, 'success');
			default:
				return showToast(`Used ${item.name}!${amt}`, 'success');
		}
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
				useOutcomeToast(item, d);
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
	{#if data.valid}
		<!-- XP balance header -->
		<div class="m-xp">
			<div class="m-xp-main">
				<span class="m-xp-coin" class:m-xp-coin--bump={xpBumped}><i class="fas fa-star"></i></span>
				<div class="m-xp-figures">
					<span class="m-xp-amount" class:m-xp-amount--bump={xpBumped}>{fmt(displayXp)}<span class="m-xp-unit">XP</span></span>
					<span class="m-xp-sub">
						<span class="m-xp-chip"><i class="fas fa-layer-group"></i>Lvl {level}</span>
						{#if rank}<span class="m-xp-chip"><i class="fas fa-ranking-star"></i>#{rank}</span>{/if}
						<span class="m-xp-live"><span class="m-xp-dot"></span>Live</span>
					</span>
				</div>
			</div>
			{#if lastDelta != null}
				{#key lastDelta}
					<span class="m-xp-delta {lastDelta >= 0 ? 'm-xp-delta--up' : 'm-xp-delta--down'}">{lastDelta >= 0 ? '+' : ''}{fmt(lastDelta)}</span>
				{/key}
			{/if}
		</div>
	{/if}

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
					{@const affordable = canAfford(item)}
					<li class="m-items-card" class:m-items-card--locked={!affordable} class:m-items-card--burst={burstId === item.id} data-cat={item.category}>
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
							<span class="m-items-cost" class:m-items-cost--short={!affordable}><i class="fas fa-star"></i>{fmt(item.cost)}</span>
							<button class="m-items-buy" disabled={busy === item.id || !data.valid || !affordable} onclick={() => buy(item)}>
								{#if busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else if !affordable}<i class="fas fa-lock"></i>{:else}<i class="fas fa-cart-plus"
									></i>{/if}
								{affordable ? 'Buy' : 'Locked'}
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
					<button class="m-items-target" disabled={busy === pickingTargetFor.member_item_id} onclick={() => use(pickingTargetFor, t.hash)}>
						<i class="fas fa-crosshairs"></i>{t.name}
					</button>
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
							{#if busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else if TARGETED.has(item.effect_type)}<i class="fas fa-crosshairs"
								></i>{:else}<i class="fas fa-bolt"></i>{/if}
							{TARGETED.has(item.effect_type) ? 'Use on…' : 'Use'}
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
