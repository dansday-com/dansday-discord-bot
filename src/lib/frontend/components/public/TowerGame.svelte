<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { blur } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { TOWER_DOORS, TOWER_FLOORS, TOWER_PRIZES, towerBaseChance, towerOddsDropPercent, towerPrize, towerSafeChance } from '$lib/tower';
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
	type RowStatus = 'active' | 'next' | 'cleared' | 'crown' | 'trap';
	type Face = 'next' | 'door' | 'passed' | 'gem' | 'gemMine' | 'trap' | 'trapMine';

	const ROW = 48;
	const GAP = 6;
	const INSET = 8;
	const KEEP = ROW + GAP + 22;
	const VIEW = 300;
	const FLIP_MS = 520;
	const SETTLE_MS = 780;
	const DOORS = Array.from({ length: TOWER_DOORS }, (_, i) => i);
	const FOG = [2, 1];
	const BURST = Array.from({ length: 18 }, (_, i) => {
		const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.2;
		const reach = 70 + (i % 3) * 22;
		return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.6), delay: (i % 4) * 35 };
	});
	const TILE = 'rounded-t-[16px] rounded-b-[7px]';

	const ROW_TONE: Record<RowStatus, string> = {
		active: 'bg-[#f0be3c]/8 ring-1 ring-[#f0be3c]/45',
		next: 'bg-[#f0be3c]/5 ring-1 ring-[#f0be3c]/25',
		cleared: '',
		crown: 'bg-[#f0be3c]/14 ring-1 ring-[#f6cf5b]/70 shadow-[0_0_30px_-6px_rgba(246,207,91,0.8)]',
		trap: 'bg-[#ff4d5e]/10 ring-1 ring-[#ff4d5e]/45'
	};
	const PILL_TONE: Record<RowStatus, string> = {
		active: 'bg-linear-to-b from-[#f6cf5b] to-[#d99a1b] text-[#2a1a00] shadow-[0_0_14px_-3px_rgba(246,207,91,0.8)]',
		next: 'bg-linear-to-b from-[#f6cf5b] to-[#d99a1b] text-[#2a1a00]',
		cleared: 'bg-[#0f3b28] text-[#34e27a]',
		crown: 'bg-linear-to-b from-[#f6cf5b] to-[#d99a1b] text-[#2a1a00] shadow-[0_0_18px_-2px_rgba(246,207,91,0.9)]',
		trap: 'bg-[#4a1520] text-[#ff4d5e] line-through decoration-2'
	};
	const FACE: Record<Face, string> = {
		next: 'bg-[#2c4150] text-[#f0be3c]/40 shadow-[0_3px_0_0_#15222b]',
		door: 'bg-[#3a5366] text-[#f0be3c]/75 ring-1 ring-[#f0be3c]/45 shadow-[0_4px_0_0_#1a2c38,inset_0_1px_0_rgba(255,255,255,0.08)] group-hover:bg-[#4a6a80] group-hover:text-[#f6cf5b]',
		passed: 'bg-[#1d2d38] text-[#34e27a]/45 shadow-[0_3px_0_0_#15222b]',
		gem: 'bg-[#1d2d38] text-[#34e27a]/35',
		gemMine: 'bg-[#0f3b28] text-[#34e27a] ring-1 ring-[#34e27a]/70 shadow-[0_0_18px_-2px_rgba(52,226,122,0.7)]',
		trap: 'bg-[#1d2d38] text-[#ff4d5e]/40',
		trapMine: 'bg-[#4a1520] text-[#ff4d5e] ring-1 ring-[#ff4d5e]/70 shadow-[0_0_18px_-2px_rgba(255,77,94,0.75)]'
	};
	const FACE_ICON: Record<Face, string> = {
		next: 'fa-door-closed',
		door: 'fa-door-closed',
		passed: 'fa-check',
		gem: 'fa-gem',
		gemMine: 'fa-gem',
		trap: 'fa-skull',
		trapMine: 'fa-skull'
	};
	const VERDICT: Record<string, { label: string; tone: string }> = {
		cashed: { label: 'Cashed out', tone: 'text-[#34e27a]' },
		cleared: { label: 'Tower cleared', tone: 'text-[#f6cf5b]' },
		bust: { label: 'Trapped', tone: 'text-[#ff4d5e]' }
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
	const summit = $derived(verdict?.outcome === 'cleared');
	const top = $derived(verdict ? verdict.floor : tower?.active ? Math.min(TOWER_FLOORS, cleared + 1) : 1);
	const visible = $derived(Array.from({ length: top }, (_, i) => top - i));
	const camera = $derived(Math.max(0, INSET + (top - 1) * (ROW + GAP) - KEEP));
	const focusBottom = $derived(INSET + (top - 1) * (ROW + GAP) - camera);
	const safe = $derived(towerSafeChance(top, oddsClimb, luck));
	const safeBase = $derived(towerBaseChance(top, oddsClimb));
	const safeBonus = $derived(Math.round((safe - safeBase) * 10) / 10);
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

	function oddsTone(chance: number): string {
		if (chance >= 60) return 'text-[#34e27a]';
		if (chance >= 40) return 'text-[#f6cf5b]';
		return 'text-[#ff4d5e]';
	}

	function rowStatus(floor: number): RowStatus {
		if (verdict?.outcome === 'bust' && floor === verdict.floor) return 'trap';
		if (verdict?.outcome === 'cleared' && floor === TOWER_FLOORS) return 'crown';
		if (!verdict && tower?.active && floor === cleared + 1) return 'active';
		if (!verdict && !tower?.active) return 'next';
		return 'cleared';
	}

	function face(floor: number, door: number, status: RowStatus): { flipped: boolean; front: Face; back: Face } {
		const r = path[floor];
		if (r) {
			const trap = r.trapDoors.includes(door);
			const mine = door === r.door;
			return { flipped: true, front: 'door', back: trap ? (mine ? 'trapMine' : 'trap') : mine ? 'gemMine' : 'gem' };
		}
		const front: Face = status === 'active' ? 'door' : status === 'next' ? 'next' : 'passed';
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
	<div class="-mx-1 rounded-2xl border border-[#22313d] bg-[#0b141c] p-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
		{#if !tower}
			<div class="grid h-[440px] place-items-center text-2xl text-white/40">
				{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-triangle-exclamation"></i>{/if}
			</div>
		{:else}
			<div class="mb-2.5 grid grid-cols-2 gap-2">
				<div class="relative rounded-xl border border-[#22313d] bg-[#0f1a24] px-3 py-2">
					<div class="text-[10px] font-bold tracking-[0.14em] uppercase {verdict ? VERDICT[verdict.outcome].tone : 'text-white/45'}">
						{verdict ? VERDICT[verdict.outcome].label : 'Win'}
					</div>
					<div
						class="text-[22px] leading-tight font-black whitespace-nowrap tabular-nums {verdict && !won
							? 'text-[#ff4d5e] line-through decoration-2'
							: 'text-[#f6cf5b]'}"
					>
						{fmt(Math.round(shown.current))}<span class="ml-1 text-[12px]">XP</span>
					</div>
					{#if gain}
						{#key gain.id}
							<span class="motion-safe:animate-tower-gain pointer-events-none absolute top-1.5 right-2.5 text-[12px] font-black text-[#34e27a] opacity-0"
								>+{fmt(gain.xp)}</span
							>
						{/key}
					{/if}
				</div>
				<div class="rounded-xl border border-[#22313d] bg-[#0f1a24] px-3 py-2">
					<div class="text-[10px] font-bold tracking-[0.14em] whitespace-nowrap text-white/45 uppercase">Floor {top} · Safe</div>
					<div class="text-[22px] leading-tight font-black whitespace-nowrap tabular-nums {oddsTone(safe)}">
						{fmtPct(safe)}%{#if safeBonus > 0}<span class="ml-1 text-[11px] text-white/55">({fmtPct(safeBase)} +{fmtPct(safeBonus)} 🍀)</span>{/if}
					</div>
				</div>
			</div>

			<div class="relative mb-2.5 overflow-hidden rounded-xl border border-[#22313d] bg-[#0f1a24]" style="height: {VIEW}px">
				<div
					class="pointer-events-none absolute inset-x-8 bottom-0 h-20 rounded-full bg-[#f0be3c]/14 blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
					style="transform: translateY({-(focusBottom - 14)}px)"
				></div>

				<ol
					class="absolute inset-x-2 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
					style="bottom: {INSET}px; gap: {GAP}px; transform: translateY({camera}px)"
				>
					{#if !summit}
						{#each FOG as depth (depth)}
							<li
								class="grid shrink-0 grid-cols-[62px_1fr] items-center gap-1.5 {depth === 2 ? 'opacity-25 blur-[3px]' : 'opacity-45 blur-[1.5px]'}"
								style="height: {ROW}px"
								aria-hidden="true"
							>
								<span class="grid h-7 place-items-center rounded-md bg-[#1d2d38] text-[12px] font-black text-white/30">?</span>
								<div class="grid h-10 grid-cols-3 gap-1.5">
									{#each DOORS as door (door)}
										<span class="grid place-items-center bg-[#22333f] text-[13px] font-black text-white/25 shadow-[0_3px_0_0_#15222b] {TILE}">?</span>
									{/each}
								</div>
							</li>
						{/each}
					{/if}
					{#each visible as floor (floor)}
						{@const status = rowStatus(floor)}
						<li
							in:blur={{ duration: prefersReducedMotion.current ? 0 : 420, amount: 8 }}
							class="grid shrink-0 grid-cols-[62px_1fr] items-center gap-1.5 rounded-xl px-1 transition-[background-color,box-shadow] duration-300 {ROW_TONE[
								status
							]}"
							style="height: {ROW}px"
						>
							<span
								class="inline-flex h-7 items-center justify-center gap-1 rounded-md text-[12px] font-black whitespace-nowrap tabular-nums transition-colors duration-300 {PILL_TONE[
									status
								]}"
							>
								{#if status === 'crown'}<i class="fas fa-crown text-[10px]"></i>{/if}{fmt(TOWER_PRIZES[floor - 1])}
							</span>
							<div class="grid h-10 grid-cols-3 gap-1.5">
								{#each DOORS as door (door)}
									{@const t = face(floor, door, status)}
									<button
										type="button"
										class="group size-full transition-[translate] duration-100 ease-out perspective-normal enabled:active:translate-y-[2px] disabled:cursor-default {TILE}"
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
											<span class="absolute inset-0 grid place-items-center text-[15px] transition-colors duration-200 backface-hidden {TILE} {FACE[t.front]}">
												<i class="fas {FACE_ICON[t.front]}"></i>
											</span>
											<span class="absolute inset-0 grid rotate-y-180 place-items-center text-[16px] backface-hidden {TILE} {FACE[t.back]}">
												<i class="fas {FACE_ICON[t.back]}"></i>
											</span>
										</span>
									</button>
								{/each}
							</div>
						</li>
					{/each}
				</ol>

				{#if !summit}
					<div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-[#0f1a24] via-[#0f1a24]/75 to-transparent"></div>
				{:else}
					<div class="pointer-events-none absolute inset-x-0 top-0 h-28 bg-radial-[ellipse_at_50%_0%] from-[#f6cf5b]/30 to-transparent to-70%"></div>
				{/if}
				<div class="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-[#0f1a24] to-transparent"></div>

				{#key flash}
					{#if flash > 0}
						<div class="animate-tower-flash pointer-events-none absolute inset-0 bg-radial from-transparent from-30% to-[#ff4d5e]/45"></div>
					{/if}
				{/key}

				{#if verdict}
					<div class="pointer-events-none absolute inset-x-0 top-10 z-10 grid place-items-center" aria-live="polite">
						<div
							class="motion-safe:animate-tower-pop relative rounded-2xl border-2 bg-[#0b141c]/92 px-6 py-3 text-center {won
								? 'border-[#f6cf5b] shadow-[0_0_44px_-6px_rgba(246,207,91,0.75)]'
								: 'border-[#ff4d5e] shadow-[0_0_44px_-8px_rgba(255,77,94,0.65)]'}"
						>
							{#key burst}
								{#if won}
									<span class="absolute top-1/2 left-1/2" aria-hidden="true">
										{#each BURST.slice(0, summit ? 18 : 12) as p, i (i)}
											<span
												class="motion-safe:animate-tower-burst absolute size-1.5 rounded-full bg-[#f6cf5b] opacity-0 shadow-[0_0_6px_rgba(246,207,91,0.9)]"
												style="--x: {p.x}px; --y: {p.y}px; animation-delay: {p.delay}ms"
											></span>
										{/each}
									</span>
								{/if}
							{/key}
							<div class="text-[11px] font-black tracking-[0.2em] uppercase {VERDICT[verdict.outcome].tone}">{VERDICT[verdict.outcome].label}</div>
							<div class="text-[28px] leading-tight font-black tabular-nums {won ? 'text-[#f6cf5b]' : 'text-[#ff4d5e] line-through decoration-2'}">
								{won ? '+' : ''}{fmt(won ? verdict.payout : verdict.lost)} XP
							</div>
							<div class="text-[11px] font-bold text-white/50">Floor {verdict.floor}</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="mb-2.5 flex items-center justify-between px-0.5 text-[11.5px] font-bold">
				<span class="text-white/50">Climb {climb}</span>
				<span class={drop > 0 ? 'text-[#ff4d5e]' : 'text-[#34e27a]'}>{drop > 0 ? `Odds −${fmtPct(drop)}%` : 'Full odds'}</span>
				<span class="text-white/40 tabular-nums">{resetsIn ? `Reset ${resetsIn}` : ''}</span>
			</div>

			{#if tower.active && !verdict}
				<button
					type="button"
					class="btn h-auto w-full border-none bg-linear-to-b from-[#3ee883] to-[#18a94e] py-3.5 text-[15px] font-black text-[#03200e] shadow-[0_4px_0_0_#0c6a30] transition-[translate,box-shadow] duration-100 ease-out active:translate-y-[3px] active:shadow-[0_1px_0_0_#0c6a30] disabled:border-none disabled:bg-[#1d2d38] disabled:bg-none disabled:text-white/35 disabled:shadow-none"
					disabled={busy || cleared < 1}
					onclick={cashout}
				>
					<i class="fas fa-sack-dollar"></i>Cash out{cleared > 0 ? ` ${fmt(towerPrize(cleared))} XP` : ''}
				</button>
			{:else}
				<button
					type="button"
					class="btn h-auto w-full border-none bg-linear-to-b from-[#f6cf5b] to-[#d99a1b] py-3.5 text-[15px] font-black text-[#2a1a00] shadow-[0_4px_0_0_#9a6a0c] transition-[translate,box-shadow] duration-100 ease-out active:translate-y-[3px] active:shadow-[0_1px_0_0_#9a6a0c] disabled:border-none disabled:bg-[#1d2d38] disabled:bg-none disabled:text-white/35 disabled:shadow-none"
					disabled={busy}
					onclick={start}
				>
					<i class="fas fa-stairs"></i>Climb
				</button>
			{/if}
		{/if}
	</div>
</GameModal>
