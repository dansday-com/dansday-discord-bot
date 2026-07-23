<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { luckBoostLabel } from '$lib/items';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const spendable = $derived(Math.max(0, Number(ctx.liveXp) || 0));

	const ALL_GAMES = [
		{
			id: 'gamble',
			category: 'gamble',
			icon: 'fa-dice',
			name: 'Gamble',
			desc: 'Set your multiplier, take the odds.',
			accent: '#c8911a'
		}
	];
	const games = $derived(data.category === 'all' ? ALL_GAMES : ALL_GAMES.filter((g) => g.category === data.category));

	const MIN_MULT = 2;
	const MAX_MULT = 10;
	const WAGER_PERCENTS = [25, 50, 75, 100];

	const luckPercent = $derived(Number(ctx.luckPercent) || 0);

	let playing = $state<string | null>(null);
	let multiplier = $state(2);
	const baseWinChance = $derived(100 / multiplier);
	let gamblePercent = $state<number | 'custom'>(25);
	let gambleCustom = $state<number | null>(null);
	let busy = $state(false);

	const wagerXp = $derived(
		gamblePercent === 'custom'
			? Math.min(Math.max(0, Math.floor(Number(gambleCustom) || 0)), spendable)
			: Math.floor((spendable * (gamblePercent as number)) / 100)
	);
	const potentialWin = $derived(Math.floor(wagerXp * multiplier));

	function openPlay(gameId: string) {
		if (ctx.readOnly) return;
		playing = gameId;
		multiplier = 2;
		gamblePercent = 25;
		gambleCustom = null;
		initReel();
	}

	function resetGamble() {
		gamblePercent = 25;
		gambleCustom = null;
		initReel();
	}

	$effect(() => {
		if (playing === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	let reel = $state<('win' | 'lose')[]>([]);
	let reelOffset = $state(0);
	let reelResult = $state<'win' | 'lose' | null>(null);
	let reelAnimating = $state(false);
	let shake = $state(false);
	let winAmt = $state(0);
	let lostAmt = $state(0);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	function randomCells(n: number): ('win' | 'lose')[] {
		return Array.from({ length: n }, () => (Math.random() < 0.5 ? 'win' : 'lose'));
	}
	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell')?.[index];
			if (!cell) return;
			reelOffset = wrapW / 2 - (cell.offsetLeft + cell.offsetWidth / 2);
		});
	}
	function initReel() {
		reel = randomCells(14);
		reelOffset = 0;
		reelResult = null;
		reelAnimating = false;
		winAmt = 0;
		lostAmt = 0;
		centerCell(2);
	}

	async function play() {
		const bet = wagerXp;
		if (busy || bet <= 0 || bet > spendable) return;
		busy = true;
		reelResult = null;
		try {
			const res = await fetch(`/api/minigames/${encodeURIComponent(ctx.serverSlug)}/play`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, multiplier, amount: bet })
			});
			const d = await res.json();
			if (!d.success) {
				showToast(d.error || 'Play failed', 'error');
				busy = false;
				return;
			}
			const won = d.result?.outcome === 'win';
			const net = Number(d.result?.net) || 0;
			const payout = Number(d.result?.payout) || 0;

			reel = randomCells(40);
			const landIndex = 32;
			reel[landIndex] = won ? 'win' : 'lose';
			reelAnimating = false;
			reelOffset = 0;
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			reelWrapEl?.offsetHeight;
			centerCell(2);
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			reelAnimating = true;
			centerCell(landIndex);

			setTimeout(() => {
				reelResult = won ? 'win' : 'lose';
				ctx.setLiveXp(Math.max(0, ctx.liveXp + net));
				if (won) {
					winAmt = payout;
				} else {
					lostAmt = bet;
					shake = true;
					setTimeout(() => (shake = false), 500);
				}
				busy = false;
				ctx.invalidateAll();
			}, 7000);
		} catch {
			showToast('Play failed', 'error');
			busy = false;
		}
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Minigames | {APP_NAME} Discord Bot</title></svelte:head>

