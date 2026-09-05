<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { luckBoostLabel } from '$lib/items';
	import { EmptyState, GameModal, ReelStrip, WagerPicker } from '$lib/frontend/components/public';
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
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('[data-reel-cell]')?.[index];
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
	<EmptyState icon="fa-dice" message="No games in this category." boxed />
{:else}
	<div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
		{#each games as game (game.id)}
			<article
				class="card border-base-300 bg-base-100 relative isolate overflow-hidden border shadow-sm transition-colors hover:border-[var(--cat)]"
				style="--cat: {game.accent}"
			>
				<span class="absolute inset-x-0 top-0 h-[3px]" style="background: linear-gradient(90deg, var(--cat), color-mix(in srgb, var(--cat) 35%, transparent));"
				></span>
				<div class="card-body gap-2 p-4 sm:p-5">
					<span
						class="grid size-11 place-items-center rounded-xl text-lg"
						style="background: color-mix(in srgb, var(--cat) 14%, transparent); color: var(--cat);"
					>
						<i class="fas {game.icon}"></i>
					</span>
					<h3 class="card-title text-base-content text-[15px] font-bold">{game.name}</h3>
					<p class="text-base-content/60 text-[13px] leading-relaxed">{game.desc}</p>

					<div class="border-base-300 mt-1 flex items-center justify-between gap-2 border-t border-dashed pt-3">
						<span class="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.03em] uppercase" style="color: var(--cat);">
							<i class="fas fa-dice"></i>Wager
						</span>
						{#if ctx.readOnly}
							<button class="btn btn-sm" disabled title="Open your card to play"><i class="fas fa-eye"></i>View only</button>
						{:else}
							<button
								class="btn btn-sm border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] font-bold text-white shadow-[0_6px_16px_-10px_rgba(184,134,11,0.8)]"
								title="Play"
								onclick={() => openPlay(game.id)}
							>
								<i class="fas fa-dice"></i>Play
							</button>
						{/if}
					</div>
				</div>
			</article>
		{/each}
	</div>
{/if}

{#if playing}
	<GameModal
		icon="fa-dice"
		title="Gamble"
		state={reelResult === 'win' ? 'win' : reelResult === 'lose' ? 'lose' : 'idle'}
		{shake}
		closable={!busy}
		onclose={() => (playing = null)}
	>
		<div class="mb-3.5">
			<ReelStrip
				bind:wrap={reelWrapEl}
				items={reel}
				offset={reelOffset}
				animating={reelAnimating}
				frameWidth={88}
				frameWidthLg={96}
				padLeft="92px"
				padLeftLg="100px"
				cellClass="basis-21 h-[70px] min-[600px]:basis-23 min-[600px]:h-[76px]"
				tone={reelResult ?? 'idle'}
			>
				{#snippet cell(kind)}
					<div
						class="grid size-full place-items-center rounded-xl border text-[27px] min-[600px]:text-[30px] {kind === 'win'
							? 'border-success/35 from-success/18 to-success/6 text-success'
							: 'border-error/32 from-error/16 to-error/5 text-error'} bg-linear-[160deg]"
					>
						<i class="fas {kind === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i>
					</div>
				{/snippet}

				{#snippet overlay()}
					{#if reelResult}
						<div class="animate-game-verdict bg-base-200 pointer-events-none absolute inset-0 z-6 flex flex-col items-center justify-center gap-0.5">
							<span class="text-[13px] font-black tracking-[0.18em] uppercase {reelResult === 'win' ? 'text-success' : 'text-error'}">
								{reelResult === 'win' ? 'WIN' : 'BUST'}
							</span>
							<span class="text-[26px] font-black tabular-nums {reelResult === 'win' ? 'text-success' : 'text-error'}">
								{reelResult === 'win' ? `+${fmt(winAmt)}` : `−${fmt(lostAmt)}`} XP
							</span>
						</div>
					{/if}
				{/snippet}
			</ReelStrip>
		</div>

		{#if !reelResult}
			<div class="mt-1 mb-0.5">
				<div class="text-base-content/60 mb-2 flex items-center justify-between text-[12.5px]">
					<span>Multiplier <strong class="text-base-content">{multiplier.toFixed(2)}×</strong></span>
					<span class="font-bold text-[#e0a52a]">Win chance {luckBoostLabel(baseWinChance, luckPercent)}</span>
				</div>
				<input
					type="range"
					class="range range-sm mb-2.5 w-full text-[#e0a52a]"
					min={MIN_MULT}
					max={MAX_MULT}
					step="0.05"
					bind:value={multiplier}
					disabled={busy}
					aria-label="Multiplier"
				/>
			</div>
		{/if}

		{#if reelResult && !busy}
			<div class="animate-game-verdict flex gap-2.5">
				<button type="button" class="btn border-base-300 bg-base-200 text-base-content shrink-0 font-bold" onclick={resetGamble}>
					<i class="fas fa-sliders"></i>Change bet
				</button>
				<button
					type="button"
					class="btn animate-game-charge flex-1 border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] font-black text-white"
					disabled={wagerXp <= 0 || wagerXp > spendable}
					onclick={play}
				>
					<i class="fas fa-rotate-right"></i>Spin again
				</button>
			</div>
		{:else}
			<WagerPicker percents={WAGER_PERCENTS} bind:selected={gamblePercent} bind:custom={gambleCustom} max={spendable} disabled={busy} />

			<div class="border-base-300 bg-base-200 mb-3 flex items-center justify-center gap-3.5 rounded-xl border px-3 py-2.5">
				<div class="flex min-w-0 flex-col items-center gap-0.5">
					<span class="text-base-content/55 text-[10px] font-bold tracking-[0.05em] uppercase">Wager</span>
					<span class="text-base-content text-[17px] font-black tabular-nums">{fmt(wagerXp)}</span>
				</div>
				<i class="fas fa-arrow-right text-base-content/30"></i>
				<div class="flex min-w-0 flex-col items-center gap-0.5">
					<span class="text-base-content/55 text-[10px] font-bold tracking-[0.05em] uppercase">Win pays</span>
					<span class="text-success text-[17px] font-black tabular-nums">{fmt(potentialWin)}</span>
				</div>
			</div>

			<button
				type="button"
				class="btn h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white {!busy && wagerXp > 0
					? 'animate-game-charge'
					: ''}"
				disabled={busy || wagerXp <= 0}
				onclick={play}
			>
				{#if busy}<i class="fas fa-circle-notch fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Spin {gamblePercent === 'custom'
						? ''
						: `${gamblePercent}%`}{/if}
			</button>
		{/if}
	</GameModal>
{/if}
