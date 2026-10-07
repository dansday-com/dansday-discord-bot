<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { sfx } from '$lib/frontend/sfx';
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

	const FLIP_MS = 520;
	const SETTLE_MS = 780;
	const DOORS = Array.from({ length: TOWER_DOORS }, (_, i) => i);
	const FOG = [2, 1];
	const BURST = Array.from({ length: 18 }, (_, i) => {
		const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.2;
		const reach = 70 + (i % 3) * 22;
		return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.5), delay: (i % 4) * 35 };
	});
	const ARCH = 'rounded-t-[999px] rounded-b-[10px]';

	const HERO_TONE: Record<RowStatus, string> = {
		active: 'border-[#d9a528]/55 bg-[#d9a528]/8 shadow-[0_0_28px_-14px_rgba(217,165,40,0.95)]',
		next: 'border-[#d9a528]/30 bg-base-100/60',
		cleared: 'border-success/40 bg-success/6',
		crown: 'border-[#e0a52a]/80 bg-[#d9a528]/14 shadow-[0_0_34px_-8px_rgba(224,165,42,0.95)]',
		trap: 'border-error/50 bg-error/8'
	};
	const PILL_TONE: Record<RowStatus, string> = {
		active: 'bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white shadow-[0_6px_16px_-10px_rgba(184,134,11,0.9)]',
		next: 'bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white',
		cleared: 'bg-success/15 text-success',
		crown: 'bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white',
		trap: 'bg-error/15 text-error line-through decoration-2'
	};
	const BACK: Record<Face, string> = {
		next: '',
		door: '',
		passed: 'border-success/35 bg-success/10 text-success/70',
		gem: 'border-base-300 bg-base-100 text-success/35',
		gemMine: 'border-success/60 bg-linear-to-b from-success/25 to-success/8 text-success shadow-[0_0_24px_-6px_var(--color-success)]',
		trap: 'border-error/30 bg-error/8 text-error/40',
		trapMine: 'border-error/70 bg-linear-to-b from-error/25 to-error/8 text-error shadow-[0_0_24px_-6px_var(--color-error)]'
	};
	const MINI: Record<Face, string> = {
		next: 'bg-base-300 text-base-content/30',
		door: 'bg-base-300 text-base-content/30',
		passed: 'bg-success/12 text-success/70',
		gem: 'bg-base-300/70 text-success/35',
		gemMine: 'bg-success/18 text-success',
		trap: 'bg-base-300/70 text-error/35',
		trapMine: 'bg-error/18 text-error'
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
	const VERDICT: Record<string, { label: string; tone: string; ring: string }> = {
		cashed: { label: 'Cashed out', tone: 'text-success', ring: 'border-success/60' },
		cleared: { label: 'Tower cleared', tone: 'text-[#e0a52a]', ring: 'border-[#e0a52a]/80' },
		bust: { label: 'Trapped', tone: 'text-error', ring: 'border-error/60' }
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
	let lift = $state(0);
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
	const trail = $derived([top - 1, top - 2].filter((f) => f > 0));
	const hero = $derived(rowStatus(top));
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
		if (chance >= 60) return 'text-success';
		if (chance >= 40) return 'text-warning';
		return 'text-error';
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
			sfx.payout(d.step.outcome === 'cleared' ? 1 : d.step.floor / TOWER_FLOORS);
			onpayout(d.step.payout);
		} else {
			flash += 1;
			sfx.bust();
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
		sfx.press();
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
		sfx.knock();
		const floor = cleared + 1;
		const d = await send('pick', door);
		pending = null;
		const step = d?.step;
		if (!d || !step) {
			busy = false;
			return;
		}
		path = { ...path, [floor]: { door: step.door ?? door, trapDoors: step.trapDoors ?? [] } };
		DOORS.forEach((other) => sfx.flip(flipDelay(floor, other) / 1000, other !== path[floor].door));
		setTimeout(() => {
			if (step.outcome === 'safe') {
				sfx.gem(step.floor);
				apply(d.state);
				lift += 1;
				gain = { id: (gain?.id ?? 0) + 1, xp: towerPrize(step.floor) - towerPrize(step.floor - 1) };
			} else {
				settle(d);
			}
			busy = false;
		}, SETTLE_MS);
	}

	async function cashout() {
		if (busy || !tower?.active || cleared < 1 || verdict) return;
		sfx.press();
		busy = true;
		const d = await send('cashout');
		if (d) settle(d);
		busy = false;
	}
</script>

<GameModal icon="fa-tower-observation" title="Tower" state={verdict ? (won ? 'win' : 'lose') : 'idle'} {shake} closable={!busy} {onclose}>
	{#if !tower}
		<div class="text-base-content/50 grid h-[460px] place-items-center text-2xl">
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-triangle-exclamation"></i>{/if}
		</div>
	{:else}
		<div class="mb-3 grid grid-cols-2 gap-2">
			<div class="border-base-300 bg-base-200 relative rounded-xl border px-3 py-2">
				<div class="text-base-content/55 text-[10px] font-bold tracking-[0.08em] uppercase">Win</div>
				<div
					class="text-[22px] leading-tight font-black whitespace-nowrap tabular-nums {verdict && !won
						? 'text-error line-through decoration-2'
						: 'bg-linear-to-b from-[#e8b53a] to-[#b8860b] bg-clip-text text-transparent'}"
				>
					{fmt(Math.round(shown.current))}<span class="ml-1 text-[12px]">XP</span>
				</div>
				{#if gain}
					{#key gain.id}
						<span class="text-success motion-safe:animate-tower-gain pointer-events-none absolute top-1.5 right-2.5 text-[12px] font-black opacity-0"
							>+{fmt(gain.xp)}</span
						>
					{/key}
				{/if}
			</div>
			<div class="border-base-300 bg-base-200 rounded-xl border px-3 py-2">
				<div class="text-base-content/55 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">Floor {top} safe chance</div>
				<div class="text-[22px] leading-tight font-black whitespace-nowrap tabular-nums {oddsTone(safe)}">
					{fmtPct(safe)}%{#if safeBonus > 0}<span class="text-base-content/55 ml-1 text-[11px]">({fmtPct(safeBase)} +{fmtPct(safeBonus)} 🍀)</span>{/if}
				</div>
			</div>
		</div>

		<div class="border-base-300 bg-base-200/50 relative mb-2.5 overflow-hidden rounded-2xl border p-2.5">
			{#key lift}
				<div class={lift > 0 ? 'motion-safe:animate-tower-climb' : ''}>
					<div class="relative mb-2 h-[76px]">
						{#if summit}
							<div class="pointer-events-none absolute inset-0 bg-radial-[ellipse_at_50%_0%] from-[#e0a52a]/35 to-transparent to-70%"></div>
						{:else}
							<div class="flex flex-col gap-2">
								{#each FOG as depth (depth)}
									<div
										class="grid h-[34px] grid-cols-[70px_1fr] items-center gap-2 {depth === 2 ? 'opacity-30 blur-[2.5px]' : 'opacity-55 blur-[1.2px]'}"
										aria-hidden="true"
									>
										<span class="bg-base-300 text-base-content/40 grid h-6 place-items-center rounded-md text-[12px] font-black">?</span>
										<div class="grid h-full grid-cols-3 gap-2.5">
											{#each DOORS as door (door)}
												<span class="bg-base-300 text-base-content/35 grid place-items-center text-[12px] font-black {ARCH}">?</span>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
						{#if verdict}
							<div class="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-live="polite">
								<div
									class="motion-safe:animate-tower-pop bg-base-100 relative rounded-2xl border-2 px-6 py-2 text-center shadow-xl {VERDICT[verdict.outcome]
										.ring}"
								>
									{#key burst}
										{#if won}
											<span class="absolute top-1/2 left-1/2" aria-hidden="true">
												{#each BURST.slice(0, summit ? 18 : 12) as p, i (i)}
													<span
														class="motion-safe:animate-tower-burst absolute size-1.5 rounded-full bg-[#e8b53a] opacity-0 shadow-[0_0_6px_rgba(224,165,42,0.9)]"
														style="--x: {p.x}px; --y: {p.y}px; animation-delay: {p.delay}ms"
													></span>
												{/each}
											</span>
										{/if}
									{/key}
									<div class="text-[11px] font-black tracking-[0.18em] uppercase {VERDICT[verdict.outcome].tone}">{VERDICT[verdict.outcome].label}</div>
									<div class="text-[24px] leading-tight font-black tabular-nums {won ? 'text-[#e0a52a]' : 'text-error line-through decoration-2'}">
										{won ? '+' : ''}{fmt(won ? verdict.payout : verdict.lost)} XP
									</div>
								</div>
							</div>
						{/if}
					</div>

					<div class="mb-2 rounded-xl border p-2.5 transition-[background-color,border-color,box-shadow] duration-300 {HERO_TONE[hero]}">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-base-content/60 text-[11px] font-black tracking-[0.14em] uppercase">Floor {top}</span>
							<span class="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-black tabular-nums {PILL_TONE[hero]}">
								{#if hero === 'crown'}<i class="fas fa-crown text-[11px]"></i>{/if}{fmt(TOWER_PRIZES[top - 1])} XP
							</span>
						</div>
						<div class="grid grid-cols-3 gap-2.5 pb-1.5">
							{#each DOORS as door (door)}
								{@const t = face(top, door, hero)}
								<button
									type="button"
									class="group h-[104px] transition-[translate] duration-150 ease-out perspective-[700px] enabled:hover:-translate-y-0.5 enabled:active:translate-y-0.5 disabled:cursor-default {ARCH}"
									disabled={hero !== 'active' || busy || !!verdict || !!path[top]}
									aria-label="Door {door + 1}"
									onclick={() => pick(door)}
								>
									<span
										class="relative block size-full transition-transform ease-[cubic-bezier(0.23,1,0.32,1)] transform-3d motion-reduce:transition-none {t.flipped
											? 'rotate-y-180'
											: ''} {pending === door ? 'motion-safe:animate-tower-knock' : ''}"
										style="transition-duration: {FLIP_MS}ms; transition-delay: {t.flipped ? flipDelay(top, door) : 0}ms"
									>
										{#if t.front === 'passed'}
											<span class="absolute inset-0 grid place-items-center border text-[22px] backface-hidden {ARCH} {BACK.passed}">
												<i class="fas fa-check"></i>
											</span>
										{:else}
											<span
												class="absolute inset-0 border border-[#a87412]/60 bg-linear-to-b from-[#f2c95c] to-[#c48f1c] shadow-[0_5px_0_0_#8a5f08,inset_0_2px_0_rgba(255,255,255,0.35)] backface-hidden {ARCH} {t.front ===
												'next'
													? 'opacity-60'
													: 'group-hover:from-[#f7d777]'}"
											>
												<span class="absolute inset-x-[17%] top-[13%] bottom-[9%] border border-[#8a5f08]/35 bg-linear-to-b from-[#dcaa3c] to-[#a87412] {ARCH}"
												></span>
												<span class="absolute top-[58%] right-[25%] size-2 rounded-full bg-[#fff3cc] shadow-[0_0_6px_rgba(255,236,170,0.95)]"></span>
											</span>
										{/if}
										<span class="absolute inset-0 grid rotate-y-180 place-items-center border text-[30px] backface-hidden {ARCH} {BACK[t.back]}">
											<i class="fas {FACE_ICON[t.back]}"></i>
										</span>
									</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="flex h-[76px] flex-col gap-2">
						{#each trail as floor (floor)}
							<div class="grid h-[34px] shrink-0 grid-cols-[70px_1fr] items-center gap-2 {floor === top - 2 ? 'opacity-60' : ''}">
								<span class="bg-success/15 text-success inline-flex h-6 items-center justify-center gap-1 rounded-md text-[11.5px] font-black tabular-nums">
									<i class="fas fa-check text-[9px]"></i>{fmt(TOWER_PRIZES[floor - 1])}
								</span>
								<div class="grid h-full grid-cols-3 gap-2.5">
									{#each DOORS as door (door)}
										{@const t = face(floor, door, 'cleared')}
										<span class="grid place-items-center rounded-md text-[13px] {MINI[t.flipped ? t.back : 'passed']}">
											<i class="fas {FACE_ICON[t.flipped ? t.back : 'passed']}"></i>
										</span>
									{/each}
								</div>
							</div>
						{/each}
						{#if trail.length < 2}
							<div class="from-base-300/80 min-h-0 flex-1 rounded-md bg-linear-to-b to-transparent"></div>
						{/if}
					</div>
				</div>
			{/key}

			{#key flash}
				{#if flash > 0}
					<div class="animate-tower-flash to-error/35 pointer-events-none absolute inset-0 bg-radial from-transparent from-30%"></div>
				{/if}
			{/key}
		</div>

		<div class="mb-3 flex items-center justify-between px-0.5 text-[12px] font-bold">
			<span class="text-base-content/60">Climb {climb}</span>
			<span class={drop > 0 ? 'text-error' : 'text-success'}>{drop > 0 ? `Odds −${fmtPct(drop)}%` : 'Full odds'}</span>
			<span class="text-base-content/50 tabular-nums">{resetsIn ? `Reset ${resetsIn}` : ''}</span>
		</div>

		{#if tower.active && !verdict}
			<button
				type="button"
				class="btn h-auto w-full py-3.5 text-[15px] font-black {cleared > 0
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
				class="btn h-auto w-full border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] py-3.5 text-[15px] font-black text-white {busy
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
