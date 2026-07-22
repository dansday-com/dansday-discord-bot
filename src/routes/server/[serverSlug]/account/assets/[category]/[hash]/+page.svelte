<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	let outcome = $state<{ tone: 'win' | 'lose' | 'neutral'; icon: string; title: string; line: string; deltaXp: number | null } | null>(null);
	let outcomeTimer: ReturnType<typeof setTimeout> | null = null;
	function showOutcome(o: { tone: 'win' | 'lose' | 'neutral'; icon: string; title: string; line: string; deltaXp: number | null }) {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = o;
		outcomeTimer = setTimeout(() => (outcome = null), 3500);
	}
	function dismissOutcome() {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = null;
	}
	$effect(() => {
		if (outcome === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	function grp(n: number | null): string {
		return n == null || !Number.isFinite(n) ? '' : Math.floor(n).toLocaleString();
	}
	function onAmountInput(e: Event, set: (v: number | null) => void) {
		const digits = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '');
		set(digits === '' ? null : Number(digits));
	}

	let board = $state<any[]>(data.board ?? []);
	let gainers = $state<any[]>(data.gainers ?? []);
	let losers = $state<any[]>(data.losers ?? []);
	let positions = $state<any[]>(data.positions ?? []);

	$effect(() => {
		board = data.board ?? [];
		gainers = data.gainers ?? [];
		losers = data.losers ?? [];
		positions = data.positions ?? [];
	});

	const priceMap = $derived.by(() => {
		const m = new Map<string, { price: number; change24h: number }>();
		for (const r of [...board, ...gainers, ...losers]) m.set(`${r.asset_type}:${r.asset_id}`, { price: r.price, change24h: r.change24h });
		return m;
	});

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
	function fmtUnits(qty: number): string {
		const v = Number(qty) || 0;
		if (v <= 0) return '0';
		if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
		if (v >= 0.0001) return v.toFixed(6);
		return v.toFixed(8);
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
				if (!d.success && d.error) showToast(d.error, 'error');
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
	const MIN_BUY = 10_000;
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
				buyAsset = null;
				showOutcome({
					tone: 'neutral',
					icon: 'fa-arrow-trend-up',
					title: `Bought ${asset.symbol}`,
					line: `Invested in ${asset.name || asset.symbol}.`,
					deltaXp: -amount
				});
				await ctx.invalidateAll();
			} else showOutcome({ tone: 'lose', icon: 'fa-triangle-exclamation', title: 'Buy failed', line: d.error || 'Please try again.', deltaXp: null });
		} catch {
			showOutcome({ tone: 'lose', icon: 'fa-triangle-exclamation', title: 'Buy failed', line: 'Please try again.', deltaXp: null });
		} finally {
			buyBusy = false;
		}
	}

	let sellPos = $state<any | null>(null);
	let sellAmount = $state<number | null>(null);
	let sellBusy = $state(false);

	const SELL_PCTS = [25, 50, 75, 100];

	function sellPosValue(p: any): number {
		const live = priceMap.get(`${p.asset_type}:${p.asset_id}`);
		const price = live?.price ?? p.current_price ?? p.buy_price ?? 0;
		return p.buy_price > 0 ? Math.round(p.xp_invested * (price / p.buy_price)) : p.xp_invested;
	}

	function setSellPct(pct: number) {
		if (!sellPos) return;
		sellAmount = Math.floor((sellPosValue(sellPos) * pct) / 100);
	}

	function openSell(p: any) {
		sellPos = p;
		sellAmount = null;
	}

	$effect(() => {
		if (sellPos === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	async function confirmSell() {
		const p = sellPos;
		if (!p || sellBusy) return;
		const amount = Math.floor(Number(sellAmount) || 0);
		if (amount <= 0) {
			showToast('Enter an XP amount', 'error');
			return;
		}
		sellBusy = true;
		try {
			const res = await fetch(`/api/assets/${encodeURIComponent(ctx.serverSlug)}/sell`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, position_id: p.id, amount })
			});
			const d = await res.json();
			if (d.success) {
				const payoutXp = Number(d.payout) || 0;
				const net = Number(d.net) || 0;
				ctx.setLiveXp(ctx.liveXp + payoutXp);
				sellPos = null;
				showOutcome({
					tone: net >= 0 ? 'win' : 'lose',
					icon: net >= 0 ? 'fa-hand-holding-dollar' : 'fa-arrow-trend-down',
					title: `Sold ${p.symbol}`,
					line: `Cashed out for ${fmt(payoutXp)} XP.`,
					deltaXp: net
				});
				await ctx.invalidateAll();
			} else showOutcome({ tone: 'lose', icon: 'fa-triangle-exclamation', title: 'Sell failed', line: d.error || 'Please try again.', deltaXp: null });
		} catch {
			showOutcome({ tone: 'lose', icon: 'fa-triangle-exclamation', title: 'Sell failed', line: 'Please try again.', deltaXp: null });
		} finally {
			sellBusy = false;
		}
	}

	const listForTab = $derived(data.category === 'gainers' ? gainers : data.category === 'losers' ? losers : board);
