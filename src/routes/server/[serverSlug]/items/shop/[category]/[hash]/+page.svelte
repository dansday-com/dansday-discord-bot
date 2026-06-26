<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { effectSummary, effectIcon, effectLabel, effectMeta, itemAvailability, ITEM_EFFECTS } from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt, canAfford } = ctx;

	const tzOffset = () => -new Date().getTimezoneOffset();

	const byCost = (a: any, b: any) => (Number(a.cost) || 0) - (Number(b.cost) || 0);

	const shopItems = $derived(
		(data.visibleItems ?? [])
			.map((item: any) => {
				const a = itemAvailability(item, ctx.now, tzOffset());
				return { ...item, availableUntil: a.availableUntil, _visible: a.visible };
			})
			.filter((item: any) => item._visible)
	);

	const groups = $derived.by(() => {
		const list = [...shopItems].sort(byCost);
		if (data.category !== 'all') {
			return [{ key: 'flat', label: '', icon: '', items: list }];
		}
		const out: { key: string; label: string; icon: string; items: any[] }[] = [];
		const limited = list.filter((i) => i.availableUntil && i.availableUntil > ctx.now);
		if (limited.length > 0) out.push({ key: 'limited', label: 'Limited', icon: 'fa-hourglass-half', items: limited });
		for (const eff of ITEM_EFFECTS) {
			const items = list.filter((i) => i.effect_type === eff.id);
			if (items.length > 0) out.push({ key: eff.id, label: eff.label, icon: eff.icon, items });
		}
		return out;
	});

	async function buy(item: any, ev?: MouseEvent) {
		if (ctx.bagFull) {
			showToast(`Your bag is full (max ${ctx.bagCapacity} items)`, 'error');
			return;
		}
		if (!canAfford(item)) {
			showToast(`Not enough XP — need ${fmt(item.cost)}`, 'error');
			return;
		}
		const card = (ev?.currentTarget as HTMLElement | undefined)?.closest('.m-card');
		const medallion = card?.querySelector('.m-card-medallion') as HTMLElement | null;
		ctx.setBusy(item.id);
		const optimistic = Math.max(0, ctx.liveXp - (Number(item.cost) || 0));
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, item_id: item.id, quantity: 1, tz_offset: tzOffset() })
			});
			const d = await res.json();
			if (d.success) {
				ctx.setBurst(item.id);
				setTimeout(() => ctx.setBurst(null), 600);
				ctx.setLiveXp(optimistic);
				ctx.flyToBag(medallion, effectIcon(item.effect_type));
				await ctx.invalidateAll();
			} else showToast(d.error || 'Purchase failed', 'error');
		} catch {
			showToast('Purchase failed', 'error');
		} finally {
			ctx.setBusy(null);
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
	let reelSpinning = $state(false);
	let reelAnimating = $state(false);
	let gambleShake = $state(false);
	let coins = $state<{ id: number; x: number; delay: number }[]>([]);
	let winCount = $state(0);
	let lostAmount = $state(0);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (gambleItem === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	function randomCells(n: number): ('win' | 'lose')[] {
		return Array.from({ length: n }, () => (Math.random() < 0.5 ? 'win' : 'lose'));
	}

	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell')?.[index];
			if (!cell) return;
			const cellCenter = cell.offsetLeft + cell.offsetWidth / 2;
			reelOffset = wrapW / 2 - cellCenter;
		});
	}

	function openGamble(item: any) {
		gambleItem = item;
		gamblePercent = 25;
		gambleCustom = null;
		reel = randomCells(12);
		reelOffset = 0;
		reelResult = null;
		reelSpinning = false;
		reelAnimating = false;
		gambleShake = false;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		centerCell(2);
	}

	function resetGamble() {
		gamblePercent = 25;
		gambleCustom = null;
		reel = randomCells(12);
		reelOffset = 0;
		reelResult = null;
		reelAnimating = false;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		centerCell(2);
	}

	const wagerXp = $derived(
		gamblePercent === 'custom'
			? Math.min(Math.max(0, Math.floor(Number(gambleCustom) || 0)), ctx.liveXp)
			: Math.floor((ctx.liveXp * (gamblePercent as number)) / 100)
	);
	const payoutMultiplier = $derived(Number(gambleItem?.config?.payout_multiplier ?? 2) || 2);
	const potentialWin = $derived(Math.floor(wagerXp * payoutMultiplier));

	function spawnCoins() {
		coins = Array.from({ length: 14 }, (_, i) => ({ id: i, x: (i / 13) * 100, delay: (i % 7) * 55 }));
		setTimeout(() => (coins = []), 1600);
	}

	function countUpWin(target: number) {
		winCount = 0;
		const steps = 28;
		let i = 0;
		const t = setInterval(() => {
			i++;
			winCount = Math.round(target * (1 - Math.pow(1 - i / steps, 2)));
			if (i >= steps) {
				winCount = target;
				clearInterval(t);
			}
		}, 22);
	}

	async function playGamble() {
		const item = gambleItem;
		if (!item || gambleRolling) return;
		if (wagerXp <= 0) {
			showToast('Not enough XP to wager', 'error');
			return;
		}
		gambleRolling = true;
		reelResult = null;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		reel = randomCells(12);
		reelAnimating = false;
		reelOffset = 0;
		reelSpinning = true;
		try {
			const body =
				gamblePercent === 'custom'
					? { card: ctx.hash, item_id: item.id, amount: wagerXp, tz_offset: tzOffset() }
					: { card: ctx.hash, item_id: item.id, percent: gamblePercent, tz_offset: tzOffset() };
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/gamble`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const d = await res.json();
			if (!d.success) {
				showToast(d.error || 'Gamble failed', 'error');
				gambleRolling = false;
				reelSpinning = false;
				return;
			}
			const won = !!d.result?.won;
			const landIndex = 32;
			const cells = randomCells(40);
			cells[landIndex] = won ? 'win' : 'lose';
			cells[landIndex - 1] = won ? 'lose' : 'win';
			cells[landIndex + 1] = won ? 'lose' : 'win';
			reel = cells;
			reelAnimating = false;
			reelOffset = 0;
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cellEls = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell');
			const target = cellEls?.[landIndex];
			if (target) {
				const cellCenter = target.offsetLeft + target.offsetWidth / 2;
				reelAnimating = true;
				reelOffset = wrapW / 2 - cellCenter;
			}
			setTimeout(() => {
				reelSpinning = false;
				reelAnimating = false;
				gambleRolling = false;
				reelResult = won ? 'win' : 'lose';
				gambleShake = true;
				setTimeout(() => (gambleShake = false), 480);
				if (won) {
					spawnCoins();
					countUpWin(Math.floor(Number(d.result?.payout) || potentialWin));
				} else {
					lostAmount = Math.floor(Number(d.result?.wager) || wagerXp);
				}
			}, 3700);
		} catch {
			showToast('Gamble failed', 'error');
			gambleRolling = false;
			reelSpinning = false;
		}
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Item Shop | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet card(item: any)}
	{@const affordable = canAfford(item)}
	<article class="m-card" class:m-card--locked={!ctx.readOnly && !affordable} class:m-card--burst={ctx.burstId === item.id} data-cat={item.effect_type}>
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
		{#if effectMeta(item).length > 0}
			<div class="m-card-meta">
				{#each effectMeta(item) as chip}
					<span class="m-card-stat" title={chip.label}><i class="fas {chip.icon}"></i>{chip.label}</span>
				{/each}
			</div>
		{/if}
		<div class="m-card-foot">
			{#if item.effect_type === 'gamble'}
				<span class="m-card-price m-card-price--wager"><i class="fas fa-dice"></i>Wager</span>
				{#if ctx.readOnly}
					<button class="m-card-btn" disabled title="Open your card to play"><i class="fas fa-eye"></i>View only</button>
				{:else}
					<button class="m-card-btn m-card-btn--play" onclick={() => openGamble(item)}>
						<i class="fas fa-dice"></i>Play
					</button>
				{/if}
			{:else}
				<span class="m-card-price" class:m-card-price--short={!ctx.readOnly && !affordable}>{fmt(item.cost)}<span class="m-card-price-unit">XP</span></span>
				{#if ctx.readOnly}
					<button class="m-card-btn" disabled title="Open your card to buy"><i class="fas fa-eye"></i>View only</button>
				{:else}
					<button class="m-card-btn" disabled={ctx.busy === item.id || !affordable || ctx.bagFull} onclick={(e) => buy(item, e)}>
						{#if ctx.busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else if ctx.bagFull}<i class="fas fa-bag-shopping"></i>{:else if !affordable}<i
								class="fas fa-lock"
							></i>{:else}<i class="fas fa-cart-plus"></i>{/if}
						{ctx.bagFull ? 'Bag full' : affordable ? 'Buy' : 'Locked'}
					</button>
				{/if}
			{/if}
		</div>
	</article>
{/snippet}

{#if shopItems.length === 0}
	<div class="m-members-empty">No items in this category.</div>
{:else if data.category !== 'all'}
	<div class="m-cards">
		{#each shopItems.slice().sort(byCost) as item (item.id)}
			{@render card(item)}
		{/each}
	</div>
{:else}
	{#each groups as group (group.key)}
		<div class="m-group">
			<h2 class="m-group-head" class:m-group-head--limited={group.key === 'limited'}>
				<i class="fas {group.icon}"></i>{group.label}
				<span class="m-group-count">{group.items.length}</span>
			</h2>
			<div class="m-cards">
				{#each group.items as item (item.id)}
					{@render card(item)}
				{/each}
			</div>
		</div>
	{/each}
{/if}

{#if gambleItem}
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!gambleRolling ? (gambleItem = null) : null)}>
		<div
			class="m-gamble"
			class:m-gamble--shake={gambleShake}
			class:m-gamble--won={reelResult === 'win'}
			class:m-gamble--lost={reelResult === 'lose'}
			role="dialog"
			aria-modal="true"
			aria-label="Gamble"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-gamble-aura"></div>
			<div class="m-gamble-head">
				<span class="m-gamble-title"><span class="m-gamble-ico"><i class="fas {effectIcon(gambleItem.effect_type)}"></i></span>{gambleItem.name}</span>
				{#if !gambleRolling}<button class="m-gamble-x" aria-label="Close" onclick={() => (gambleItem = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div
				bind:this={reelWrapEl}
				class="m-gamble-reelwrap"
				class:m-gamble-reelwrap--win={reelResult === 'win'}
				class:m-gamble-reelwrap--lose={reelResult === 'lose'}
				class:m-gamble-reelwrap--spinning={reelSpinning}
			>
				<div class="m-gamble-frame"></div>
				<div class="m-gamble-pointer"></div>
				<div
					class="m-gamble-reel"
					class:m-gamble-reel--spin={reelSpinning}
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 3.6s cubic-bezier(0.09, 0.62, 0.12, 1)' : 'none'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-gamble-cell m-gamble-cell--{cell}">
							<i class="fas {cell === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i>
						</div>
					{/each}
				</div>

				{#if coins.length > 0}
					<div class="m-gamble-coins">
						{#each coins as c (c.id)}
							<span class="m-gamble-coin" style="left: {c.x}%; animation-delay: {c.delay}ms"><i class="fas fa-coins"></i></span>
						{/each}
					</div>
				{/if}

				{#if reelResult}
					<div class="m-gamble-verdict m-gamble-verdict--{reelResult}">
						{#if reelResult === 'win'}
							<span class="m-gamble-verdict-label">WIN</span>
							<span class="m-gamble-verdict-amt">+{fmt(winCount)} XP</span>
						{:else}
							<span class="m-gamble-verdict-label">BUST</span>
							<span class="m-gamble-verdict-amt">−{fmt(lostAmount)} XP</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if reelResult && !gambleRolling}
				<div class="m-gamble-again">
					<button class="m-gamble-reset" onclick={resetGamble}><i class="fas fa-sliders"></i>Change bet</button>
					<button class="m-gamble-play m-gamble-play--charged" disabled={wagerXp <= 0 || wagerXp > ctx.liveXp} onclick={playGamble}>
						<i class="fas fa-rotate-right"></i>Spin again · {fmt(wagerXp)}
					</button>
				</div>
			{:else}
				<div class="m-gamble-picker">
					{#each WAGER_PERCENTS as p}
						<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === p} disabled={gambleRolling} onclick={() => (gamblePercent = p)}
							>{p}%</button
						>
					{/each}
					<button
						class="m-gamble-pct"
						class:m-gamble-pct--active={gamblePercent === 'custom'}
						disabled={gambleRolling}
						onclick={() => (gamblePercent = 'custom')}>Custom</button
					>
				</div>
				{#if gamblePercent === 'custom'}
					<input
						class="m-gamble-custom"
						type="number"
						min="1"
						max={ctx.liveXp}
						placeholder="Enter XP to wager"
						bind:value={gambleCustom}
						disabled={gambleRolling}
					/>
				{/if}

				<div class="m-gamble-stakes">
					<div class="m-gamble-stake">
						<span class="m-gamble-stake-k">Wager</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--bet">{fmt(wagerXp)}</span>
					</div>
					<i class="fas fa-arrow-right m-gamble-stake-arrow"></i>
					<div class="m-gamble-stake">
						<span class="m-gamble-stake-k">Win pays</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--win">{fmt(potentialWin)}</span>
					</div>
				</div>

				<button
					class="m-gamble-play"
					class:m-gamble-play--charged={!gambleRolling && wagerXp > 0}
					disabled={gambleRolling || wagerXp <= 0}
					onclick={playGamble}
				>
					{#if gambleRolling}<i class="fas fa-circle-notch fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Spin {gamblePercent === 'custom'
							? ''
							: `${gamblePercent}%`}{/if}
				</button>
			{/if}
		</div>
	</div>
{/if}
