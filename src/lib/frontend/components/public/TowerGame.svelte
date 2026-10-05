<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { luckBoostLabel } from '$lib/items';
	import { TOWER_DOORS, TOWER_FLOORS, TOWER_PRIZES, towerBaseChance, towerLuckBonus, towerOddsDropPercent, towerPrize, towerSafeChance } from '$lib/tower';
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

	type TowerState = { active: boolean; floor: number; prize: number; climb: number; climbsUsed: number; resetsInMs: number; luckPercent: number };
	type TowerStep = { outcome: 'safe' | 'cashed' | 'cleared' | 'bust'; floor: number; payout: number; lost: number; door?: number; trapDoors?: number[] };
	type TowerReply = { state: TowerState; step?: TowerStep };
	type Reveal = { door: number; trapDoors: number[] };
	type RowStatus = 'active' | 'next' | 'cleared' | 'crown' | 'trap' | 'locked';
	type Face = 'locked' | 'next' | 'door' | 'passed' | 'gem' | 'gemMine' | 'trap' | 'trapMine';

	const ROW = 40;
	const GAP = 6;
	const INSET = 6;
	const VIEW = 290;
	const STACK = TOWER_FLOORS * ROW + (TOWER_FLOORS - 1) * GAP;
	const FLIP_MS = 520;
	const SETTLE_MS = 780;
	const DOORS = Array.from({ length: TOWER_DOORS }, (_, i) => i);
	const FLOORS = Array.from({ length: TOWER_FLOORS }, (_, i) => TOWER_FLOORS - i);
	const BURST = Array.from({ length: 18 }, (_, i) => {
		const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.2;
		const reach = 46 + (i % 3) * 18;
		return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.7), delay: (i % 4) * 35 };
	});

	const ROW_TONE: Record<RowStatus, string> = {
		active: 'bg-[#d9a528]/9 ring-1 ring-[#d9a528]/50 shadow-[0_0_26px_-12px_rgba(217,165,40,0.95)]',
		next: 'bg-base-100/50 ring-1 ring-[#d9a528]/25',
		cleared: 'bg-success/6',
		crown: 'bg-[#d9a528]/14 ring-1 ring-[#e0a52a]/70 shadow-[0_0_30px_-8px_rgba(224,165,42,0.95)]',
		trap: 'bg-error/9 ring-1 ring-error/45',
		locked: ''
	};
	const FACE: Record<Face, string> = {
		locked: 'border-base-300/80 bg-base-200/70 text-base-content/20',
		next: 'border-[#d9a528]/30 bg-base-200 text-[#d9a528]/55',
		door: 'border-[#d9a528]/60 bg-linear-to-b from-[#d9a528]/22 to-[#d9a528]/5 text-[#e0a52a] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_16px_-10px_rgba(217,165,40,0.9)] group-hover:border-[#e0a52a] group-hover:from-[#d9a528]/32',
		passed: 'border-success/25 bg-success/8 text-success/55',
		gem: 'border-base-300 bg-base-200 text-[#d9a528]/45',
		gemMine: 'border-[#e0a52a]/80 bg-linear-to-b from-[#f3c552]/40 to-[#d9a528]/10 text-[#e0a52a] shadow-[0_0_18px_-4px_rgba(224,165,42,0.9)]',
		trap: 'border-error/30 bg-error/8 text-error/55',
		trapMine: 'border-error/75 bg-error/20 text-error shadow-[0_0_18px_-4px_rgba(220,38,38,0.85)]'
	};
	const FACE_ICON: Record<Face, string> = {
		locked: 'fa-door-closed',
		next: 'fa-door-closed',
		door: 'fa-door-closed',
		passed: 'fa-door-open',
		gem: 'fa-gem',
		gemMine: 'fa-gem',
		trap: 'fa-skull',
		trapMine: 'fa-skull'
	};
	const VERDICT: Record<string, { label: string; tone: string }> = {
		cashed: { label: 'Cashed out', tone: 'text-success' },
		cleared: { label: 'Tower cleared', tone: 'text-[#e0a52a]' },
		bust: { label: 'Trapped', tone: 'text-error' }
	};

	let tower = $state<TowerState | null>(null);
	let verdict = $state<TowerStep | null>(null);
	let verdictClimb = $state(1);
	let path = $state<Record<number, Reveal>>({});
	let pending = $state<number | null>(null);
	let busy = $state(false);
	let shake = $state(false);
	let flash = $state(0);
	let burst = $state(0);
	let gain = $state<{ id: number; xp: number } | null>(null);
	let resetAt = $state(0);
	let now = $state(Date.now());

	const cleared = $derived(tower?.floor ?? 0);
	const climb = $derived(tower ? (tower.active ? tower.climb : tower.climbsUsed + 1) : 1);
	const oddsClimb = $derived(verdict ? verdictClimb : climb);
	const luck = $derived(tower?.luckPercent ?? 0);
	const drop = $derived(towerOddsDropPercent(climb));
	const won = $derived(!!verdict && verdict.payout > 0);
	const nextFloor = $derived(Math.min(TOWER_FLOORS, cleared + 1));
	const statFloor = $derived(verdict ? verdict.floor : tower?.active ? nextFloor : 1);
	const focus = $derived(verdict ? verdict.floor : tower?.active ? nextFloor : 1);
	const camera = $derived(Math.max(0, Math.min((focus - 2) * (ROW + GAP), STACK + 2 * INSET - VIEW)));
	const fade = $derived(`linear-gradient(to bottom, transparent 0, #000 ${Math.min(44, STACK + 2 * INSET - VIEW - camera)}px)`);
	const carried = $derived(verdict ? (verdict.payout > 0 ? verdict.payout : verdict.lost) : towerPrize(cleared));
	const resetsIn = $derived.by(() => {
		const ms = resetAt - now;
		if (!tower || tower.climbsUsed < 1 || resetAt <= 0 || ms <= 0) return '';
		const m = Math.ceil(ms / 60000);
		return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
	});

	const shown = new Tween(0, { duration: 480, easing: cubicOut });
	$effect(() => {
		shown.set(carried, { duration: prefersReducedMotion.current ? 0 : 480 });
	});

	$effect(() => {
		if (!tower || tower.active || busy || resetAt <= 0 || now < resetAt) return;
		resetAt = 0;
		void refresh();
	});

	function fmtPct(n: number): string {
		return Number.isInteger(n) ? `${n}` : n.toFixed(1);
	}

	function oddsLabel(floor: number, c: number): string {
		return luckBoostLabel(towerBaseChance(floor, c), towerLuckBonus(floor, c, luck), { max: 100 });
	}

	function oddsTone(chance: number): string {
		if (chance >= 60) return 'text-success';
		if (chance >= 40) return 'text-warning';
		return 'text-error';
	}

	function rowStatus(floor: number): RowStatus {
		if (verdict?.outcome === 'bust' && floor === verdict.floor) return 'trap';
		if (verdict?.outcome === 'cleared' && floor === TOWER_FLOORS) return 'crown';
		const done = verdict ? (verdict.outcome === 'bust' ? verdict.floor - 1 : verdict.floor) : tower?.active ? cleared : 0;
		if (floor <= done) return 'cleared';
		if (!verdict && tower?.active && floor === cleared + 1) return 'active';
		if (!verdict && !tower?.active && floor === 1) return 'next';
		return 'locked';
	}

	function prizeTone(status: RowStatus, floor: number): string {
		if (status === 'trap') return 'text-error line-through decoration-2';
		if (status === 'cleared') return 'text-success';
		if (status === 'active' || status === 'next' || status === 'crown') return 'text-[#e0a52a]';
		return floor === TOWER_FLOORS ? 'text-[#e0a52a]/75' : 'text-base-content/45';
	}

	function face(floor: number, door: number, status: RowStatus): { flipped: boolean; front: Face; back: Face } {
		const r = path[floor];
		if (r) {
			const trap = r.trapDoors.includes(door);
			const mine = door === r.door;
			return { flipped: true, front: 'door', back: trap ? (mine ? 'trapMine' : 'trap') : mine ? 'gemMine' : 'gem' };
		}
		const front: Face = status === 'active' ? 'door' : status === 'cleared' || status === 'crown' ? 'passed' : status === 'next' ? 'next' : 'locked';
		return { flipped: false, front, back: 'gem' };
	}

	function flipDelay(floor: number, door: number): number {
		const r = path[floor];
		if (!r || door === r.door) return 0;
		return 240 + DOORS.filter((d) => d !== r.door).indexOf(door) * 70;
	}

	function apply(state: TowerState) {
		tower = state;
		resetAt = state.resetsInMs > 0 ? Date.now() + state.resetsInMs : 0;
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
				if (d.state) apply(d.state);
				showToast(d.error || 'Play failed', 'error');
				return null;
			}
			return d;
		} catch {
			showToast('Play failed', 'error');
			return null;
		}
	}

	async function refresh() {
		const d = await send('state');
		if (d) apply(d.state);
	}

	function settle(d: TowerReply) {
		if (!d.step) return;
		verdictClimb = tower?.climb ?? climb;
		verdict = d.step;
		apply(d.state);
		if (d.step.payout > 0) {
			burst += 1;
			onpayout(d.step.payout);
		} else {
			flash += 1;
			shake = true;
			setTimeout(() => (shake = false), 500);
		}
	}

	onMount(() => {
		busy = true;
		refresh().finally(() => (busy = false));
		const ticker = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(ticker);
	});

	async function start() {
		if (busy) return;
		busy = true;
		const d = await send('start');
		if (d) {
			verdict = null;
			gain = null;
			path = {};
			apply(d.state);
		}
		busy = false;
	}

	async function pick(door: number) {
		if (busy || !tower?.active || verdict) return;
		busy = true;
		pending = door;
		const floor = cleared + 1;
		const d = await send('pick', door);
		pending = null;
		const step = d?.step;
		if (!d || !step) {
			busy = false;
			return;
		}
		path = { ...path, [floor]: { door: step.door ?? door, trapDoors: step.trapDoors ?? [] } };
		setTimeout(() => {
			if (step.outcome === 'safe') {
				apply(d.state);
				gain = { id: (gain?.id ?? 0) + 1, xp: towerPrize(step.floor) - towerPrize(step.floor - 1) };
			} else {
				settle(d);
			}
			busy = false;
		}, SETTLE_MS);
	}

	async function cashout() {
		if (busy || !tower?.active || cleared < 1 || verdict) return;
		busy = true;
		const d = await send('cashout');
		if (d) settle(d);
		busy = false;
	}
