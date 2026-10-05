<script lang="ts">
	import { onMount } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { luckBoostLabel } from '$lib/items';
	import { TOWER_BASE_SAFE_CHANCE, TOWER_DOORS, TOWER_FLOORS, TOWER_PRIZES, TOWER_RUNS_PER_DAY } from '$lib/tower';
	import GameModal from './GameModal.svelte';

	let {
		endpoint,
		card,
		fmt,
		onpayout,
		onclose
	}: {
		endpoint: string;
		card: string;
		fmt: (n: number) => string;
		onpayout: (xp: number) => void;
		onclose: () => void;
	} = $props();

	type TowerState = { active: boolean; floor: number; prize: number; runsLeft: number; resetsInMs: number; chance: number; luckPercent: number };
	type TowerStep = { outcome: 'safe' | 'cashed' | 'cleared' | 'bust'; floor: number; payout: number; lost: number; door?: number; trapDoor?: number };
	type TowerReply = { state: TowerState; step?: TowerStep };

	const REVEAL_MS = 900;
	const DOORS = Array.from({ length: TOWER_DOORS }, (_, i) => i);
	const LADDER = TOWER_PRIZES.map((prize, i) => ({ floor: i + 1, prize })).reverse();

	const ROW_TONE = {
		done: 'border-success/35 bg-success/12 text-success',
		next: 'border-[#d9a528]/70 bg-[#d9a528]/12 text-base-content shadow-[0_0_14px_-5px_rgba(217,165,40,0.9)]',
		trap: 'border-error/45 bg-error/14 text-error',
		idle: 'border-base-300 bg-base-200 text-base-content/55'
	};
	const DOOR_TONE = {
		closed: 'border-base-300 bg-base-200 text-[#d9a528] enabled:hover:border-[#d9a528]/70',
		safe: 'border-success/45 bg-success/14 text-success',
		trap: 'border-error/45 bg-error/14 text-error',
		empty: 'border-base-300 bg-base-200 text-base-content/30'
	};
	const DOOR_ICON = { closed: 'fa-door-closed', safe: 'fa-door-open', trap: 'fa-skull', empty: 'fa-door-open' };

	let tower = $state<TowerState | null>(null);
	let reveal = $state<TowerStep | null>(null);
	let verdict = $state<TowerStep | null>(null);
	let picked = $state<number | null>(null);
	let busy = $state(false);
	let shake = $state(false);

	const cleared = $derived(tower?.floor ?? 0);
	const won = $derived(!!verdict && verdict.payout > 0);
	const resetsIn = $derived.by(() => {
		const m = Math.max(1, Math.ceil((tower?.resetsInMs ?? 0) / 60000));
		return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
	});

	function rowTone(floor: number): keyof typeof ROW_TONE {
		if (verdict?.outcome === 'bust' && floor === verdict.floor) return 'trap';
		const done = verdict ? (verdict.outcome === 'bust' ? verdict.floor - 1 : verdict.floor) : cleared;
		if (floor <= done) return 'done';
		if (!verdict && tower?.active && floor === cleared + 1) return 'next';
		return 'idle';
	}

	function doorKind(door: number): keyof typeof DOOR_TONE {
		if (!reveal) return 'closed';
		if (door === reveal.trapDoor) return 'trap';
		return door === reveal.door ? 'safe' : 'empty';
	}

	async function send(action: string, door?: number): Promise<TowerReply | null> {
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card, action, door })
			});
			const d = await res.json();
			if (!d.success) {
				if (d.state) tower = d.state;
				showToast(d.error || 'Play failed', 'error');
				return null;
			}
			return d;
		} catch {
			showToast('Play failed', 'error');
			return null;
		}
	}

	function settle(d: TowerReply) {
		if (!d.step) return;
		verdict = d.step;
		tower = d.state;
		if (d.step.payout > 0) {
			onpayout(d.step.payout);
		} else {
			shake = true;
			setTimeout(() => (shake = false), 500);
		}
	}

	onMount(async () => {
		busy = true;
		const d = await send('state');
		if (d) tower = d.state;
		busy = false;
	});

	async function start() {
		if (busy) return;
		busy = true;
		const d = await send('start');
		if (d) {
			verdict = null;
			tower = d.state;
		}
		busy = false;
	}

	async function pick(door: number) {
		if (busy || !tower?.active) return;
		busy = true;
		picked = door;
		const d = await send('pick', door);
		picked = null;
		if (!d?.step) {
			busy = false;
			return;
		}
		reveal = d.step;
		setTimeout(() => {
			if (d.step?.outcome === 'safe') tower = d.state;
			else settle(d);
			reveal = null;
			busy = false;
		}, REVEAL_MS);
	}

	async function cashout() {
		if (busy || !tower?.active || cleared < 1) return;
		busy = true;
		const d = await send('cashout');
		if (d) settle(d);
		busy = false;
	}