{#if games.length === 0}
	<div class="m-members-empty px-4 py-12 text-center">No games in this category.</div>
{:else}
	<div class="m-cards grid gap-4">
		{#each games as game (game.id)}
			<article class="m-card relative flex flex-col gap-2 overflow-hidden rounded-2xl px-4 pt-4 pb-4" data-cat={game.id} style="--cat: {game.accent}">
				<div class="m-card-glow pointer-events-none z-1 opacity-0"></div>
				<div class="m-card-top flex items-start justify-between gap-2">
					<span class="m-card-medallion relative flex h-14 w-14 items-center justify-center rounded-2xl text-xl"><i class="fas {game.icon}"></i></span>
				</div>
				<h3 class="m-card-name text-lb-text mx-0 mt-1 mb-0 text-base font-extrabold">{game.name}</h3>
				<p class="m-card-desc text-lb-text-muted min-h-[2.9em] text-xs">{game.desc}</p>

				<div class="m-card-foot relative z-2 mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
					<span
						class="m-card-price m-card-price--wager text-warning inline-flex min-w-0 flex-auto items-baseline gap-1 text-xs font-extrabold whitespace-nowrap text-[#d99a1c] uppercase"
						><i class="fas fa-dice"></i>Wager</span
					>
					{#if ctx.readOnly}
						<button
							class="m-card-btn inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-4 py-2 text-base font-bold whitespace-nowrap text-white"
							disabled
							title="Open your card to play"><i class="fas fa-eye"></i>View only</button
						>
					{:else}
						<button
							class="m-card-btn m-card-btn--play inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-4 py-2 text-base font-bold whitespace-nowrap text-white"
							title="Play"
							onclick={() => openPlay(game.id)}
						>
							<i class="fas fa-dice"></i>Play
						</button>
					{/if}
				</div>
			</article>
		{/each}
	</div>
{/if}

{#if playing}
	<div class="m-gamble-overlay z-60 flex items-center justify-center p-4" role="presentation" onclick={() => (!busy ? (playing = null) : null)}>
		<div
			class="m-gamble m-mg-play relative p-5"
			class:m-gamble--shake={shake}
			class:m-gamble--won={reelResult === 'win'}
			class:m-gamble--lost={reelResult === 'lose'}
			role="dialog"
			aria-modal="true"
			aria-label="Play Gamble"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-gamble-aura pointer-events-none -z-[1] opacity-50"></div>
			<div class="m-gamble-head mb-4 flex items-center justify-between">
				<span class="m-gamble-title text-lb-text inline-flex items-center gap-2 text-base font-extrabold"
					><span class="m-gamble-ico text-warning text-lg"><i class="fas fa-dice"></i></span>Gamble</span
				>
				{#if !busy}<button class="m-gamble-x text-lb-text-muted cursor-pointer px-2 py-0 text-lg" aria-label="Close" onclick={() => (playing = null)}
						><i class="fas fa-times"></i></button
					>{/if}
			</div>

			<div
				bind:this={reelWrapEl}
				class="m-gamble-reelwrap relative mb-4 overflow-hidden rounded-[14px] px-0 py-3"
				class:m-gamble-reelwrap--win={reelResult === 'win'}
				class:m-gamble-reelwrap--lose={reelResult === 'lose'}
			>
				<div class="m-gamble-frame pointer-events-none z-3 w-24 w-[88px] rounded-[13px]"></div>
				<div class="m-gamble-pointer z-4 h-0 w-0"></div>
				<div
					class="m-gamble-reel pl-25"
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 6.8s cubic-bezier(0.06, 0.72, 0.06, 1)' : 'none'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-gamble-cell m-gamble-cell--{cell} flex h-19 h-[76px] flex-[0_0_84px] items-center justify-center rounded-[11px] text-2xl">
							<i class="fas {cell === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i>
						</div>
					{/each}
				</div>
				{#if reelResult}
					<div class="m-gamble-verdict m-gamble-verdict--{reelResult} pointer-events-none z-6 flex flex-col items-center justify-center gap-0">
						{#if reelResult === 'win'}
							<span class="m-gamble-verdict-label text-base font-black uppercase">WIN</span>
							<span class="m-gamble-verdict-amt text-xl font-black tabular-nums">+{fmt(winAmt)} XP</span>
						{:else}
							<span class="m-gamble-verdict-label text-base font-black uppercase">BUST</span>
							<span class="m-gamble-verdict-amt text-xl font-black tabular-nums">−{fmt(lostAmt)} XP</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if !reelResult}
				<div class="m-mg-mult mx-0 mt-1 mb-1">
					<div class="m-mg-mult-head text-lb-text-muted mb-2 flex items-center justify-between text-base">
						<span>Multiplier <strong>{multiplier.toFixed(2)}×</strong></span>
						<span class="m-mg-chance font-bold text-[#e0a52a]">Win chance {luckBoostLabel(baseWinChance, luckPercent)}</span>
					</div>
					<input
						type="range"
						class="m-mg-slider mb-2 w-full cursor-pointer"
						min={MIN_MULT}
						max={MAX_MULT}
						step="0.05"
						bind:value={multiplier}
						disabled={busy}
					/>
				</div>
			{/if}

			{#if reelResult && !busy}
				<div class="m-gamble-again flex gap-2">
					<button
						class="m-gamble-reset text-lb-text inline-flex flex-none cursor-pointer items-center gap-2 rounded-xl px-4 py-4 text-base font-bold"
						onclick={resetGamble}><i class="fas fa-sliders"></i>Change bet</button
					>
					<button
						class="m-gamble-play m-gamble-play--charged relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl p-4 text-base font-black text-white"
						disabled={wagerXp <= 0 || wagerXp > spendable}
						onclick={play}
					>
						<i class="fas fa-rotate-right"></i>Spin again
					</button>
				</div>
			{:else}
				<div class="m-gamble-picker mb-3 flex flex-wrap gap-2">
					{#each WAGER_PERCENTS as p}
						<button
							class="m-gamble-pct text-lb-text cursor-pointer rounded-lg px-0 py-2 text-base font-bold"
							class:m-gamble-pct--active={gamblePercent === p}
							disabled={busy}
							onclick={() => (gamblePercent = p)}>{p}%</button
						>
					{/each}
					<button
						class="m-gamble-pct text-lb-text cursor-pointer rounded-lg px-0 py-2 text-base font-bold"
						class:m-gamble-pct--active={gamblePercent === 'custom'}
						disabled={busy}
						onclick={() => (gamblePercent = 'custom')}>Custom</button
					>
				</div>
				{#if gamblePercent === 'custom'}
					<input
						class="m-gamble-custom text-lb-text mb-3 box-border w-full rounded-lg px-3 py-3 text-center text-base font-bold tabular-nums"
						type="number"
						min="1"
						max={spendable}
						placeholder="Enter XP to wager"
						bind:value={gambleCustom}
						disabled={busy}
					/>
				{/if}

				<div class="m-gamble-stakes mb-3 flex items-center justify-center gap-4 rounded-xl px-3 py-2">
					<div class="m-gamble-stake flex min-w-0 flex-col items-center gap-0">
						<span class="m-gamble-stake-k text-lb-text-muted text-xs font-bold uppercase">Wager</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--bet text-lb-text text-base font-black tabular-nums">{fmt(wagerXp)}</span>
					</div>
					<i class="fas fa-arrow-right m-gamble-stake-arrow text-lb-text-muted text-base"></i>
					<div class="m-gamble-stake flex min-w-0 flex-col items-center gap-0">
						<span class="m-gamble-stake-k text-lb-text-muted text-xs font-bold uppercase">Win pays</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--win text-success-soft text-base font-black tabular-nums">{fmt(potentialWin)}</span>
					</div>
				</div>

				<button
					class="m-gamble-play relative inline-flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl p-4 text-base font-black text-white"
					class:m-gamble-play--charged={!busy && wagerXp > 0}
					disabled={busy || wagerXp <= 0}
					onclick={play}
				>
					{#if busy}<i class="fas fa-circle-notch fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Spin {gamblePercent === 'custom'
							? ''
							: `${gamblePercent}%`}{/if}
				</button>
			{/if}
		</div>
	</div>
{/if}
