<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	function xpForLevel(lvl: number): number {
		const { baseXp, multiplier } = data.levelReq;
		if (lvl <= 1) return 0;
		let total = 0;
		for (let i = 1; i < lvl; i++) total += Math.floor(baseXp * Math.pow(multiplier, i - 1));
		return total;
	}
	const level = $derived(Number(data.balance?.level ?? 1) || 1);
	const spendable = $derived(Math.max(0, ctx.liveXp - xpForLevel(level)));

	const ALL_GAMES = [
		{
			id: 'gamble',
			category: 'gamble',
			icon: 'fa-dice',
			name: 'Gamble',
			desc: 'Pick your own multiplier and take the odds. Fair chance = 100 ÷ multiplier.',
			accent: '#8b5cf6'
		}
	];
	const games = $derived(data.category === 'all' ? ALL_GAMES : ALL_GAMES.filter((g) => g.category === data.category));

	const MIN_MULT = 1.1;
	const MAX_MULT = 10;
	const MIN_WAGER = 1000;
	const PRESETS = [2, 3, 5, 10];

	// play modal state
	let playing = $state<string | null>(null);
	let multiplier = $state(2);
	const winChance = $derived(100 / multiplier);
	let wager = $state<number | null>(null);
	let busy = $state(false);

	function grp(n: number | null): string {
		return n == null || !Number.isFinite(n) ? '' : Math.floor(n).toLocaleString();
	}
	function onWagerInput(e: Event) {
		const digits = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '');
		wager = digits === '' ? null : Number(digits);
	}
	function setWagerPct(pct: number) {
		wager = Math.floor((spendable * pct) / 100);
	}
	const potentialWin = $derived(wager && wager > 0 ? Math.floor(wager * multiplier) : 0);
	const canPlay = $derived(!ctx.readOnly && !busy && !!wager && wager >= MIN_WAGER && wager <= spendable);

	function openPlay(gameId: string) {
		if (ctx.readOnly) return;
		playing = gameId;
		multiplier = 2;
		wager = null;
		initReel();
	}

	$effect(() => {
		if (playing === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	// reel animation
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
		if (!canPlay) return;
		const bet = Math.floor(Number(wager) || 0);
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

			reel = randomCells(14);
			const landIndex = 10;
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
			}, 3700);
		} catch {
			showToast('Play failed', 'error');
			busy = false;
		}
	}

	function relTime(iso: string | null): string {
		if (!iso) return '';
		const diff = Date.now() - new Date(iso).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Minigames | {APP_NAME} Discord Bot</title></svelte:head>

{#if games.length === 0}
	<div class="m-members-empty">No games in this category.</div>
{:else}
	<div class="m-cards m-cards--mg">
		{#each games as game (game.id)}
			<article class="m-card m-card--mg" data-cat="minigame" style="--cat: {game.accent}">
				<div class="m-card-glow"></div>
				<div class="m-card-top">
					<span class="m-card-medallion"><i class="fas {game.icon}"></i></span>
				</div>
				<h3 class="m-card-name">{game.name}</h3>
				<p class="m-card-desc">{game.desc}</p>
				<div class="m-card-meta">
					<span class="m-card-stat"><i class="fas fa-coins"></i>Free to play</span>
					<span class="m-card-stat"><i class="fas fa-arrow-up-right-dots"></i>Up to {MAX_MULT}×</span>
				</div>
				<div class="m-card-foot">
					<span class="m-card-price m-card-price--wager"><i class="fas fa-dice"></i>Wager XP</span>
					<button
						class="m-card-btn m-card-btn--play"
						disabled={ctx.readOnly}
						title={ctx.readOnly ? 'Open your card to play' : 'Play'}
						onclick={() => openPlay(game.id)}
					>
						<i class="fas fa-dice"></i>Play
					</button>
				</div>
			</article>
		{/each}
	</div>
{/if}

{#if !ctx.readOnly && (data.history?.length ?? 0) > 0}
	<div class="m-mg-history">
		<div class="m-spy-head"><i class="fas fa-clock-rotate-left"></i>Recent plays</div>
		<div class="m-asset-list">
			{#each (data.history ?? []).slice(0, 20) as h (h.id)}
				<div class="m-asset-row" data-dir={h.net > 0 ? 'up' : h.net < 0 ? 'down' : 'flat'}>
					<div class="m-asset-id">
						<span class="m-asset-logo m-asset-logo--ph"><i class="fas {h.outcome === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i></span>
						<div class="m-asset-name">
							<span class="m-asset-sym">{h.multiplier.toFixed(2)}× · {h.outcome === 'win' ? 'Win' : 'Loss'}</span>
							<span class="m-asset-full">{relTime(h.created_at)}</span>
						</div>
					</div>
					<div class="m-asset-fig">
						<span class="m-asset-chg" data-dir={h.net >= 0 ? 'up' : 'down'}>{h.net >= 0 ? '+' : ''}{fmt(h.net)} XP</span>
					</div>
				</div>
			{/each}
		</div>
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
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 3.6s cubic-bezier(0.09, 0.62, 0.12, 1)' : 'none'};"
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

			<div class="m-mg-mult">
				<div class="m-mg-mult-head">
					<span>Multiplier <strong>{multiplier.toFixed(2)}×</strong></span>
					<span class="m-mg-chance">Win chance {winChance.toFixed(1)}%</span>
				</div>
				<input type="range" class="m-mg-slider" min={MIN_MULT} max={MAX_MULT} step="0.05" bind:value={multiplier} disabled={busy} />
				<div class="m-gamble-picker">
					{#each PRESETS as p}
						<button class="m-gamble-pct" class:m-gamble-pct--active={multiplier === p} disabled={busy} onclick={() => (multiplier = p)}>{p}×</button>
					{/each}
				</div>
			</div>

			<div class="m-gamble-picker">
				{#each [25, 50, 75, 100] as p}
					<button class="m-gamble-pct" disabled={busy} onclick={() => setWagerPct(p)}>{p === 100 ? 'Max' : `${p}%`}</button>
				{/each}
			</div>
			<input
				class="m-gamble-custom"
				type="text"
				inputmode="numeric"
				placeholder="XP to wager (min {fmt(MIN_WAGER)})"
				value={grp(wager)}
				oninput={onWagerInput}
				disabled={busy}
			/>

			<div class="m-asset-modal-meta">
				<span>Playable: {fmt(spendable)} XP</span>
				<span>Win pays {fmt(potentialWin)} XP</span>
			</div>

			<button class="m-gamble-play m-gamble-play--charged" disabled={!canPlay} onclick={play}>
				{#if busy}<i class="fas fa-circle-notch fa-spin"></i>Playing…{:else}<i class="fas fa-dice"></i>Play {wager ? `· ${fmt(Number(wager))} XP` : ''}{/if}
			</button>
		</div>
	</div>
{/if}