</script>

<GameModal icon="fa-tower-observation" title="Tower" state={verdict ? (won ? 'win' : 'lose') : 'idle'} {shake} closable={!busy} {onclose}>
	{#if !tower}
		<div class="text-base-content/50 grid h-40 place-items-center text-2xl">
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-triangle-exclamation"></i>{/if}
		</div>
	{:else}
		<div class="text-base-content/60 mb-2 flex items-center justify-between text-[12.5px]">
			<span>Climbs left <strong class="text-base-content">{tower.runsLeft}/{TOWER_RUNS_PER_DAY}</strong></span>
			<span class="font-bold text-[#e0a52a]">
				Safe chance {luckBoostLabel(TOWER_BASE_SAFE_CHANCE, tower.luckPercent, { max: 100 })}
			</span>
		</div>

		<ol class="mb-3 flex flex-col gap-1">
			{#each LADDER as step (step.floor)}
				{@const tone = rowTone(step.floor)}
				<li class="flex h-[26px] items-center justify-between rounded-lg border px-2.5 text-[12px] font-bold transition-colors duration-250 {ROW_TONE[tone]}">
					<span class="inline-flex items-center gap-1.5">
						<i
							class="fas w-3.5 text-center text-[11px] {tone === 'done'
								? 'fa-check'
								: tone === 'trap'
									? 'fa-skull'
									: step.floor === TOWER_FLOORS
										? 'fa-crown'
										: 'fa-stairs'}"
						></i>Floor {step.floor}
					</span>
					<span class="tabular-nums">{fmt(step.prize)} XP</span>
				</li>
			{/each}
		</ol>

		{#if verdict}
			<div class="animate-game-verdict border-base-300 bg-base-200 mb-2.5 flex h-[74px] flex-col items-center justify-center gap-0.5 rounded-xl border">
				<span class="text-[13px] font-black tracking-[0.18em] uppercase {won ? 'text-success' : 'text-error'}">
					{verdict.outcome === 'cleared' ? 'TOWER CLEARED' : won ? 'CASHED OUT' : 'TRAPPED'}
				</span>
				<span class="text-[26px] font-black tabular-nums {won ? 'text-success' : 'text-error'}">+{fmt(verdict.payout)} XP</span>
			</div>
			<p class="text-base-content/55 mb-3 text-center text-[12px]">
				{#if won}
					Floor {verdict.floor} of {TOWER_FLOORS}. It is in your wallet.
				{:else if verdict.lost > 0}
					You dropped {fmt(verdict.lost)} XP. Your wallet is untouched.
				{:else}
					Nothing to drop yet. Your wallet is untouched.
				{/if}
			</p>
		{:else}
			<div class="mb-2.5 grid grid-cols-3 gap-2">
				{#each DOORS as door (door)}
					{@const kind = doorKind(door)}
					<button
						type="button"
						class="grid h-[74px] place-items-center rounded-xl border text-[27px] transition-colors duration-200 disabled:cursor-not-allowed {DOOR_TONE[
							kind
						]} {tower.active ? '' : 'opacity-45'}"
						disabled={busy || !tower.active}
						aria-label="Door {door + 1}"
						onclick={() => pick(door)}
					>
						<i class="fas {picked === door ? 'fa-circle-notch fa-spin' : DOOR_ICON[kind]}"></i>
					</button>
				{/each}
			</div>
			<p class="text-base-content/55 mb-3 text-center text-[12px]">
				{#if !tower.active}
					Free to play. Your own XP is never at risk.
				{:else if cleared < 1}
					Pick a door. One of the three is a trap.
				{:else}
					Cash out, or risk it for {fmt(TOWER_PRIZES[cleared])} XP.
				{/if}
			</p>
		{/if}

		{#if tower.active && !verdict}
			<button
				type="button"
				class="btn h-auto w-full py-3.5 text-[15px] font-black {cleared > 0
					? 'border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white'
					: ''} {!busy && cleared > 0 ? 'animate-game-charge' : ''}"
				disabled={busy || cleared < 1}
				onclick={cashout}
			>
				<i class="fas fa-sack-dollar"></i>{cleared > 0 ? `Cash out ${fmt(tower.prize)} XP` : 'Clear a floor to cash out'}
			</button>
		{:else if tower.runsLeft > 0}
			<button
				type="button"
				class="btn h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white {busy
					? ''
					: 'animate-game-charge'}"
				disabled={busy}
				onclick={start}
			>
				<i class="fas fa-stairs"></i>{verdict ? 'Climb again' : 'Start climb'}
			</button>
		{:else}
			<button type="button" class="btn h-auto w-full py-3.5 text-[15px] font-black" disabled>
				<i class="fas fa-hourglass-half"></i>No climbs left · back in {resetsIn}
			</button>
		{/if}
	{/if}
</GameModal>
