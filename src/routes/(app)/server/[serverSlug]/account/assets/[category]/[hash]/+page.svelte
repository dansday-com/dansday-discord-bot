<script lang="ts">
	import { lockScroll } from '$lib/frontend/scrollLock.js';
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { EmptyState, GameModal, OutcomeModal } from '$lib/frontend/components/public';
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
		return lockScroll();
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
	function dirColor(n: number): string {
		if (n > 0) return '#1a7f57';
		if (n < 0) return '#b23b2e';
		return 'var(--color-base-content)';
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
	let buyPercent = $state<number | 'custom'>(25);
	let buyCustom = $state<number | null>(null);
	let buyBusy = $state(false);

	const BUY_PCTS = [25, 50, 75, 100];
	const MIN_BUY = 10_000;

	const buyAmount = $derived(
		buyPercent === 'custom' ? Math.min(Math.max(0, Math.floor(Number(buyCustom) || 0)), ctx.liveXp) : Math.floor((ctx.liveXp * (buyPercent as number)) / 100)
	);

	function openBuy(asset: any) {
		buyAsset = asset;
		buyPercent = 25;
		buyCustom = null;
	}

	$effect(() => {
		if (buyAsset === null) return;
		return lockScroll();
	});

	async function confirmBuy() {
		const asset = buyAsset;
		if (!asset || buyBusy) return;
		const amount = Math.floor(buyAmount || 0);
		if (amount < MIN_BUY) {
			showToast(`Minimum is ${fmt(MIN_BUY)} XP`, 'error');
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
				body: JSON.stringify({ card: ctx.hash, asset_type: asset.asset_type || 'crypto', asset_id: asset.asset_id, xp: amount })
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
	let sellPercent = $state<number | 'custom'>(25);
	let sellCustom = $state<number | null>(null);
	let sellBusy = $state(false);

	const SELL_PCTS = [25, 50, 75, 100];

	function sellPosValue(p: any): number {
		const live = priceMap.get(`${p.asset_type}:${p.asset_id}`);
		const price = live?.price ?? p.current_price ?? p.buy_price ?? 0;
		return p.buy_price > 0 ? Math.round(p.xp_invested * (price / p.buy_price)) : p.xp_invested;
	}

	const sellMax = $derived(sellPos ? sellPosValue(sellPos) : 0);
	const sellAmount = $derived(
		sellPercent === 'custom' ? Math.min(Math.max(0, Math.floor(Number(sellCustom) || 0)), sellMax) : Math.floor((sellMax * (sellPercent as number)) / 100)
	);

	function openSell(p: any) {
		sellPos = p;
		sellPercent = 25;
		sellCustom = null;
	}

	$effect(() => {
		if (sellPos === null) return;
		return lockScroll();
	});

	async function confirmSell() {
		const p = sellPos;
		if (!p || sellBusy) return;
		const amount = Math.floor(sellAmount || 0);
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

	const ROW_STYLE =
		'background: radial-gradient(130% 90% at 0% 50%, color-mix(in srgb, var(--dir) 12%, transparent), transparent 55%), linear-gradient(170deg, color-mix(in srgb, var(--dir) 6%, var(--color-base-100)), var(--color-base-100) 72%); border-color: color-mix(in srgb, var(--dir) 22%, var(--color-base-300));';
	const PCT_ACTIVE = 'border-transparent bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white shadow-[0_4px_12px_-5px_rgba(184,134,11,0.8)]';
</script>

<svelte:head><title>{data.server.name || data.server.slug} Assets | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet assetLogo(image: string | null, symbol: string, size: string)}
	{#if image}
		<img
			class="bg-base-300 shrink-0 rounded-full border object-cover {size}"
			style="border-color: color-mix(in srgb, var(--dir) 30%, var(--color-base-300));"
			src={image}
			alt=""
			loading="lazy"
		/>
	{:else}
		<span
			class="grid shrink-0 place-items-center rounded-full border text-sm font-extrabold text-(--dir) {size}"
			style="background: color-mix(in srgb, var(--dir) 14%, transparent); border-color: color-mix(in srgb, var(--dir) 30%, var(--color-base-300));"
		>
			{(symbol || '?').slice(0, 1)}
		</span>
	{/if}
{/snippet}

{#snippet marketRow(a: any)}
	{@const live = priceMap.get(`${a.asset_type}:${a.asset_id}`)}
	{@const price = live?.price ?? a.price ?? 0}
	{@const change = live?.change24h ?? a.change24h ?? 0}
	<button
		type="button"
		class="relative isolate grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 overflow-hidden rounded-[15px] border py-[13px] pr-4 pl-[17px] text-left transition-transform duration-200 not-disabled:cursor-pointer disabled:opacity-70"
		style="--dir: {dirColor(change)}; {ROW_STYLE}"
		disabled={ctx.readOnly}
		onclick={() => !ctx.readOnly && openBuy(a)}
		aria-label="Buy {a.symbol}"
	>
		<span class="flex min-w-0 items-center gap-2.5">
			{@render assetLogo(a.image, a.symbol, 'size-9')}
			<span class="flex min-w-0 flex-col gap-px leading-tight">
				<span class="text-base-content text-sm font-extrabold tracking-[0.01em]">{a.symbol}</span>
				<span class="text-base-content/60 truncate text-[11px] font-medium">{a.name}</span>
			</span>
		</span>

		{#if a.sparkline?.length > 1}
			<svg class="h-6 w-14 shrink-0 text-(--dir)" viewBox="0 0 72 24" preserveAspectRatio="none" aria-hidden="true">
				<path d={sparkPath(a.sparkline)} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{/if}

		<span class="relative z-2 flex flex-col items-end">
			<span class="text-base-content text-sm font-extrabold whitespace-nowrap tabular-nums">{fmtPrice(price)}</span>
			<span class="inline-flex items-center gap-[3px] text-[11.5px] font-bold whitespace-nowrap text-(--dir) tabular-nums">
				<i class="fas fa-caret-{change >= 0 ? 'up' : 'down'}"></i>{pctText(change)}
			</span>
		</span>
	</button>
{/snippet}

{#snippet pctButtons(values: number[], selected: number | 'custom', busy: boolean, maxLabel: string, pick: (v: number | 'custom') => void)}
	<div class="mb-2.5 grid grid-cols-5 gap-1.5">
		{#each values as p}
			<button
				type="button"
				class="btn btn-sm border-base-300 bg-base-200 text-base-content h-9 px-0 text-[13.5px] font-bold {selected === p ? PCT_ACTIVE : ''}"
				disabled={busy}
				onclick={() => pick(p)}
			>
				{p === 100 ? maxLabel : `${p}%`}
			</button>
		{/each}
		<button
			type="button"
			class="btn btn-sm border-base-300 bg-base-200 text-base-content h-9 px-0 text-[13.5px] font-bold {selected === 'custom' ? PCT_ACTIVE : ''}"
			disabled={busy}
			onclick={() => pick('custom')}
		>
			Custom
		</button>
	</div>
{/snippet}

{#if data.category === 'mine'}
	{#if livePositions.length === 0}
		<EmptyState icon="fa-briefcase" message="You don't hold any assets yet." hint="Open the Top or Search tab to invest XP." boxed />
	{:else}
		<div class="flex flex-col gap-2">
			{#each livePositions as p (p.id)}
				<button
					type="button"
					class="relative isolate grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[15px] border py-[13px] pr-4 pl-[17px] text-left transition-transform duration-200 not-disabled:cursor-pointer disabled:opacity-70"
					style="--dir: {dirColor(p.pnl)}; {ROW_STYLE}"
					disabled={ctx.readOnly}
					onclick={() => !ctx.readOnly && openSell(p)}
					aria-label="Sell {p.symbol}"
				>
					<span class="flex min-w-0 items-center gap-2.5">
						{@render assetLogo(p.asset_image, p.symbol, 'size-9')}
						<span class="flex min-w-0 flex-col gap-px leading-tight">
							<span class="text-base-content text-sm font-extrabold tracking-[0.01em]">{p.symbol}</span>
							<span class="text-base-content/60 truncate text-[11px] font-medium">
								{fmtUnits(p.buy_price > 0 ? p.xp_invested / p.buy_price : 0)}
								{p.symbol}
							</span>
						</span>
					</span>
					<span class="relative z-2 flex flex-col items-end">
						<span class="text-base-content text-sm font-extrabold whitespace-nowrap tabular-nums">{fmt(p.value)} XP</span>
						<span class="inline-flex items-center gap-[3px] text-[11.5px] font-bold whitespace-nowrap text-(--dir) tabular-nums">
							<i class="fas fa-caret-{p.pnl >= 0 ? 'up' : 'down'}"></i>{p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)} ({pctText(p.pnl_percent)})
						</span>
					</span>
				</button>
			{/each}
		</div>
	{/if}
{:else if data.category === 'search'}
	<label class="input border-base-300 bg-base-100 mb-3 flex h-[46px] w-full items-center gap-2.5 rounded-[13px]">
		<i class="fas fa-magnifying-glass text-base-content/40"></i>
		<input type="text" class="grow" placeholder="Search any coin (BTC, ETH, SOL…)" bind:value={searchQuery} oninput={onSearchInput} />
		{#if searching}<i class="fas fa-spinner fa-spin text-primary"></i>{/if}
	</label>
	{#if searchResults.length === 0}
		<EmptyState
			icon={searchQuery.trim() && searching ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}
			message={searchQuery.trim() ? (searching ? 'Searching…' : 'No coins found.') : 'Type to search thousands of coins.'}
			boxed
		/>
	{:else}
		<div class="flex flex-col gap-2">
			{#each searchResults as a (a.asset_id)}
				{@render marketRow(a)}
			{/each}
		</div>
	{/if}
{:else if listForTab.length === 0}
	<EmptyState icon="fa-chart-line" message="Market data is loading…" boxed />
{:else}
	<div class="flex flex-col gap-2">
		{#each listForTab as a (a.asset_id)}
			{@render marketRow(a)}
		{/each}
	</div>
{/if}

{#if buyAsset}
	{@const live = priceMap.get(`${buyAsset.asset_type}:${buyAsset.asset_id}`)}
	{@const price = live?.price ?? buyAsset.price ?? 0}
	{@const change = live?.change24h ?? buyAsset.change24h ?? 0}
	<GameModal title={buyAsset.symbol} closable={!buyBusy} onclose={() => (buyAsset = null)}>
		{#snippet leading()}
			<span class="text-base-content inline-flex items-center" style="--dir: {dirColor(change)}">
				{@render assetLogo(buyAsset.image, buyAsset.symbol, 'size-6')}
			</span>
		{/snippet}

		<div class="mb-3 flex items-baseline justify-between gap-2.5">
			<span class="text-base-content text-2xl font-extrabold tabular-nums">{fmtPrice(price)}</span>
			<span class="inline-flex items-center gap-[3px] text-[11.5px] font-bold tabular-nums" style="color: {dirColor(change)}">
				<i class="fas fa-caret-{change >= 0 ? 'up' : 'down'}"></i>{pctText(change)} · 24h
			</span>
		</div>

		{@render pctButtons(BUY_PCTS, buyPercent, buyBusy, 'Max', (v) => (buyPercent = v))}

		{#if buyPercent === 'custom'}
			<input
				class="input border-base-300 bg-base-200 mb-2.5 w-full text-center text-sm font-bold tabular-nums"
				type="text"
				inputmode="numeric"
				placeholder="XP to invest (min {fmt(MIN_BUY)})"
				value={grp(buyCustom)}
				oninput={(e) => onAmountInput(e, (v) => (buyCustom = v))}
				disabled={buyBusy}
			/>
		{/if}

		<div class="text-base-content/60 mb-3 flex justify-between gap-2.5 text-xs tabular-nums">
			<span>Balance: {fmt(ctx.liveXp)} XP</span>
			<span>≈ {buyAmount && price > 0 ? fmtUnits(buyAmount / price) : '0'} {buyAsset.symbol}</span>
		</div>

		<button
			type="button"
			class="btn animate-game-charge h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white"
			disabled={buyBusy || buyAmount < MIN_BUY || buyAmount > ctx.liveXp}
			onclick={confirmBuy}
		>
			{#if buyBusy}<i class="fas fa-circle-notch fa-spin"></i>Buying…{:else}<i class="fas fa-arrow-trend-up"></i>Invest {buyAmount
					? `${fmt(buyAmount)} XP`
					: ''}{/if}
		</button>
	</GameModal>
{/if}

{#if sellPos}
	{@const live = priceMap.get(`${sellPos.asset_type}:${sellPos.asset_id}`)}
	{@const price = live?.price ?? sellPos.current_price ?? sellPos.buy_price ?? 0}
	{@const value = sellPos.buy_price > 0 ? Math.round(sellPos.xp_invested * (price / sellPos.buy_price)) : sellPos.xp_invested}
	{@const payout = Math.min(Math.max(0, Math.floor(sellAmount || 0)), value)}
	{@const costBasis = value > 0 ? Math.round(sellPos.xp_invested * (payout / value)) : 0}
	{@const realized = payout - costBasis}
	<GameModal title={sellPos.symbol} closable={!sellBusy} onclose={() => (sellPos = null)}>
		{#snippet leading()}
			<span class="text-base-content inline-flex items-center" style="--dir: {dirColor(sellPos.pnl)}">
				{@render assetLogo(sellPos.asset_image, sellPos.symbol, 'size-6')}
			</span>
		{/snippet}

		<div class="mb-3 flex items-baseline justify-between gap-2.5">
			<span class="text-base-content text-2xl font-extrabold tabular-nums">{fmt(value)} XP</span>
			<span class="inline-flex items-center gap-[3px] text-[11.5px] font-bold tabular-nums" style="color: {dirColor(sellPos.pnl)}">
				<i class="fas fa-caret-{sellPos.pnl >= 0 ? 'up' : 'down'}"></i>{sellPos.pnl >= 0 ? '+' : ''}{fmt(sellPos.pnl)} XP
			</span>
		</div>

		{@render pctButtons(SELL_PCTS, sellPercent, sellBusy, 'All', (v) => (sellPercent = v))}

		{#if sellPercent === 'custom'}
			<input
				class="input border-base-300 bg-base-200 mb-2.5 w-full text-center text-sm font-bold tabular-nums"
				type="text"
				inputmode="numeric"
				placeholder="XP to cash out (max {fmt(value)})"
				value={grp(sellCustom)}
				oninput={(e) => onAmountInput(e, (v) => (sellCustom = v))}
				disabled={sellBusy}
			/>
		{/if}

		<div class="text-base-content/60 mb-3 flex justify-between gap-2.5 text-xs tabular-nums">
			<span>Cost basis: {fmt(costBasis)} XP</span>
			<span style="color: {dirColor(realized)}">{realized >= 0 ? 'Profit' : 'Loss'}: {realized >= 0 ? '+' : ''}{fmt(realized)} XP</span>
		</div>

		<button
			type="button"
			class="btn animate-game-charge h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white"
			disabled={sellBusy || payout <= 0}
			onclick={confirmSell}
		>
			{#if sellBusy}<i class="fas fa-circle-notch fa-spin"></i>Selling…{:else}<i class="fas fa-hand-holding-dollar"></i>Sell {payout >= value ? 'all' : ''} · {fmt(
					payout
				)} XP{/if}
		</button>
	</GameModal>
{/if}

{#if outcome}
	<OutcomeModal
		tone={outcome.tone}
		icon={outcome.icon}
		title={outcome.title}
		line={outcome.line}
		delta={outcome.deltaXp != null && outcome.deltaXp !== 0 ? `${outcome.deltaXp >= 0 ? '+' : '−'}${fmt(Math.abs(outcome.deltaXp))} XP` : null}
		deltaUp={(outcome.deltaXp ?? 0) >= 0}
		onclose={dismissOutcome}
	/>
{/if}
