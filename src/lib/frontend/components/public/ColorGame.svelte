<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { sfx } from '$lib/frontend/sfx';
	import {
		COLOR_AXES,
		COLOR_AXIS_MAX,
		COLOR_MAX_SCORE,
		COLOR_MAX_TOTAL,
		COLOR_MEMORIZE_MS,
		COLOR_ROUNDS,
		colorLuma,
		colorOpeningGuess,
		colorTotal,
		colorXp,
		hsbToCss,
		type ColorAxis,
		type ColorRound,
		type Hsb
	} from '$lib/color';
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

	type ColorState = {
		active: boolean;
		round: number;
		rounds: ColorRound[];
		target: Hsb | null;
	};
	type ColorStep = ColorRound & { round: number; done: boolean; total?: number; payout?: number };
	type ColorReply = { state: ColorState; step?: ColorStep };
	type Phase = 'idle' | 'memorize' | 'dial' | 'reveal' | 'summary';

	const THUMB = 14;
	const PIPS = Array.from({ length: COLOR_ROUNDS }, (_, i) => i);
	const HUE_STOPS = Array.from({ length: 13 }, (_, i) => `hsl(${i * 30} 100% 50%)`).join(', ');
	const AXIS_LABEL: Record<ColorAxis, string> = { h: 'Hue', s: 'Saturation', b: 'Brightness' };
	const STEPS = [
		{ icon: 'fa-eye', text: `See a color for ${COLOR_MEMORIZE_MS / 1000} seconds` },
		{ icon: 'fa-sliders', text: 'Rebuild it on the three strips' },
		{ icon: 'fa-bullseye', text: `Up to ${COLOR_MAX_SCORE} XP a round, ${COLOR_MAX_TOTAL} a game` }
	];
	const REMARKS: [number, string][] = [
		[0.97, 'Dead on.'],
		[0.9, 'A shade off.'],
		[0.8, 'Sharp eye.'],
		[0.65, 'Close call.'],
		[0.45, 'Right family.'],
		[0.25, 'Wrong aisle.'],
		[0, 'Not even close.']
	];
	const BURST = Array.from({ length: 18 }, (_, i) => {
		const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.2;
		const reach = 70 + (i % 3) * 22;
		return { x: Math.round(Math.cos(angle) * reach), y: Math.round(Math.sin(angle) * reach * 0.5), delay: (i % 4) * 35 };
	});
	const LABEL = 'text-[10px] font-bold tracking-[0.08em] uppercase';
	const GOLD = 'border-none bg-linear-to-br from-[#e0a52a] to-[#b8860b] text-white';

	let game = $state<ColorState | null>(null);
	let phase = $state<Phase>('idle');
	let rounds = $state<ColorRound[]>([]);
	let landed = $state(0);
	let target = $state<Hsb | null>(null);
	let upcoming = $state<Hsb | null>(null);
	let guess = $state<Hsb>({ h: 0, s: 50, b: 50 });
	let last = $state<ColorStep | null>(null);
	let result = $state<{ total: number; payout: number } | null>(null);
	let remaining = $state(COLOR_MEMORIZE_MS);
	let shownScore = $state(0);
	let settled = $state(false);
	let dragging = $state<ColorAxis | null>(null);
	let busy = $state(false);
	let burst = $state(0);

	let countdown = 0;
	let counter = 0;

	const roundNo = $derived(phase === 'reveal' || phase === 'summary' ? rounds.length : Math.min(COLOR_ROUNDS, rounds.length + 1));
	const playing = $derived(phase === 'memorize' || phase === 'dial' || phase === 'reveal');
	const banked = $derived(colorXp(colorTotal(rounds.slice(0, landed).map((r) => r.score))));
	const won = $derived(phase === 'summary' && !!result && result.payout > 0);
	const spoken = $derived.by(() => {
		if (phase === 'memorize') return 'Memorize this color.';
		if (phase === 'dial') return 'Rebuild the color with the hue, saturation and brightness sliders.';
		if (phase === 'reveal' && settled && last) return `Round ${last.round} scored ${last.score.toFixed(2)}. ${remark(last.score)}`;
		if (phase === 'summary' && settled && result) return `Final score ${result.total.toFixed(2)}. You won ${result.payout} XP.`;
		return '';
	});

	const shown = new Tween(0, { duration: 480, easing: cubicOut });
	$effect(() => {
		shown.set(banked, { duration: prefersReducedMotion.current ? 0 : 480 });
	});

	function remark(score: number, max = COLOR_MAX_SCORE): string {
		return REMARKS.find(([min]) => score / max >= min)?.[1] ?? '';
	}

	function scoreTone(score: number, max = COLOR_MAX_SCORE): string {
		if (score >= max * 0.8) return 'text-success';
		if (score >= max * 0.5) return 'text-warning';
		return 'text-error';
	}

	function ink(c: Hsb): string {
		return colorLuma(c) > 0.6 ? '#141414' : '#ffffff';
	}

	function ratio(axis: ColorAxis, value: number): number {
		const r = value / COLOR_AXIS_MAX[axis];
		return axis === 'h' ? r : 1 - r;
	}

	function valueAt(axis: ColorAxis, r: number): number {
		return Math.round((axis === 'h' ? r : 1 - r) * COLOR_AXIS_MAX[axis]);
	}

	function gradient(axis: ColorAxis, c: Hsb): string {
		if (axis === 'h') return `linear-gradient(to bottom, ${HUE_STOPS})`;
		const top = axis === 's' ? { ...c, s: 100 } : { ...c, b: 100 };
		const bottom = axis === 's' ? { ...c, s: 0 } : { ...c, b: 0 };
		return `linear-gradient(to bottom, ${hsbToCss(top)}, ${hsbToCss(bottom)})`;
	}

	function pipStyle(i: number): string {
		return i < landed && rounds[i] ? `background: ${hsbToCss(rounds[i].target)}; border-color: transparent` : '';
	}

	function setAxis(axis: ColorAxis, value: number) {
		if (guess[axis] === value) return;
		guess = { ...guess, [axis]: value };
		sfx.tick(axis, ratio(axis, value));
	}

	function pointerValue(e: PointerEvent, axis: ColorAxis): number {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return valueAt(axis, Math.min(1, Math.max(0, (e.clientY - rect.top - THUMB / 2) / (rect.height - THUMB))));
	}

	function grab(e: PointerEvent, axis: ColorAxis) {
		if (phase !== 'dial' || busy) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = axis;
		setAxis(axis, pointerValue(e, axis));
	}

	function drag(e: PointerEvent, axis: ColorAxis) {
		if (dragging !== axis || phase !== 'dial' || busy) return;
		setAxis(axis, pointerValue(e, axis));
	}

	function nudge(e: KeyboardEvent, axis: ColorAxis) {
		if (phase !== 'dial' || busy) return;
		const max = COLOR_AXIS_MAX[axis];
		const up = axis === 'h' ? -1 : 1;
		const steps: Record<string, number> = { ArrowUp: up, ArrowDown: -up, PageUp: up * 10, PageDown: -up * 10 };
		let value: number;
		if (steps[e.key]) value = Math.min(max, Math.max(0, guess[axis] + steps[e.key]));
		else if (e.key === 'Home') value = axis === 'h' ? 0 : max;
		else if (e.key === 'End') value = axis === 'h' ? max : 0;
		else return;
		e.preventDefault();
		setAxis(axis, value);
	}

	function resync() {
		cancelAnimationFrame(countdown);
		cancelAnimationFrame(counter);
		phase = 'idle';
		rounds = game?.rounds ?? [];
		landed = rounds.length;
		target = game?.target ?? null;
		last = null;
		result = null;
		settled = false;
	}

	async function send(action: string, pick?: Hsb): Promise<ColorReply | null> {
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card, action, ...pick })
			});
			const d = await res.json();
			if (!d.success) {
				if (d.state) game = d.state;
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
		if (!d) return;
		game = d.state;
		if (phase === 'idle') resync();
	}

	function countTo(value: number, max: number, onLand: () => void) {
		cancelAnimationFrame(counter);
		if (prefersReducedMotion.current) {
			shownScore = value;
			onLand();
			return;
		}
		shownScore = 0;
		const from = performance.now();
		const ms = 500 + (value / max) * 700;
		let beat = -1;
		const frame = (t: number) => {
			const p = Math.min(1, Math.max(0, (t - from) / ms));
			shownScore = value * cubicOut(p);
			const at = Math.floor((shownScore / max) * 25);
			if (p < 1 && at !== beat) {
				beat = at;
				sfx.count(shownScore / max);
			}
			if (p < 1) {
				counter = requestAnimationFrame(frame);
				return;
			}
			onLand();
		};
		counter = requestAnimationFrame(frame);
	}

	function startRound() {
		if (!target) return;
		cancelAnimationFrame(countdown);
		guess = colorOpeningGuess(target);
		last = null;
		settled = false;
		remaining = COLOR_MEMORIZE_MS;
		phase = 'memorize';
		sfx.show();

		const until = performance.now() + COLOR_MEMORIZE_MS;
		let beat = Math.ceil(COLOR_MEMORIZE_MS / 1000);
		const frame = (t: number) => {
			remaining = Math.min(COLOR_MEMORIZE_MS, Math.max(0, until - t));
			const left = Math.ceil(remaining / 1000);
			if (left > 0 && left < beat) {
				beat = left;
				sfx.second(left === 1);
			}
			if (remaining > 0) {
				countdown = requestAnimationFrame(frame);
				return;
			}
			phase = 'dial';
			sfx.go();
		};
		countdown = requestAnimationFrame(frame);
	}

	async function begin() {
		if (busy || !game) return;
		sfx.press();
		if (!game.active) {
			busy = true;
			const d = await send('start');
			busy = false;
			if (!d) return;
			game = d.state;
		}
		resync();
		startRound();
	}

	async function lockIn() {
		if (busy || phase !== 'dial') return;
		busy = true;
		dragging = null;
		sfx.lock();
		const before = game;
		const d = await send('guess', guess);
		busy = false;
		const step = d?.step;
		if (!d || !step) {
			if (game !== before) resync();
			return;
		}
		last = step;
		guess = step.guess;
		rounds = [...rounds, { target: step.target, guess: step.guess, score: step.score }];
		upcoming = d.state.target;
		game = d.state;
		if (step.done) {
			result = { total: step.total ?? colorTotal(rounds.map((r) => r.score)), payout: step.payout ?? 0 };
			if (result.payout > 0) onpayout(result.payout);
		}
		phase = 'reveal';
		countTo(step.score, COLOR_MAX_SCORE, () => {
			settled = true;
			landed = rounds.length;
			sfx.land(step.score / COLOR_MAX_SCORE);
		});
	}

	function advance() {
		if (phase !== 'reveal' || !settled) return;
		sfx.press();
		const final = result;
		if (!final) {
			target = upcoming;
			startRound();
			return;
		}
		settled = false;
		phase = 'summary';
		countTo(final.total, COLOR_MAX_TOTAL, () => {
			settled = true;
			burst += 1;
			sfx.payout(final.total / COLOR_MAX_TOTAL);
		});
	}

	onMount(() => {
		busy = true;
		refresh().finally(() => (busy = false));
		return () => {
			cancelAnimationFrame(countdown);
			cancelAnimationFrame(counter);
		};
	});
