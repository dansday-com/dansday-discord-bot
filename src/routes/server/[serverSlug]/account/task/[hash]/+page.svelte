<script lang="ts">
	import { getContext, onMount, onDestroy } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { effectIcon, effectAccentHex, effectLabel } from '$lib/items.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const tzOffset = () => -new Date().getTimezoneOffset();

	let live = $state<any>(data.tasks);
	let busySlot = $state<number | null>(null);
	let now = $state(Date.now());
	let resetAt = $state(Date.now() + (Number(data.tasks?.resetsInMs) || 0));
	let celebrate = $state<{ streak: number; emoji: string; label: string } | null>(null);

	$effect(() => {
		live = data.tasks;
		resetAt = Date.now() + (Number(data.tasks?.resetsInMs) || 0);
	});

	let ticker: any = null;
	onMount(async () => {
		ticker = setInterval(() => (now = Date.now()), 1000);
		await refresh();
	});
	onDestroy(() => ticker && clearInterval(ticker));

	async function refresh() {
		try {
			const res = await fetch(`/api/tasks/${data.server.slug}/state`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, tz_offset: tzOffset() })
			});
			const body = await res.json();
			if (body?.success && body.tasks) {
				live = body.tasks;
				resetAt = Date.now() + (Number(body.tasks.resetsInMs) || 0);
			}
		} catch {
			/* keep server-rendered state */
		}
	}

	const tasks = $derived((live?.tasks ?? []) as any[]);
	const streak = $derived(
		live?.streak ?? { current: 0, longest: 0, freezes: 0, freezeMax: 2, nextMilestone: { at: 7, label: 'One week', emoji: '🔥' }, toNextMilestone: 7 }
	);
	const doneCount = $derived(tasks.filter((t) => t.claimed).length);
	const readyCount = $derived(tasks.filter((t) => t.complete && !t.claimed).length);
	const allDone = $derived(tasks.length > 0 && doneCount === tasks.length);

	const countdown = $derived.by(() => {
		const ms = Math.max(0, resetAt - now);
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	const milestoneTrack = $derived.by(() => {
		const marks = [7, 30, 100, 365];
		const cur = Number(streak.current) || 0;
		return marks.map((at) => ({ at, reached: cur >= at }));
	});

	const streakPct = $derived.by(() => {
		const cur = Number(streak.current) || 0;
		const next = Number(streak.nextMilestone?.at) || 7;
		const prevMarks = [0, 7, 30, 100, 365].filter((m) => m < next);
		const prev = prevMarks.length ? prevMarks[prevMarks.length - 1] : 0;
		const span = Math.max(1, next - prev);
		return Math.max(0, Math.min(100, ((cur - prev) / span) * 100));
	});

	function ringDash(t: any) {
		const pct = Math.max(0, Math.min(1, (Number(t.progress) || 0) / Math.max(1, Number(t.goal) || 1)));
		const c = 2 * Math.PI * 26;
		return `${(pct * c).toFixed(2)} ${c.toFixed(2)}`;
	}

	function diffAccent(d: string) {
		return d === 'hard' ? '#c0392b' : d === 'medium' ? '#c8911a' : '#1f8a4c';
	}

	async function claim(t: any) {
		if (ctx.readOnly || busySlot != null || !t.complete || t.claimed) return;
		busySlot = t.slot;
		try {
			const res = await fetch(`/api/tasks/${data.server.slug}/claim`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, slot: t.slot, tz_offset: tzOffset() })
			});
			const body = await res.json();
			if (!body?.success) {
				showToast(body?.error || 'Claim failed.', 'error');
				if (body?.tasks) live = body.tasks;
				return;
			}

			if (body.tasks) {
				live = body.tasks;
				resetAt = Date.now() + (Number(body.tasks.resetsInMs) || 0);
			}

			const g = body.granted;
			if (g?.kind === 'item') showToast(`Claimed ${g.name}!`, 'success');
			else showToast(`Claimed +${fmt(g?.xp ?? 0)} XP!`, 'success');

			if (body.milestone && body.streak) {
				celebrate = { streak: body.streak.current, emoji: body.milestone.emoji, label: body.milestone.label };
				setTimeout(() => (celebrate = null), 6000);
			}

			ctx.invalidateAll?.();
		} catch {
			showToast('Could not reach the server.', 'error');
		} finally {
			busySlot = null;
		}
	}
</script>

<svelte:head><title>Daily Tasks — {data.server.name}</title></svelte:head>

