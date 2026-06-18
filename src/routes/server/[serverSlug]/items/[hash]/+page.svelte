<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';
	import { ITEM_EFFECTS, TARGETED_EFFECTS as TARGETED, effectLabel, effectSummary, describeItemOutcome, type ItemOutcome } from '$lib/items.js';

	let { data }: PageProps = $props();

	let view = $state<'shop' | 'bag'>('shop');
	let activeType = $state('all');

	const typeTabs = $derived.by(() => {
		const present = new Set((data.items ?? []).map((i: any) => i.effect_type));
		const ordered = ITEM_EFFECTS.filter((e) => present.has(e.id));
		return [{ id: 'all', label: 'All', icon: 'fa-grip' }, ...ordered.map((e) => ({ id: e.id, label: e.label, icon: e.icon }))];
	});
	let busy = $state<number | null>(null);
	let pickingTargetFor = $state<any | null>(null);

	let now = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	function remainingLabel(untilMs: number): string {
		const s = Math.max(0, Math.floor((untilMs - now) / 1000));
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	const EFFECT_ICON: Record<string, { icon: string; label: string }> = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, { icon: e.icon, label: e.label }]));

	const activeChips = $derived.by(() => {
		const chips: { key: string; icon: string; label: string; until: number; tone: string }[] = [];
		for (const e of (data.activeEffects ?? []) as any[]) {
			if (!e.expiresAt || e.expiresAt <= now) continue;
			const meta = EFFECT_ICON[e.effect_type];
			chips.push({
				key: `eff-${e.effect_type}-${e.expiresAt}`,
				icon: meta?.icon ?? 'fa-star',
				label: meta?.label ?? e.effect_type,
				until: e.expiresAt,
				tone: 'good'
			});
		}
		if (data.immuneUntil && data.immuneUntil > now) {
			chips.push({ key: 'immune', icon: 'fa-shield-halved', label: 'Immune', until: data.immuneUntil, tone: 'good' });
		}
		if (data.cooldownUntil && data.cooldownUntil > now) {
			chips.push({ key: 'cooldown', icon: 'fa-hourglass-half', label: 'Attack cooldown', until: data.cooldownUntil, tone: 'wait' });
		}
		return chips.sort((a, b) => a.until - b.until);
	});

	let liveXp = $state(data.balance?.experience ?? 0);
	let level = $state(data.balance?.level ?? 1);
	let rank = $state(data.balance?.rank ?? null);

	function setXp(next: number) {
		liveXp = next;
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
	});

	function fmt(n: number): string {
		return Number(n ?? 0).toLocaleString();
	}

	const memberAvatar = $derived(data.memberAvatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(data.memberDiscordId) % 5 || 0}.png`);

	function xpForLevel(lvl: number): number {
		if (lvl <= 1) return 0;
		const { baseXp, multiplier } = data.levelReq ?? { baseXp: 100, multiplier: 1.2 };
		if (multiplier === 1) return baseXp * (lvl - 1);
		return Math.floor((baseXp * (Math.pow(multiplier, lvl - 1) - 1)) / (multiplier - 1));
	}

	const levelInfo = $derived.by(() => {
		const floor = xpForLevel(level);
		const next = xpForLevel(level + 1);
		const span = Math.max(1, next - floor);
		const gained = Math.max(0, liveXp - floor);
		const pct = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
		return { floor, next, span, gained, pct, toNext: Math.max(0, next - liveXp) };
	});

	const visibleItems = $derived(activeType === 'all' ? data.items : data.items.filter((i: any) => i.effect_type === activeType));

	function canAfford(item: any): boolean {
		if (!data.valid) return true;
		return liveXp >= (Number(item.cost) || 0);
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

	const SELF_BUFFS = new Set(['boost', 'shield', 'reflect', 'insurance']);
	function isBuffActive(effectType: string): boolean {
		if (!SELF_BUFFS.has(effectType)) return false;
		return ((data.activeEffects ?? []) as any[]).some((e) => e.effect_type === effectType && e.expiresAt && e.expiresAt > now);
	}

	function onUse(item: any) {
		if (isBuffActive(item.effect_type)) {
			showToast(`${effectLabel(item.effect_type)} is already active`, 'error');
			return;
		}
		if (TARGETED.has(item.effect_type)) pickingTargetFor = item;
		else use(item);
	}

	let outcome = $state<ItemOutcome | null>(null);
	let outcomeTimer: ReturnType<typeof setTimeout> | null = null;

	function showOutcome(effectType: string, result: any) {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = describeItemOutcome(effectType, result);
		outcomeTimer = setTimeout(() => (outcome = null), 3500);
	}

	function dismissOutcome() {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = null;
	}

	function untilLabel(ms: number | null): string {
		if (!ms) return '';
		const d = new Date(ms);
		return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
				pickingTargetFor = null;
				await invalidateAll();
				showOutcome(item.effect_type, d.result ?? { outcome: d.outcome });
			} else showToast(d.error || 'Failed to use item', 'error');
		} finally {
			busy = null;
		}
	}

	const WAGER_PERCENTS = [25, 50, 75, 100];
	let gambleItem = $state<any | null>(null);
	let gamblePercent = $state<number | 'custom'>(25);
	let gambleCustom = $state<number | null>(null);
	let gambleRolling = $state(false);
	let reel = $state<string[]>([]);
	let reelOffset = $state(0);
	let reelResult = $state<'win' | 'lose' | null>(null);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	function randomCells(n: number): ('win' | 'lose')[] {
		return Array.from({ length: n }, () => (Math.random() < 0.5 ? 'win' : 'lose'));
	}

	function openGamble(item: any) {
		if (!data.valid) return;
		gambleItem = item;
		gamblePercent = 25;
		gambleCustom = null;
		reel = randomCells(12);
		reelOffset = 0;
		reelResult = null;
	}

	const wagerXp = $derived(
		gamblePercent === 'custom' ? Math.min(Math.max(0, Math.floor(Number(gambleCustom) || 0)), liveXp) : Math.floor((liveXp * (gamblePercent as number)) / 100)
	);

	async function playGamble() {
		const item = gambleItem;
		if (!item || gambleRolling) return;
		if (wagerXp <= 0) {
			showToast('Not enough XP to wager', 'error');
			return;
		}
		gambleRolling = true;
		reelResult = null;
		try {
			const body =
				gamblePercent === 'custom' ? { card: data.hash, item_id: item.id, amount: wagerXp } : { card: data.hash, item_id: item.id, percent: gamblePercent };
			const res = await fetch(`/api/public-statistics/${encodeURIComponent(data.server.slug)}/items/gamble`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const d = await res.json();
			if (!d.success) {
				showToast(d.error || 'Gamble failed', 'error');
				gambleRolling = false;
				return;
			}
			const won = !!d.result?.won;
			const landIndex = 32;
			const cells = randomCells(40);
			cells[landIndex] = won ? 'win' : 'lose';
			reel = cells;
			reelOffset = 0;
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cellEls = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell');
			const target = cellEls?.[landIndex];
			if (target) {
				const cellCenter = target.offsetLeft + target.offsetWidth / 2;
				reelOffset = wrapW / 2 - cellCenter;
			}
			setTimeout(async () => {
				reelResult = won ? 'win' : 'lose';
				await invalidateAll();
				gambleRolling = false;
				setTimeout(() => {
					gambleItem = null;
					reel = [];
					reelResult = null;
					showOutcome('gamble', d.result);
				}, 900);
			}, 3600);
		} catch {
			showToast('Gamble failed', 'error');
			gambleRolling = false;
		}
	}
</script>

<svelte:head><title>Items · {data.server.name}</title></svelte:head>

<div class="m-items">
	{#if data.valid}
		<!-- XP balance header -->
		<div class="m-xp">
			<div class="m-xp-glow"></div>
			<div class="m-xp-avatar">
				<img src={memberAvatar} alt={data.memberName ?? ''} loading="lazy" />
			</div>
			<div class="m-xp-figures">
				<span class="m-xp-wallet"><i class="fas fa-wallet"></i>Wallet</span>
				{#if data.memberName}<span class="m-xp-name">{data.memberName}</span>{/if}
				<span class="m-xp-amount">{fmt(liveXp)}<span class="m-xp-unit">XP</span></span>
				<div class="m-xp-bar">
					<div class="m-xp-bar-fill" style="width: {levelInfo.pct}%"></div>
				</div>
				<span class="m-xp-bar-meta">
					<span>Lvl {level}</span>
					<span>{levelInfo.toNext > 0 ? `${fmt(levelInfo.toNext)} XP to Lvl ${level + 1}` : 'Max progress'}</span>
				</span>
			</div>
			<div class="m-xp-stats">
				<div class="m-xp-stat">
					<span class="m-xp-stat-val">{levelInfo.pct}%</span>
					<span class="m-xp-stat-lbl">Level {level}</span>
				</div>
				{#if rank}
					<div class="m-xp-stat">
						<span class="m-xp-stat-val">#{rank}</span>
						<span class="m-xp-stat-lbl">Rank</span>
					</div>
				{/if}
			</div>
		</div>

		{#if activeChips.length > 0}
			<div class="m-active">
				{#each activeChips as chip (chip.key)}
					<span class="m-active-chip m-active-chip--{chip.tone}">
						<i class="fas {chip.icon}"></i>
						<span class="m-active-label">{chip.label}</span>
						<span class="m-active-time">{remainingLabel(chip.until)}</span>
					</span>
				{/each}
			</div>
		{/if}
	{/if}

	<div class="m-items-bar">
		<div class="m-items-toggle">
			<button class="m-items-seg" class:m-items-seg--active={view === 'shop'} onclick={() => (view = 'shop')}><i class="fas fa-store"></i>Shop</button>
			<button class="m-items-seg" class:m-items-seg--active={view === 'bag'} onclick={() => (view = 'bag')} disabled={!data.valid}>
				<i class="fas fa-bag-shopping"></i>Bag{#if data.valid}<span class="m-items-count">{data.inventory.length}</span>{/if}
			</button>
		</div>
	</div>

	{#if !data.valid}
		<p class="m-items-anon">
			<i class="fas fa-circle-info"></i>
			Browsing read-only. Open <strong>Items</strong> from the bot menu to buy and use.
		</p>
	{/if}

	{#if view === 'shop'}
		<div class="m-items-tabs">
			{#each typeTabs as cat}
				<button class="m-items-tab" class:m-items-tab--active={activeType === cat.id} onclick={() => (activeType = cat.id)}>
					<i class="fas {cat.icon}"></i>{cat.label}
				</button>
			{/each}
		</div>

		{#if visibleItems.length === 0}
			<div class="m-members-empty">No items in this category.</div>
		{:else}
			<ul class="m-items-list">
				{#each visibleItems as item (item.id)}
					{@const affordable = canAfford(item)}
					<li class="m-row" class:m-row--locked={!affordable} class:m-row--burst={burstId === item.id} data-cat={item.effect_type}>
						<span class="m-row-medallion">{item.icon || '🎁'}</span>
						<div class="m-row-body">
							<span class="m-row-name">{item.name}</span>
							<span class="m-row-desc">{item.description || effectSummary(item)}</span>
						</div>
						<div class="m-row-action">
							{#if item.effect_type === 'gamble'}
								<button class="m-row-btn m-row-btn--play" disabled={!data.valid} onclick={() => openGamble(item)}>
									<i class="fas fa-dice"></i>Play
								</button>
							{:else}
								<span class="m-row-cost" class:m-row-cost--short={!affordable}><i class="fas fa-star"></i>{fmt(item.cost)}</span>
								<button class="m-row-btn" disabled={busy === item.id || !data.valid || !affordable} onclick={() => buy(item)}>
									{#if busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else if !affordable}<i class="fas fa-lock"></i>{:else}<i
											class="fas fa-cart-plus"
										></i>{/if}
									{affordable ? 'Buy' : 'Locked'}
								</button>
							{/if}
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
		<ul class="m-items-list">
			{#each data.inventory as item (item.member_item_id)}
				<li class="m-row" data-cat={item.effect_type}>
					<span class="m-row-medallion">{item.icon || '🎁'}<span class="m-row-qty">×{item.quantity}</span></span>
					<div class="m-row-body">
						<span class="m-row-name">{item.name}</span>
						<span class="m-row-desc">{item.description || effectSummary(item)}</span>
					</div>
					<div class="m-row-action">
						{#if isBuffActive(item.effect_type)}
							<button class="m-row-btn m-row-btn--use" disabled><i class="fas fa-check"></i>Active</button>
						{:else}
							<button class="m-row-btn m-row-btn--use" disabled={busy === item.member_item_id || item.quantity <= 0} onclick={() => onUse(item)}>
								{#if busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else if TARGETED.has(item.effect_type)}<i class="fas fa-crosshairs"
									></i>{:else}<i class="fas fa-bolt"></i>{/if}
								{TARGETED.has(item.effect_type) ? 'Use' : 'Use'}
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if gambleItem}
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!gambleRolling ? (gambleItem = null) : null)}>
		<div class="m-gamble" role="dialog" aria-modal="true" aria-label="Gamble" onclick={(e) => e.stopPropagation()}>
			<div class="m-gamble-head">
				<span class="m-gamble-title"><span class="m-gamble-ico">{gambleItem.icon || '🎲'}</span>{gambleItem.name}</span>
				{#if !gambleRolling}<button class="m-gamble-x" aria-label="Close" onclick={() => (gambleItem = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div
				bind:this={reelWrapEl}
				class="m-gamble-reelwrap"
				class:m-gamble-reelwrap--win={reelResult === 'win'}
				class:m-gamble-reelwrap--lose={reelResult === 'lose'}
			>
				<div class="m-gamble-pointer"></div>
				<div
					class="m-gamble-reel"
					style="transform: translateX({reelOffset}px); transition: {reelOffset === 0 ? 'none' : 'transform 3.5s cubic-bezier(0.12, 0.8, 0.16, 1)'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-gamble-cell m-gamble-cell--{cell}">{cell === 'win' ? '🤑' : '💀'}</div>
					{/each}
				</div>
			</div>

			<div class="m-gamble-picker">
				{#each WAGER_PERCENTS as p}
					<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === p} disabled={gambleRolling} onclick={() => (gamblePercent = p)}
						>{p}%</button
					>
				{/each}
				<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === 'custom'} disabled={gambleRolling} onclick={() => (gamblePercent = 'custom')}
					>Custom</button
				>
			</div>
			{#if gamblePercent === 'custom'}
				<input class="m-gamble-custom" type="number" min="1" max={liveXp} placeholder="Enter XP to wager" bind:value={gambleCustom} disabled={gambleRolling} />
			{/if}
			<p class="m-gamble-wager">Wagering <strong>{fmt(wagerXp)} XP</strong> of {fmt(liveXp)}</p>
			<button class="m-gamble-play" disabled={gambleRolling || wagerXp <= 0} onclick={playGamble}>
				{#if gambleRolling}<i class="fas fa-spinner fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Gamble{/if}
			</button>
		</div>
	</div>
{/if}

{#if outcome}
	<div class="m-out-overlay" role="presentation" onclick={dismissOutcome}>
		<div class="m-out m-out--{outcome.tone}" role="dialog" aria-modal="true" aria-label={outcome.title} onclick={(e) => e.stopPropagation()}>
			<div class="m-out-emoji">{outcome.emoji}</div>
			<div class="m-out-title">{outcome.title}</div>
			{#if outcome.deltaXp != null && outcome.deltaXp !== 0}
				<div class="m-out-delta {outcome.deltaXp >= 0 ? 'm-out-delta--up' : 'm-out-delta--down'}">
					{outcome.deltaXp >= 0 ? '+' : '−'}{fmt(Math.abs(outcome.deltaXp))} XP
				</div>
			{/if}
			<p class="m-out-line">{outcome.line}</p>
			{#if outcome.untilMs}
				<div class="m-out-until"><i class="fas fa-clock"></i>Active until {untilLabel(outcome.untilMs)}</div>
			{/if}
		</div>
	</div>
{/if}