</script>

<svelte:head><title>{data.server.name || data.server.slug} Assets | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet assetRow(a: any)}
	{@const live = priceMap.get(`${a.asset_type}:${a.asset_id}`)}
	{@const price = live?.price ?? a.price ?? 0}
	{@const change = live?.change24h ?? a.change24h ?? 0}
	<button
		type="button"
		class="m-asset-row"
		data-dir={dir(change)}
		disabled={ctx.readOnly}
		onclick={() => !ctx.readOnly && openBuy(a)}
		aria-label="Buy {a.symbol}"
	>
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
	</button>
{/snippet}

{#if data.category === 'mine'}
	{#if livePositions.length === 0}
		<div class="m-members-empty">You don't hold any assets yet. Open the Top or Search tab to invest XP.</div>
	{:else}
		<div class="m-asset-list">
			{#each livePositions as p (p.id)}
				<button
					type="button"
					class="m-asset-row"
					data-dir={dir(p.pnl)}
					disabled={ctx.readOnly}
					onclick={() => !ctx.readOnly && openSell(p)}
					aria-label="Sell {p.symbol}"
				>
					<div class="m-asset-id">
						{#if p.asset_image}<img class="m-asset-logo" src={p.asset_image} alt="" loading="lazy" />{:else}<span class="m-asset-logo m-asset-logo--ph"
								>{(p.symbol || '?').slice(0, 1)}</span
							>{/if}
						<div class="m-asset-name">
							<span class="m-asset-sym">{p.symbol}</span>
							<span class="m-asset-full">{fmtUnits(p.buy_price > 0 ? p.xp_invested / p.buy_price : 0)} {p.symbol}</span>
						</div>
					</div>
					<div class="m-asset-fig">
						<span class="m-asset-price">{fmt(p.value)} XP</span>
						<span class="m-asset-chg" data-dir={dir(p.pnl)}>
							<i class="fas fa-caret-{p.pnl >= 0 ? 'up' : 'down'}"></i>{p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)} ({pctText(p.pnl_percent)})
						</span>
					</div>
				</button>
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
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!buyBusy ? (buyAsset = null) : null)}>
		<div class="m-gamble" role="dialog" aria-modal="true" aria-label="Buy asset" onclick={(e) => e.stopPropagation()}>
			<div class="m-gamble-head">
				<span class="m-gamble-title">
					<span class="m-gamble-ico m-gamble-ico--asset">
						{#if buyAsset.image}<img src={buyAsset.image} alt="" />{:else}{(buyAsset.symbol || '?').slice(0, 1)}{/if}
					</span>{buyAsset.symbol}
				</span>
				{#if !buyBusy}<button class="m-gamble-x" aria-label="Close" onclick={() => (buyAsset = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div class="m-asset-modal-price">
				<span class="m-asset-modal-p">{fmtPrice(price)}</span>
				<span class="m-asset-chg" data-dir={dir(change)}><i class="fas fa-caret-{change >= 0 ? 'up' : 'down'}"></i>{pctText(change)} · 24h</span>
			</div>

			<div class="m-gamble-picker">
				{#each BUY_PCTS as p}
					<button class="m-gamble-pct" disabled={buyBusy} onclick={() => setBuyPct(p)}>{p === 100 ? 'Max' : `${p}%`}</button>
				{/each}
			</div>
			<input
				class="m-gamble-custom"
				type="text"
				inputmode="numeric"
				placeholder="XP to invest (min {fmt(MIN_BUY)})"
				value={grp(buyAmount)}
				oninput={(e) => onAmountInput(e, (v) => (buyAmount = v))}
				disabled={buyBusy}
			/>

			<div class="m-asset-modal-meta">
				<span>Balance: {fmt(ctx.liveXp)} XP</span>
				<span>≈ {buyAmount && price > 0 ? fmtUnits(Number(buyAmount) / price) : '0'} {buyAsset.symbol}</span>
			</div>

			<button
				class="m-gamble-play m-gamble-play--charged"
				disabled={buyBusy || !buyAmount || Number(buyAmount) < MIN_BUY || Number(buyAmount) > ctx.liveXp}
				onclick={confirmBuy}
			>
				{#if buyBusy}<i class="fas fa-circle-notch fa-spin"></i>Buying…{:else}<i class="fas fa-arrow-trend-up"></i>Invest {buyAmount
						? `${fmt(Number(buyAmount))} XP`
						: ''}{/if}
			</button>
		</div>
	</div>
{/if}

{#if sellPos}
	{@const live = priceMap.get(`${sellPos.asset_type}:${sellPos.asset_id}`)}
	{@const price = live?.price ?? sellPos.current_price ?? sellPos.buy_price ?? 0}
	{@const value = sellPos.buy_price > 0 ? Math.round(sellPos.xp_invested * (price / sellPos.buy_price)) : sellPos.xp_invested}
	{@const payout = Math.min(Math.max(0, Math.floor(Number(sellAmount) || 0)), value)}
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!sellBusy ? (sellPos = null) : null)}>
		<div class="m-gamble" role="dialog" aria-modal="true" aria-label="Sell asset" onclick={(e) => e.stopPropagation()}>
			<div class="m-gamble-head">
				<span class="m-gamble-title">
					<span class="m-gamble-ico m-gamble-ico--asset">
						{#if sellPos.asset_image}<img src={sellPos.asset_image} alt="" />{:else}{(sellPos.symbol || '?').slice(0, 1)}{/if}
					</span>{sellPos.symbol}
				</span>
				{#if !sellBusy}<button class="m-gamble-x" aria-label="Close" onclick={() => (sellPos = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div class="m-asset-modal-price">
				<span class="m-asset-modal-p">{fmt(value)} XP</span>
				<span class="m-asset-chg" data-dir={dir(sellPos.pnl)}
					><i class="fas fa-caret-{sellPos.pnl >= 0 ? 'up' : 'down'}"></i>{sellPos.pnl >= 0 ? '+' : ''}{fmt(sellPos.pnl)} XP</span
				>
			</div>

			<div class="m-gamble-picker">
				{#each SELL_PCTS as p}
					<button class="m-gamble-pct" disabled={sellBusy} onclick={() => setSellPct(p)}>{p === 100 ? 'All' : `${p}%`}</button>
				{/each}
			</div>
			<input
				class="m-gamble-custom"
				type="text"
				inputmode="numeric"
				placeholder="XP to cash out (max {fmt(value)})"
				value={grp(sellAmount)}
				oninput={(e) => onAmountInput(e, (v) => (sellAmount = v))}
				disabled={sellBusy}
			/>

			<div class="m-asset-modal-meta">
				<span>Worth: {fmt(value)} XP</span>
				<span>You receive {fmt(payout)} XP</span>
			</div>

			<button class="m-gamble-play m-gamble-play--charged" disabled={sellBusy || payout <= 0} onclick={confirmSell}>
				{#if sellBusy}<i class="fas fa-circle-notch fa-spin"></i>Selling…{:else}<i class="fas fa-hand-holding-dollar"></i>Sell {payout >= value ? 'all' : ''} · {fmt(
						payout
					)} XP{/if}
			</button>
		</div>
	</div>
{/if}

{#if outcome}
	<div class="m-out-overlay" role="presentation" onclick={dismissOutcome}>
		<div class="m-out m-out--{outcome.tone}" role="dialog" aria-modal="true" aria-label={outcome.title} onclick={(e) => e.stopPropagation()}>
			<div class="m-out-icon"><i class="fas {outcome.icon}"></i></div>
			<div class="m-out-title">{outcome.title}</div>
			{#if outcome.deltaXp != null && outcome.deltaXp !== 0}
				<div class="m-out-delta {outcome.deltaXp >= 0 ? 'm-out-delta--up' : 'm-out-delta--down'}">
					{outcome.deltaXp >= 0 ? '+' : '−'}{fmt(Math.abs(outcome.deltaXp))} XP
				</div>
			{/if}
			<p class="m-out-line">{outcome.line}</p>
		</div>
	</div>
{/if}