</script>

<GameModal icon="fa-tower-observation" title="Tower" state={verdict ? (won ? 'win' : 'lose') : 'idle'} {shake} closable={!busy} {onclose}>
	{#if !tower}
		<div class="text-base-content/50 grid h-[440px] place-items-center text-2xl">
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-triangle-exclamation"></i>{/if}
		</div>
	{:else}
		<div class="mb-3 flex items-end justify-between gap-3">
			<div class="relative min-w-0">
				<div class="text-[10px] font-bold tracking-[0.12em] uppercase {verdict ? VERDICT[verdict.outcome].tone : 'text-base-content/50'}">
					{verdict ? VERDICT[verdict.outcome].label : 'Prize'}
				</div>
				<div
					class="text-[28px] leading-none font-black tabular-nums {verdict && !won
						? 'text-error line-through decoration-2'
						: 'bg-linear-to-b from-[#f4cf6b] to-[#c8911a] bg-clip-text text-transparent'}"
				>
					{won ? '+' : ''}{fmt(Math.round(shown.current))}<span class="ml-1 text-[14px]">XP</span>
				</div>
				{#if gain}
					{#key gain.id}
						<span
							class="text-success motion-safe:animate-tower-gain pointer-events-none absolute top-0 left-full ml-2 text-[13px] font-black whitespace-nowrap opacity-0"
							>+{fmt(gain.xp)}</span
						>
					{/key}
				{/if}
				{#key burst}
					{#if burst > 0}
						<span class="pointer-events-none absolute top-1/2 left-12" aria-hidden="true">
							{#each BURST.slice(0, verdict?.outcome === 'cleared' ? 18 : 12) as p, i (i)}
								<span
									class="motion-safe:animate-tower-burst absolute size-1.5 rounded-full bg-[#f3c552] opacity-0 shadow-[0_0_6px_rgba(224,165,42,0.9)]"
									style="--x: {p.x}px; --y: {p.y}px; animation-delay: {p.delay}ms"
								></span>
							{/each}
						</span>
					{/if}
				{/key}
			</div>
			<div class="shrink-0 text-right">
				<div class="text-base-content/50 text-[10px] font-bold tracking-[0.12em] uppercase">Climb {climb}</div>
				<div class="text-[12.5px] font-bold {drop > 0 ? 'text-error' : 'text-success'}">{drop > 0 ? `Odds −${fmtPct(drop)}%` : 'Full odds'}</div>
				{#if resetsIn}<div class="text-base-content/45 text-[11px] tabular-nums">Reset {resetsIn}</div>{/if}
			</div>
		</div>

		<div class="border-base-300 from-base-300/50 to-base-200/40 relative mb-3 overflow-hidden rounded-2xl border bg-linear-to-b" style="height: {VIEW}px">
			<div class="absolute inset-0" style="-webkit-mask-image: {fade}; mask-image: {fade}">
				<ol
					class="absolute inset-x-1.5 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
					style="bottom: {INSET}px; gap: {GAP}px; transform: translateY({camera}px)"
				>
					{#each FLOORS as floor (floor)}
						{@const status = rowStatus(floor)}
						{@const chance = towerSafeChance(floor, oddsClimb, luck)}
						<li
							class="grid shrink-0 grid-cols-[44px_1fr_62px] items-center gap-1.5 rounded-xl px-1.5 transition-[background-color,box-shadow] duration-300 {ROW_TONE[
								status
							]}"
							style="height: {ROW}px"
						>
							<span class="text-[12px] font-black whitespace-nowrap tabular-nums {oddsTone(chance)} {status === 'locked' ? 'opacity-55' : ''}">
								{fmtPct(chance)}%{#if luck > 0}<i class="fas fa-clover ml-0.5 text-[8px]"></i>{/if}
							</span>
							<div class="grid h-8 grid-cols-3 gap-1.5">
								{#each DOORS as door (door)}
									{@const t = face(floor, door, status)}
									<button
										type="button"
										class="group size-full rounded-lg transition-transform duration-150 ease-out perspective-normal enabled:active:scale-[0.95] disabled:cursor-default"
										disabled={status !== 'active' || busy || !!verdict || !!path[floor]}
										aria-label="Floor {floor}, door {door + 1}"
										onclick={() => pick(door)}
									>
										<span
											class="relative block size-full transition-transform ease-[cubic-bezier(0.23,1,0.32,1)] transform-3d motion-reduce:transition-none {t.flipped
												? 'rotate-y-180'
												: ''} {pending === door && status === 'active' ? 'motion-safe:animate-tower-knock' : ''}"
											style="transition-duration: {FLIP_MS}ms; transition-delay: {t.flipped ? flipDelay(floor, door) : 0}ms"
										>
											<span
												class="absolute inset-0 grid place-items-center rounded-lg border text-[14px] transition-colors duration-200 backface-hidden {FACE[
													t.front
												]}"
											>
												<i class="fas {FACE_ICON[t.front]}"></i>
											</span>
											<span class="absolute inset-0 grid rotate-y-180 place-items-center rounded-lg border text-[14px] backface-hidden {FACE[t.back]}">
												<i class="fas {FACE_ICON[t.back]}"></i>
											</span>
										</span>
									</button>
								{/each}
							</div>
							<span class="inline-flex items-center justify-end gap-1 text-[12px] font-bold tabular-nums {prizeTone(status, floor)}">
								{#if floor === TOWER_FLOORS}<i class="fas fa-crown text-[10px] text-[#e0a52a]"></i>{:else if status === 'cleared'}<i
										class="fas fa-check text-[10px]"
									></i>{/if}{fmt(TOWER_PRIZES[floor - 1])}
							</span>
						</li>
					{/each}
				</ol>
			</div>
			{#key flash}
				{#if flash > 0}
					<div class="animate-tower-flash to-error/40 pointer-events-none absolute inset-0 bg-radial from-transparent from-35%"></div>
				{/if}
			{/key}
		</div>

		<div class="text-base-content/60 mb-3 flex items-center justify-between text-[12.5px]">
			<span>Floor {statFloor} <strong class="text-base-content">{fmt(towerPrize(statFloor))} XP</strong></span>
			<span class="font-bold text-[#e0a52a]">Safe chance {oddsLabel(statFloor, oddsClimb)}</span>
		</div>

		{#if tower.active && !verdict}
			<button
				type="button"
				class="btn h-auto w-full py-3.5 text-[15px] font-black transition-transform duration-150 ease-out active:scale-[0.98] {cleared > 0
					? 'border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white'
					: ''} {!busy && cleared > 0 ? 'animate-game-charge' : ''}"
				disabled={busy || cleared < 1}
				onclick={cashout}
			>
				<i class="fas fa-sack-dollar"></i>Cash out{cleared > 0 ? ` ${fmt(towerPrize(cleared))} XP` : ''}
			</button>
		{:else}
			<button
				type="button"
				class="btn h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white transition-transform duration-150 ease-out active:scale-[0.98] {busy
					? ''
					: 'animate-game-charge'}"
				disabled={busy}
				onclick={start}
			>
				<i class="fas fa-stairs"></i>Climb
			</button>
		{/if}
	{/if}
</GameModal>
