<script lang="ts">
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const readOnly = $derived(data.readOnly);
	const serverSlug = $derived(data.server.slug);

	function fmt(n: number): string {
		return Math.floor(Number(n) || 0).toLocaleString();
	}

	function xpForLevel(lvl: number): number {
		const { baseXp, multiplier } = data.levelReq;
		if (lvl <= 1) return 0;
		let total = 0;
		for (let i = 1; i < lvl; i++) total += Math.floor(baseXp * Math.pow(multiplier, i - 1));
		return total;
	}

	let liveXp = $state(Number(data.balance?.experience ?? 0) || 0);
	$effect(() => {
		liveXp = Number(data.balance?.experience ?? 0) || 0;
	});
	const level = $derived(Number(data.balance?.level ?? 1) || 1);
	const spendable = $derived(Math.max(0, liveXp - xpForLevel(level)));

	const MIN_MULT = 1.1;
	const MAX_MULT = 10;
	const MIN_WAGER = 1000;
	const PRESETS = [2, 3, 5, 10];

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
	const canPlay = $derived(!readOnly && !busy && !!wager && wager >= MIN_WAGER && wager <= spendable);

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
	$effect(() => {
		if (reel.length === 0) initReel();
	});

	async function play() {
		if (!canPlay) return;
		const bet = Math.floor(Number(wager) || 0);
		busy = true;
		reelResult = null;
		try {
			const res = await fetch(`/api/minigames/${encodeURIComponent(serverSlug)}/play`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: data.hash, multiplier, amount: bet })
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

			// build a reel that lands on the outcome
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
				liveXp = Math.max(0, liveXp + net);
				if (won) {
					winAmt = payout;
				} else {
					lostAmt = bet;
					shake = true;
					setTimeout(() => (shake = false), 500);
				}
				showToast(won ? `Won +${fmt(net)} XP` : `Lost ${fmt(bet)} XP`, won ? 'success' : 'error');
				busy = false;
				invalidateAll();
			}, 3700);
		} catch {
			showToast('Play failed', 'error');
			busy = false;
		}
	}

	function memberAvatar(): string {
		return data.memberAvatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(data.memberDiscordId) % 5 || 0}.png`;
	}
	function relTime(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso).getTime();
		const diff = Date.now() - d;
		const m = Math.floor(diff / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Minigames | {APP_NAME} Discord Bot</title></svelte:head>

<div class="m-mg">
	<div class="m-mg-hero">
		<div class="m-mg-hero-id">
			<img class="m-mg-hero-avatar" src={memberAvatar()} alt="" />
			<div class="m-mg-hero-meta">
				<span class="m-mg-hero-name">{data.memberName ?? 'Guest'}</span>
				<span class="m-mg-hero-sub"><i class="fas fa-dice"></i> Minigames</span>
			</div>
		</div>
		<div class="m-mg-hero-stat">
			<span class="m-mg-hero-k">Playable XP</span>
			<span class="m-mg-hero-v">{fmt(spendable)}</span>
		</div>
	</div>

	{#if readOnly}
		<div class="m-members-empty">
			<i class="fas fa-lock"></i> Open your card from the bot's Minigames button to play. This is a preview.
		</div>
	{/if}

	<div class="m-gamble m-mg-play" class:m-gamble--shake={shake} class:m-gamble--won={reelResult === 'win'} class:m-gamble--lost={reelResult === 'lose'}>
		<div class="m-gamble-aura"></div>

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
			<input type="range" class="m-mg-slider" min={MIN_MULT} max={MAX_MULT} step="0.05" bind:value={multiplier} disabled={busy || readOnly} />
			<div class="m-gamble-picker">
				{#each PRESETS as p}
					<button class="m-gamble-pct" class:m-gamble-pct--active={multiplier === p} disabled={busy || readOnly} onclick={() => (multiplier = p)}>{p}×</button>
				{/each}
			</div>
		</div>

		<div class="m-gamble-picker">
			{#each [25, 50, 75, 100] as p}
				<button class="m-gamble-pct" disabled={busy || readOnly} onclick={() => setWagerPct(p)}>{p === 100 ? 'Max' : `${p}%`}</button>
			{/each}
		</div>
		<input
			class="m-gamble-custom"
			type="text"
			inputmode="numeric"
			placeholder="XP to wager (min {fmt(MIN_WAGER)})"
			value={grp(wager)}
			oninput={onWagerInput}
			disabled={busy || readOnly}
		/>

		<div class="m-asset-modal-meta">
			<span>Playable: {fmt(spendable)} XP</span>
			<span>Win pays {fmt(potentialWin)} XP</span>
		</div>

		<button class="m-gamble-play m-gamble-play--charged" disabled={!canPlay} onclick={play}>
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>Playing…{:else}<i class="fas fa-dice"></i>Play {wager ? `· ${fmt(Number(wager))} XP` : ''}{/if}
		</button>
	</div>

	{#if !readOnly && data.history.length > 0}
		<div class="m-mg-history">
			<div class="m-spy-head"><i class="fas fa-clock-rotate-left"></i>Recent plays</div>
			<div class="m-asset-list">
				{#each data.history.slice(0, 20) as h (h.id)}
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
</div>
