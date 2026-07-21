<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
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

	let playing = $state<string | null>(null);
	let multiplier = $state(2);
	const winChance = $derived(100 / multiplier);
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
				showToast(won ? `Won +${fmt(net)} XP` : `Lost ${fmt(bet)} XP`, won ? 'success' : 'error');
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
	<div class="m-members-empty">No games in this category.</div>
{:else}
	<div class="m-cards">
		{#each games as game (game.id)}
			<article class="m-card" data-cat={game.id} style="--cat: {game.accent}">
				<div class="m-card-glow"></div>
				<div class="m-card-top">
					<span class="m-card-medallion"><i class="fas {game.icon}"></i></span>
				</div>
				<h3 class="m-card-name">{game.name}</h3>
				<p class="m-card-desc">{game.desc}</p>

				<div class="m-card-foot">
					<span class="m-card-price m-card-price--wager"><i class="fas fa-dice"></i>Wager</span>
					{#if ctx.readOnly}
						<button class="m-card-btn" disabled title="Open your card to play"><i class="fas fa-eye"></i>View only</button>
					{:else}
						<button class="m-card-btn m-card-btn--play" title="Play" onclick={() => openPlay(game.id)}>
							<i class="fas fa-dice"></i>Play
						</button>
					{/if}
				</div>
			</article>
		{/each}
	</div>
{/if}

{#if playing}
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!busy ? (playing = null) : null)}>
		<div
			class="m-gamble m-mg-play"
			class:m-gamble--shake={shake}
			class:m-gamble--won={reelResult === 'win'}
			class:m-gamble--lost={reelResult === 'lose'}
			role="dialog"
			aria-modal="true"
			aria-label="Play Gamble"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-gamble-aura"></div>
			<div class="m-gamble-head">
				<span class="m-gamble-title"><span class="m-gamble-ico"><i class="fas fa-dice"></i></span>Gamble</span>
				{#if !busy}<button class="m-gamble-x" aria-label="Close" onclick={() => (playing = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div
				bind:this={reelWrapEl}
				class="m-gamble-reelwrap"
				class:m-gamble-reelwrap--win={reelResult === 'win'}
				class:m-gamble-reelwrap--lose={reelResult === 'lose'}
			>
				<div class="m-gamble-frame"></div>
				<div class="m-gamble-pointer"></div>
				<div
					class="m-gamble-reel"
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 6.8s cubic-bezier(0.06, 0.72, 0.06, 1)' : 'none'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-gamble-cell m-gamble-cell--{cell}"><i class="fas {cell === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i></div>
					{/each}
				</div>
				{#if reelResult}
					<div class="m-gamble-verdict m-gamble-verdict--{reelResult}">
						{#if reelResult === 'win'}
							<span class="m-gamble-verdict-label">WIN</span>
							<span class="m-gamble-verdict-amt">+{fmt(winAmt)} XP</span>
						{:else}
							<span class="m-gamble-verdict-label">BUST</span>
							<span class="m-gamble-verdict-amt">−{fmt(lostAmt)} XP</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if !reelResult}
				<div class="m-mg-mult">
					<div class="m-mg-mult-head">
						<span>Multiplier <strong>{multiplier.toFixed(2)}×</strong></span>
						<span class="m-mg-chance">Win chance {winChance.toFixed(1)}%</span>
					</div>
					<input type="range" class="m-mg-slider" min={MIN_MULT} max={MAX_MULT} step="0.05" bind:value={multiplier} disabled={busy} />
				</div>
			{/if}

			{#if reelResult && !busy}
				<div class="m-gamble-again">
					<button class="m-gamble-reset" onclick={resetGamble}><i class="fas fa-sliders"></i>Change bet</button>
					<button class="m-gamble-play m-gamble-play--charged" disabled={wagerXp <= 0 || wagerXp > spendable} onclick={play}>
						<i class="fas fa-rotate-right"></i>Spin again {multiplier.toFixed(2)}× · {fmt(wagerXp)}
					</button>
				</div>
			{:else}
				<div class="m-gamble-picker">
					{#each WAGER_PERCENTS as p}
						<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === p} disabled={busy} onclick={() => (gamblePercent = p)}>{p}%</button>
					{/each}
					<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === 'custom'} disabled={busy} onclick={() => (gamblePercent = 'custom')}
						>Custom</button
					>
				</div>
				{#if gamblePercent === 'custom'}
					<input class="m-gamble-custom" type="number" min="1" max={spendable} placeholder="Enter XP to wager" bind:value={gambleCustom} disabled={busy} />
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

				<button class="m-gamble-play" class:m-gamble-play--charged={!busy && wagerXp > 0} disabled={busy || wagerXp <= 0} onclick={play}>
					{#if busy}<i class="fas fa-circle-notch fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Spin {gamblePercent === 'custom'
							? ''
							: `${gamblePercent}%`}{/if}
				</button>
			{/if}
		</div>
	</div>
{/if}