<div class="m-task">
	<section class="m-task-hero" class:m-task-hero--lit={Number(streak.current) > 0}>
		<div class="m-task-flame">
			<div class="m-task-flame-emoji">{Number(streak.current) > 0 ? '🔥' : '🌑'}</div>
			<div class="m-task-flame-num">{streak.current}</div>
			<div class="m-task-flame-lbl">day streak</div>
		</div>

		<div class="m-task-heroinfo">
			<div class="m-task-herotop">
				<div>
					<h2>{allDone ? 'All tasks cleared today' : `${doneCount}/${tasks.length} tasks claimed`}</h2>
					<p>
						{#if allDone}
							Come back tomorrow to keep the streak alive.
						{:else if readyCount > 0}
							{readyCount} reward{readyCount === 1 ? '' : 's'} waiting to be claimed.
						{:else}
							Finish your daily tasks to extend your streak.
						{/if}
					</p>
				</div>
				<div class="m-task-reset">
					<span class="m-task-reset-lbl">Resets in</span>
					<span class="m-task-reset-val">{countdown}</span>
				</div>
			</div>

			<div class="m-task-milestone">
				<div class="m-task-mbar">
					<div class="m-task-mfill" style="width:{streakPct}%"></div>
					{#each milestoneTrack as m}
						<span class="m-task-mdot" class:m-task-mdot--hit={m.reached} style="left:{Math.min(100, (m.at / 365) * 100)}%" title="{m.at} days"></span>
					{/each}
				</div>
				<div class="m-task-mmeta">
					<span><strong>{streak.toNextMilestone}</strong> days to {streak.nextMilestone?.emoji} {streak.nextMilestone?.label}</span>
					<span class="m-task-freeze" title="Freezes cover a missed day automatically">
						{#each Array(streak.freezeMax) as _, i}
							<i class="fas fa-snowflake" class:m-task-freeze--off={i >= streak.freezes}></i>
						{/each}
					</span>
				</div>
			</div>

			<div class="m-task-stats">
				<div><span>Longest</span><strong>{streak.longest} days</strong></div>
				<div><span>Freezes</span><strong>{streak.freezes}/{streak.freezeMax}</strong></div>
				<div><span>Today</span><strong>{doneCount}/{tasks.length}</strong></div>
			</div>
		</div>
	</section>

	{#if tasks.length === 0}
		<div class="m-task-empty">
			<i class="fas fa-list-check"></i>
			<h3>No tasks available</h3>
			<p>Daily tasks need leveling, items, or minigames enabled on this server.</p>
		</div>
	{:else}
		<div class="m-task-grid">
			{#each tasks as t (t.slot)}
				<article class="m-task-card" class:m-task-card--done={t.claimed} class:m-task-card--ready={t.complete && !t.claimed} style="--accent:{t.accent}">
					<header class="m-task-cardtop">
						<div class="m-task-ring">
							<svg viewBox="0 0 60 60" aria-hidden="true">
								<circle cx="30" cy="30" r="26" class="m-task-ringbg" />
								<circle cx="30" cy="30" r="26" class="m-task-ringfg" stroke-dasharray={ringDash(t)} />
							</svg>
							<i class="fas {t.icon}"></i>
						</div>
						<div class="m-task-cardhead">
							<span class="m-task-diff" style="--d:{diffAccent(t.difficulty)}">{t.difficulty}</span>
							<h3>{t.description}</h3>
							<span class="m-task-label">{t.label}</span>
						</div>
					</header>

					<div class="m-task-prog">
						<div class="m-task-progbar"><div class="m-task-progfill" style="width:{Math.min(100, (t.progress / Math.max(1, t.goal)) * 100)}%"></div></div>
						<span class="m-task-progtxt">{fmt(t.progress)}/{fmt(t.goal)} {t.unit}</span>
					</div>

					<footer class="m-task-cardfoot">
						{#if t.reward.kind === 'item'}
							<div class="m-task-reward" style="--rw:{effectAccentHex(t.reward.effectType)}">
								<i class="fas {effectIcon(t.reward.effectType)}"></i>
								<div>
									<strong>{t.reward.name}</strong>
									<span>{effectLabel(t.reward.effectType)} · worth {fmt(t.reward.cost)} XP</span>
								</div>
							</div>
						{:else}
							<div class="m-task-reward m-task-reward--xp">
								<i class="fas fa-star"></i>
								<div>
									<strong>+{fmt(t.reward.xp)} XP</strong>
									<span>Reward</span>
								</div>
							</div>
						{/if}

						{#if t.claimed}
							<span class="m-task-claimed"><i class="fas fa-circle-check"></i> Claimed</span>
						{:else if t.complete}
							<button class="m-task-claim" onclick={() => claim(t)} disabled={busySlot != null || ctx.readOnly}>
								{#if busySlot === t.slot}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-gift"></i>{/if}
								Claim
							</button>
						{:else}
							<span class="m-task-remain">{fmt(Math.max(0, t.goal - t.progress))} to go</span>
						{/if}
					</footer>
				</article>
			{/each}
		</div>
	{/if}
</div>

{#if celebrate}
	<div class="m-task-celebrate" role="status">
		<div class="m-task-celebrate-card">
			<div class="m-task-celebrate-emoji">{celebrate.emoji}</div>
			<h3>{celebrate.label} streak!</h3>
			<p>{celebrate.streak} days in a row. Keep it burning.</p>
		</div>
	</div>
{/if}