</script>

{#snippet hsb(c: Hsb)}
	<span class="inline-flex gap-1.5 tabular-nums"><span>H{c.h}</span><span>S{c.s}</span><span>B{c.b}</span></span>
{/snippet}

<GameModal icon="fa-eye-dropper" title="Color" state={won ? 'win' : 'idle'} closable={!busy} {onclose}>
	{#if !game}
		<div class="text-base-content/50 grid h-[410px] place-items-center text-2xl">
			{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-triangle-exclamation"></i>{/if}
		</div>
	{:else}
		<span class="sr-only" aria-live="polite">{spoken}</span>

		<div class="mb-3 grid grid-cols-2 gap-2">
			<div class="border-base-300 bg-base-200 rounded-xl border px-3 py-2">
				<div class="text-base-content/55 {LABEL}">Win</div>
				<div
					class="bg-linear-to-b from-[#e8b53a] to-[#b8860b] bg-clip-text text-[22px] leading-tight font-black whitespace-nowrap text-transparent tabular-nums"
				>
					{fmt(Math.round(shown.current))}<span class="ml-1 text-[12px]">XP</span>
				</div>
			</div>
			<div class="border-base-300 bg-base-200 rounded-xl border px-3 py-2">
				<div class="text-base-content/55 whitespace-nowrap {LABEL}">Round {roundNo} of {COLOR_ROUNDS}</div>
				<div class="flex h-[27.5px] items-center gap-1" aria-hidden="true">
					{#each PIPS as i (i)}
						<span
							class="h-3.5 flex-1 rounded-[5px] border transition-colors duration-300 {playing && i === roundNo - 1 && i >= landed
								? 'border-[#d9a528] bg-[#d9a528]/20'
								: 'border-base-300 bg-base-300'}"
							style={pipStyle(i)}
						></span>
					{/each}
				</div>
			</div>
		</div>

		<div class="mb-3 flex h-[272px] gap-2.5">
			<div class="border-base-300 bg-base-200 relative isolate min-w-0 flex-1 overflow-hidden rounded-2xl border">
				{#if phase === 'memorize' && target}
					<div class="flex h-full flex-col justify-end p-3.5" style="background: {hsbToCss(target)}; color: {ink(target)}">
						<div class="text-[40px] leading-none font-black tabular-nums">{(remaining / 1000).toFixed(2)}</div>
						<div class="mt-1.5 opacity-70 {LABEL}">Seconds to remember</div>
						<span class="absolute inset-x-0 bottom-0 h-1 origin-left bg-current opacity-55" style="transform: scaleX({remaining / COLOR_MEMORIZE_MS})"></span>
					</div>
				{:else if phase === 'dial'}
					<div class="flex h-full flex-col justify-between p-3.5" style="background: {hsbToCss(guess)}; color: {ink(guess)}">
						<div class="opacity-70 {LABEL}">Rebuild it from memory</div>
						<div class="text-[15px] font-black">{@render hsb(guess)}</div>
					</div>
				{:else if phase === 'reveal' && last}
					<div class="grid h-full grid-rows-2">
						<div class="flex flex-col p-3" style="background: {hsbToCss(last.target)}; color: {ink(last.target)}">
							<div class="opacity-70 {LABEL}">Original</div>
							<div class="text-[13px] font-black">{@render hsb(last.target)}</div>
						</div>
						<div class="flex flex-col justify-end p-3" style="background: {hsbToCss(last.guess)}; color: {ink(last.guess)}">
							<div class="text-[13px] font-black">{@render hsb(last.guess)}</div>
							<div class="opacity-70 {LABEL}">Your pick</div>
						</div>
					</div>
					<div class="pointer-events-none absolute inset-0 grid place-items-center">
						<div class="motion-safe:animate-tower-pop border-base-300 bg-base-100 rounded-2xl border-2 px-4 py-1.5 text-center shadow-xl">
							<div class="text-[26px] leading-tight font-black tabular-nums {scoreTone(last.score)}">{shownScore.toFixed(2)}</div>
							<div class="text-base-content/60 h-4 text-[11px] leading-4 font-bold whitespace-nowrap">{settled ? remark(last.score) : ''}</div>
						</div>
					</div>
				{:else if phase === 'summary' && result}
					<div class="flex h-full flex-col p-3.5">
						<div class="text-center">
							<div class="text-base-content/55 {LABEL}">Score</div>
							<div class="text-[40px] leading-none font-black tabular-nums {scoreTone(result.total, COLOR_MAX_TOTAL)}">
								{shownScore.toFixed(2)}<span class="text-base-content/40 ml-1 text-[14px]">/ {COLOR_MAX_TOTAL}</span>
							</div>
							<div class="relative mt-1.5 grid h-[46px] place-items-center">
								{#if settled}
									{#key burst}
										{#if result.payout > 0}
											<span class="absolute top-1/2 left-1/2" aria-hidden="true">
												{#each BURST as p, i (i)}
													<span
														class="motion-safe:animate-tower-burst absolute size-1.5 rounded-full opacity-0"
														style="--x: {p.x}px; --y: {p.y}px; animation-delay: {p.delay}ms; background: {hsbToCss(rounds[i % rounds.length].target)}"
													></span>
												{/each}
											</span>
										{/if}
									{/key}
									<div class="motion-safe:animate-tower-pop">
										<div class="text-[22px] leading-tight font-black tabular-nums {result.payout > 0 ? 'text-[#e0a52a]' : 'text-base-content/50'}">
											+{fmt(result.payout)} XP
										</div>
										<div class="text-base-content/60 text-[11px] font-bold">{remark(result.total, COLOR_MAX_TOTAL)}</div>
									</div>
								{/if}
							</div>
						</div>
						<div class="text-base-content/45 mt-auto mb-1.5 text-center {LABEL}">Original over yours</div>
						<div class="grid grid-cols-5 gap-1.5">
							{#each rounds as r, i (i)}
								<div class="text-center">
									<div class="border-base-300 grid h-[68px] grid-rows-2 overflow-hidden rounded-lg border">
										<span style="background: {hsbToCss(r.target)}"></span>
										<span style="background: {hsbToCss(r.guess)}"></span>
									</div>
									<div class="mt-1 text-[11.5px] font-black tabular-nums {scoreTone(r.score)}">{r.score.toFixed(2)}</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="pointer-events-none absolute inset-0 -z-1 opacity-20 blur-2xl" style="background: conic-gradient(from 90deg, {HUE_STOPS})"></div>
					<div class="flex h-full flex-col justify-center gap-3 p-3.5">
						{#if game.active}
							<div class="text-base-content text-[15px] font-black">Game in progress</div>
							<div class="text-base-content/60 text-[12.5px] leading-snug font-bold">Round {roundNo} of {COLOR_ROUNDS} is waiting.</div>
						{:else}
							{#each STEPS as step (step.icon)}
								<div class="text-base-content flex items-start gap-2.5 text-[12.5px] leading-snug font-bold">
									<span class="bg-base-100 grid size-7 shrink-0 place-items-center rounded-lg text-[12px] text-[#d9a528]"><i class="fas {step.icon}"></i></span>
									<span class="pt-1">{step.text}</span>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			{#if phase !== 'summary'}
				<div class="flex gap-1.5 transition-opacity duration-200 {phase === 'dial' || phase === 'reveal' ? '' : 'opacity-40'}">
					{#each COLOR_AXES as axis (axis)}
						<div class="flex flex-col items-center gap-1">
							<div
								role="slider"
								tabindex={phase === 'dial' ? 0 : -1}
								aria-label={AXIS_LABEL[axis]}
								aria-orientation="vertical"
								aria-valuemin={0}
								aria-valuemax={COLOR_AXIS_MAX[axis]}
								aria-valuenow={guess[axis]}
								aria-disabled={phase !== 'dial'}
								class="border-base-300 relative w-10 flex-1 touch-none rounded-xl border select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a528] {phase ===
								'dial'
									? 'cursor-ns-resize'
									: ''}"
								style="background: {gradient(axis, guess)}"
								onpointerdown={(e) => grab(e, axis)}
								onpointermove={(e) => drag(e, axis)}
								onpointerup={() => (dragging = null)}
								onpointercancel={() => (dragging = null)}
								onkeydown={(e) => nudge(e, axis)}
							>
								{#if phase === 'reveal' && last}
									<span
										class="pointer-events-none absolute inset-x-0"
										style="top: calc({ratio(axis, last.target[axis])} * (100% - {THUMB}px) + {THUMB / 2}px)"
										aria-hidden="true"
									>
										<span
											class="absolute top-0 left-0 size-0 -translate-y-1/2 border-y-[5px] border-l-[7px] border-y-transparent border-l-white drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]"
										></span>
										<span
											class="absolute top-0 right-0 size-0 -translate-y-1/2 border-y-[5px] border-r-[7px] border-y-transparent border-r-white drop-shadow-[0_0_1px_rgba(0,0,0,0.9)]"
										></span>
									</span>
								{/if}
								<span
									class="pointer-events-none absolute inset-x-[3px] rounded-md border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.35)]"
									style="height: {THUMB}px; top: calc({ratio(axis, guess[axis])} * (100% - {THUMB}px))"
								></span>
							</div>
							<span class="text-base-content/55 text-[10px] font-black">{axis.toUpperCase()}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if phase === 'memorize'}
			<button type="button" class="btn h-auto w-full py-3.5 text-[15px] font-black" disabled><i class="fas fa-eye"></i>Memorize</button>
		{:else if phase === 'dial'}
			<button type="button" class="btn h-auto w-full py-3.5 text-[15px] font-black {GOLD} {busy ? '' : 'animate-game-charge'}" disabled={busy} onclick={lockIn}>
				{#if busy}<i class="fas fa-circle-notch fa-spin"></i>{:else}<i class="fas fa-lock"></i>{/if}Lock in
			</button>
		{:else if phase === 'reveal'}
			<button type="button" class="btn h-auto w-full py-3.5 text-[15px] font-black {settled ? GOLD : ''}" disabled={!settled} onclick={advance}>
				<i class="fas {result ? 'fa-flag-checkered' : 'fa-forward'}"></i>{result ? 'See results' : 'Next color'}
			</button>
		{:else}
			<button
				type="button"
				class="btn h-auto w-full py-3.5 text-[15px] font-black {GOLD} {busy ? '' : 'animate-game-charge'}"
				disabled={busy || (phase === 'summary' && !settled)}
				onclick={begin}
			>
				<i class="fas {game.active ? 'fa-play' : 'fa-eye-dropper'}"></i>{game.active ? 'Resume' : phase === 'summary' ? 'Play again' : 'Play'}
			</button>
		{/if}
	{/if}
</GameModal>
