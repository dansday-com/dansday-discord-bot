<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	let board = $state<any[]>(data.board ?? []);
	let positions = $state<any[]>(data.positions ?? []);
	let lastSync = $state(Date.now());

	$effect(() => {
		board = data.board ?? [];
		positions = data.positions ?? [];
	});

	const priceMap = $derived.by(() => {
		const m = new Map<string, { price: number; change24h: number }>();
		for (const r of board) m.set(`${r.asset_type}:${r.asset_id}`, { price: r.price, change24h: r.change24h });
		return m;
	});

	const gainers = $derived([...board].filter((r) => Number.isFinite(r.change24h)).sort((a, b) => b.change24h - a.change24h));
	const losers = $derived([...board].filter((r) => Number.isFinite(r.change24h)).sort((a, b) => a.change24h - b.change24h));

	const livePositions = $derived(
		positions.map((p) => {
			const live = priceMap.get(`${p.asset_type}:${p.asset_id}`);
			const price = live?.price ?? p.current_price ?? p.buy_price;
			const value = p.buy_price > 0 ? Math.round(p.xp_invested * (price / p.buy_price)) : p.xp_invested;
			return {
				...p,
				current_price: price,
				change24h: live?.change24h ?? p.change24h,
				value,
				pnl: value - p.xp_invested,
				pnl_percent: p.xp_invested > 0 ? ((value - p.xp_invested) / p.xp_invested) * 100 : 0
			};
		})
	);

	const totalInvested = $derived(livePositions.reduce((s, p) => s + p.xp_invested, 0));
	const totalValue = $derived(livePositions.reduce((s, p) => s + p.value, 0));
	const totalPnl = $derived(totalValue - totalInvested);
	const totalPnlPct = $derived(totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0);

	$effect(() => {
		ctx.setAssetSummary?.({ invested: totalInvested, value: totalValue, pnl: totalPnl, pnlPct: totalPnlPct, count: livePositions.length });
		return () => ctx.setAssetSummary?.(null);
	});

	function fmtPrice(n: number): string {
		const v = Number(n) || 0;
		if (v >= 100) return `Rp${Math.round(v).toLocaleString('id-ID')}`;
		if (v >= 1) return `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
		return `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 6 })}`;
	}
	function pctText(n: number): string {
		const v = Number(n) || 0;
		return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
	}
	function dir(n: number): 'up' | 'down' | 'flat' {
		if (n > 0) return 'up';
		if (n < 0) return 'down';
		return 'flat';
	}

	function sparkPath(prices: number[], w = 72, h = 24): string {
		if (!prices || prices.length < 2) return '';
		const min = Math.min(...prices);
		const max = Math.max(...prices);
		const span = max - min || 1;
		const step = w / (prices.length - 1);
		return prices.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`).join(' ');
	}

	async function refresh() {
		try {
			const res = await fetch(`/api/assets/${encodeURIComponent(ctx.serverSlug)}/board`);
			if (!res.ok) return;
			const d = await res.json();
			if (Array.isArray(d.board)) {
				board = d.board;
				lastSync = Date.now();
			}
		} catch {}
	}
	$effect(() => {
		const t = setInterval(refresh, 20_000);
		return () => clearInterval(t);
	});

	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		const q = searchQuery.trim();
		if (!q) {
			searchResults = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				const res = await fetch(`/api/assets/${encodeURIComponent(ctx.serverSlug)}/search?q=${encodeURIComponent(q)}`);
				const d = await res.json();
				searchResults = d.success ? d.results : [];
			} catch {
				searchResults = [];
			} finally {
				searching = false;
			}
		}, 300);
	}

	let buyAsset = $state<any | null>(null);
	let buyAmount = $state<number | null>(null);
	let buyBusy = $state(false);

	const BUY_PCTS = [25, 50, 75, 100];
	function setBuyPct(p: number) {
		buyAmount = Math.floor((ctx.liveXp * p) / 100);
	}

	function openBuy(asset: any) {
		buyAsset = asset;
		buyAmount = null;
	}

	$effect(() => {
		if (buyAsset === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	async function confirmBuy() {
		const asset = buyAsset;
		if (!asset || buyBusy) return;
		const amount = Math.floor(Number(buyAmount) || 0);
		if (amount <= 0) {
			showToast('Enter an XP amount', 'error');
			return;
		}
		if (amount > ctx.liveXp) {
			showToast('Not enough XP', 'error');
			return;
		}
		buyBusy = true;
		try {
			const res = await fetch(`/api/assets/${encodeURIComponent(ctx.serverSlug)}/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, asset_type: asset.asset_type || 'crypto', asset_id: asset.asset_id, xp_amount: amount })
			});
			const d = await res.json();
			if (d.success) {
				ctx.setLiveXp(Math.max(0, ctx.liveXp - amount));
				showToast(`Bought ${asset.symbol} with ${fmt(amount)} XP`, 'success');
				buyAsset = null;
				await ctx.invalidateAll();
			} else showToast(d.error || 'Buy failed', 'error');
		} catch {
			showToast('Buy failed', 'error');
		} finally {
			buyBusy = false;
		}
	}

	let sellBusy = $state<number | null>(null);
	async function sell(position: any) {
		if (sellBusy) return;
		sellBusy = position.id;
		try {
			const res = await fetch(`/api/assets/${encodeURIComponent(ctx.serverSlug)}/sell`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, position_id: position.id })
			});
			const d = await res.json();
			if (d.success) {
				ctx.setLiveXp(ctx.liveXp + (Number(d.payout) || 0));
				const net = Number(d.net) || 0;
				showToast(`Sold ${position.symbol} · ${net >= 0 ? '+' : ''}${fmt(net)} XP`, net >= 0 ? 'success' : 'error');
				await ctx.invalidateAll();
			} else showToast(d.error || 'Sell failed', 'error');
		} catch {
			showToast('Sell failed', 'error');
		} finally {
			sellBusy = null;
		}
	}

	const listForTab = $derived(data.category === 'gainers' ? gainers : data.category === 'losers' ? losers : board);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Assets | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet assetRow(a: any, showBuy = true)}
	{@const live = priceMap.get(`${a.asset_type}:${a.asset_id}`)}
	{@const price = live?.price ?? a.price ?? 0}
	{@const change = live?.change24h ?? a.change24h ?? 0}
	<article class="m-asset-row" data-dir={dir(change)}>
		<div class="m-asset-id">
			{#if a.image}<img class="m-asset-logo" src={a.image} alt="" loading="lazy" />{:else}<span class="m-asset-logo m-asset-logo--ph"
					>{(a.symbol || '?').slice(0, 1)}</span
				>{/if}
			<div class="m-asset-name">
				<span class="m-asset-sym">{a.symbol}</span>
				<span class="m-asset-full">{a.name}</span>
			</div>
		</div>

		{#if a.sparkline?.length > 1}
			<svg class="m-asset-spark" viewBox="0 0 72 24" preserveAspectRatio="none" aria-hidden="true">
				<path d={sparkPath(a.sparkline)} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{/if}

		<div class="m-asset-fig">
			<span class="m-asset-price">{fmtPrice(price)}</span>
			<span class="m-asset-chg" data-dir={dir(change)}>
				<i class="fas fa-caret-{change >= 0 ? 'up' : 'down'}"></i>{pctText(change)}
			</span>
		</div>

		{#if showBuy}
			{#if ctx.readOnly}
				<button class="m-asset-buy" disabled title="Open your card to trade"><i class="fas fa-eye"></i></button>
			{:else}
				<button class="m-asset-buy" onclick={() => openBuy(a)} aria-label="Buy {a.symbol}"><i class="fas fa-plus"></i></button>
			{/if}
		{/if}
	</article>
{/snippet}

{#if data.category === 'positions'}
	{#if livePositions.length === 0}
		<div class="m-members-empty">You don't hold any assets yet. Open the Top or Search tab to invest XP.</div>
	{:else}
		<div class="m-asset-list">
			{#each livePositions as p (p.id)}
				<article class="m-asset-pos" data-dir={dir(p.pnl)}>
					<div class="m-asset-id">
						{#if p.asset_image}<img class="m-asset-logo" src={p.asset_image} alt="" loading="lazy" />{:else}<span class="m-asset-logo m-asset-logo--ph"
								>{(p.symbol || '?').slice(0, 1)}</span
							>{/if}
						<div class="m-asset-name">
							<span class="m-asset-sym">{p.symbol}</span>
							<span class="m-asset-full">{fmt(p.xp_invested)} XP @ {fmtPrice(p.buy_price)}</span>
						</div>
					</div>
					<div class="m-asset-pos-fig">
						<span class="m-asset-price">{fmt(p.value)} XP</span>
						<span class="m-asset-chg" data-dir={dir(p.pnl)}>
							<i class="fas fa-caret-{p.pnl >= 0 ? 'up' : 'down'}"></i>{p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)} ({pctText(p.pnl_percent)})
						</span>
					</div>
					{#if !ctx.readOnly}
						<button class="m-asset-sell" disabled={sellBusy === p.id} onclick={() => sell(p)}>
							{#if sellBusy === p.id}<i class="fas fa-spinner fa-spin"></i>{:else}Sell{/if}
						</button>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
{:else if data.category === 'search'}
	<div class="m-asset-search">
		<i class="fas fa-magnifying-glass"></i>
		<input type="text" placeholder="Search any coin (BTC, ETH, SOL…)" bind:value={searchQuery} oninput={onSearchInput} />
		{#if searching}<i class="fas fa-spinner fa-spin m-asset-search-spin"></i>{/if}
	</div>
	{#if searchResults.length === 0}
		<div class="m-members-empty">{searchQuery.trim() ? (searching ? 'Searching…' : 'No coins found.') : 'Type to search thousands of coins.'}</div>
	{:else}
		<div class="m-asset-list">
			{#each searchResults as a (a.asset_id)}
				{@render assetRow(a)}
			{/each}
		</div>
	{/if}
{:else if listForTab.length === 0}
	<div class="m-members-empty">Market data is loading…</div>
{:else}
	<div class="m-asset-list">
		{#each listForTab as a (a.asset_id)}
			{@render assetRow(a)}
		{/each}
	</div>
{/if}

{#if buyAsset}
	{@const live = priceMap.get(`${buyAsset.asset_type}:${buyAsset.asset_id}`)}
	{@const price = live?.price ?? buyAsset.price ?? 0}
	{@const change = live?.change24h ?? buyAsset.change24h ?? 0}
	<div class="m-asset-overlay" role="presentation" onclick={() => (!buyBusy ? (buyAsset = null) : null)}>
		<div class="m-asset-modal" role="dialog" aria-modal="true" aria-label="Buy asset" onclick={(e) => e.stopPropagation()}>
			<div class="m-asset-modal-head">
				<div class="m-asset-id">
					{#if buyAsset.image}<img class="m-asset-logo" src={buyAsset.image} alt="" />{:else}<span class="m-asset-logo m-asset-logo--ph"
							>{(buyAsset.symbol || '?').slice(0, 1)}</span
						>{/if}
					<div class="m-asset-name">
						<span class="m-asset-sym">{buyAsset.symbol}</span>
						<span class="m-asset-full">{buyAsset.name}</span>
					</div>
				</div>
				<button class="m-asset-x" aria-label="Close" onclick={() => (buyAsset = null)}><i class="fas fa-times"></i></button>
			</div>

			<div class="m-asset-modal-price">
				<span class="m-asset-modal-p">{fmtPrice(price)}</span>
				<span class="m-asset-chg" data-dir={dir(change)}><i class="fas fa-caret-{change >= 0 ? 'up' : 'down'}"></i>{pctText(change)} · 24h</span>
			</div>

			<div class="m-asset-pcts">
				{#each BUY_PCTS as p}
					<button class="m-asset-pct" onclick={() => setBuyPct(p)}>{p === 100 ? 'Max' : `${p}%`}</button>
				{/each}
			</div>
			<input class="m-asset-input" type="number" min="1" max={ctx.liveXp} placeholder="XP to invest" bind:value={buyAmount} disabled={buyBusy} />

			<div class="m-asset-modal-meta">
				<span>Balance: {fmt(ctx.liveXp)} XP</span>
				<span>≈ {buyAmount && price > 0 ? (Number(buyAmount) / price).toPrecision(4) : '0'} {buyAsset.symbol}</span>
			</div>

			<button class="m-asset-confirm" disabled={buyBusy || !buyAmount || Number(buyAmount) <= 0 || Number(buyAmount) > ctx.liveXp} onclick={confirmBuy}>
				{#if buyBusy}<i class="fas fa-circle-notch fa-spin"></i>Buying…{:else}<i class="fas fa-arrow-trend-up"></i>Invest {buyAmount
						? `${fmt(Number(buyAmount))} XP`
						: ''}{/if}
			</button>
		</div>
	</div>
{/if}
