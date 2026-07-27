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
	let busySlot = $state<string | null>(null);
	let claimingLogin = $state(false);
	let tab = $state<'daily' | 'weekly'>('daily');
	let now = $state(Date.now());
	let resetAt = $state(Date.now() + (Number(data.tasks?.resetsInMs) || 0));
	let weeklyResetAt = $state(Date.now() + (Number(data.tasks?.weeklyResetsInMs) || 0));
	let celebrate = $state<{ streak: number; emoji: string; label: string } | null>(null);
	let loginWin = $state<{ day: number; jackpot: boolean; text: string } | null>(null);

	$effect(() => {
		live = data.tasks;
		resetAt = Date.now() + (Number(data.tasks?.resetsInMs) || 0);
		weeklyResetAt = Date.now() + (Number(data.tasks?.weeklyResetsInMs) || 0);
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
			if (body?.success && body.tasks) applyState(body.tasks);
		} catch {
			/* keep server-rendered state */
		}
	}

	function applyState(next: any) {
		live = next;
		resetAt = Date.now() + (Number(next.resetsInMs) || 0);
		weeklyResetAt = Date.now() + (Number(next.weeklyResetsInMs) || 0);
	}

	const dailyTasks = $derived((live?.daily ?? []) as any[]);
	const weeklyTasks = $derived((live?.weekly ?? []) as any[]);
	const tasks = $derived(tab === 'weekly' ? weeklyTasks : dailyTasks);
	const login = $derived(live?.login ?? { rewards: [], canClaim: false, nextDay: 1, cycleDays: 7 });
	const streak = $derived(
		live?.streak ?? { current: 0, longest: 0, freezes: 0, freezeMax: 2, nextMilestone: { at: 7, label: 'One week', emoji: '🔥' }, toNextMilestone: 7 }
	);
	const doneCount = $derived(dailyTasks.filter((t) => t.claimed).length);
	const readyCount = $derived([...dailyTasks, ...weeklyTasks].filter((t) => t.complete && !t.claimed).length);
	const allDone = $derived(dailyTasks.length > 0 && doneCount === dailyTasks.length);
	const weeklyDone = $derived(weeklyTasks.filter((t) => t.claimed).length);

	const countdown = $derived.by(() => {
		const ms = Math.max(0, resetAt - now);
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	});

	const weeklyCountdown = $derived.by(() => {
		const ms = Math.max(0, weeklyResetAt - now);
		const d = Math.floor(ms / 86400000);
		const h = Math.floor((ms % 86400000) / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
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
		const key = `${t.period}:${t.slot}`;
		if (ctx.readOnly || busySlot != null || !t.complete || t.claimed) return;
		busySlot = key;
		try {
			const res = await fetch(`/api/tasks/${data.server.slug}/claim`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, slot: t.slot, period: t.period, tz_offset: tzOffset() })
			});
			const body = await res.json();
			if (!body?.success) {
				showToast(body?.error || 'Claim failed.', 'error');
				if (body?.tasks) applyState(body.tasks);
				return;
			}

			if (body.tasks) applyState(body.tasks);

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

	async function claimLogin() {
		if (ctx.readOnly || claimingLogin || !login.canClaim) return;
		claimingLogin = true;
		try {
			const res = await fetch(`/api/tasks/${data.server.slug}/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, tz_offset: tzOffset() })
			});
			const body = await res.json();
			if (!body?.success) {
				showToast(body?.error || 'Claim failed.', 'error');
				if (body?.tasks) applyState(body.tasks);
				return;
			}

			if (body.tasks) applyState(body.tasks);

			const g = body.granted;
			const text = g?.kind === 'item' ? g.name : `+${fmt(g?.xp ?? 0)} XP`;
			if (body.bagWasFull) showToast(`Bag was full — received ${text} instead.`, 'info');
			loginWin = { day: body.day, jackpot: !!body.jackpot, text };
			setTimeout(() => (loginWin = null), body.jackpot ? 6000 : 3500);

			ctx.invalidateAll?.();
		} catch {
			showToast('Could not reach the server.', 'error');
		} finally {
			claimingLogin = false;
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

	<section class="m-task-login">
		<div class="m-task-loginhead">
			<div>
				<h3><i class="fas fa-gift"></i> Daily check-in</h3>
				<p>Free reward every day — day {login.cycleDays} is the big one.</p>
			</div>
			{#if login.canClaim}
				<button class="m-task-claim m-task-claim--login" onclick={claimLogin} disabled={claimingLogin || ctx.readOnly}>
					{#if claimingLogin}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-hand-sparkles"></i>{/if}
					Claim day {login.nextDay}
				</button>
			{:else}
				<span class="m-task-claimed"><i class="fas fa-circle-check"></i> Claimed today</span>
			{/if}
		</div>

		<div class="m-task-days">
			{#each login.rewards as r (r.day)}
				<div class="m-task-day" class:m-task-day--claimed={r.claimed} class:m-task-day--current={r.current} class:m-task-day--jackpot={r.jackpot}>
					<span class="m-task-daynum">Day {r.day}</span>
					<span class="m-task-dayicon">
						{#if r.claimed}
							<i class="fas fa-circle-check"></i>
						{:else if r.kind === 'item'}
							<i class="fas fa-gem"></i>
						{:else}
							<i class="fas fa-star"></i>
						{/if}
					</span>
					<span class="m-task-dayval">
						{#if r.kind === 'item'}Item{:else}{fmt(r.xp)}{/if}
					</span>
				</div>
			{/each}
		</div>
	</section>

	<div class="m-task-tabs">
		<button class="m-task-tab" class:m-task-tab--active={tab === 'daily'} onclick={() => (tab = 'daily')}>
			<i class="fas fa-sun"></i> Daily
			<span class="m-task-tabcount">{doneCount}/{dailyTasks.length}</span>
		</button>
		<button class="m-task-tab" class:m-task-tab--active={tab === 'weekly'} onclick={() => (tab = 'weekly')}>
			<i class="fas fa-calendar-week"></i> Weekly
			<span class="m-task-tabcount">{weeklyDone}/{weeklyTasks.length}</span>
		</button>
		<span class="m-task-tabreset">
			<i class="fas fa-rotate"></i>
			{tab === 'weekly' ? weeklyCountdown : countdown}
		</span>
	</div>

	{#if tasks.length === 0}
		<div class="m-task-empty">
			<i class="fas fa-list-check"></i>
			<h3>No {tab} tasks available</h3>
			<p>Tasks need leveling, items, or minigames enabled on this server.</p>
		</div>
	{:else}
		<div class="m-task-grid">
			{#each tasks as t (`${t.period}:${t.slot}`)}
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
						<span class="m-task-progtxt">{fmt(t.progress)}/{fmt(t.goal)} {t.unit === 'xp' ? 'XP' : t.unit}</span>
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
								{#if busySlot === `${t.period}:${t.slot}`}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-gift"></i>{/if}
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
{:else if loginWin}
	<div class="m-task-celebrate" role="status">
		<div class="m-task-celebrate-card">
			<div class="m-task-celebrate-emoji">{loginWin.jackpot ? '🎁' : '✨'}</div>
			<h3>{loginWin.jackpot ? 'Day 7 jackpot!' : `Day ${loginWin.day} claimed`}</h3>
			<p>{loginWin.text}</p>
		</div>
	</div>
{/if}
