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
	let taskWin = $state<{ title: string; text: string; item: boolean } | null>(null);

	type ReelCell = { name: string; cost: number; effectType: string };
	let itemRoll = $state<{ day: number; jackpot: boolean; won: ReelCell } | null>(null);
	let reel = $state<ReelCell[]>([]);
	let reelOffset = $state(0);
	let reelAnimating = $state(false);
	let reelSettled = $state(false);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	const reelPool = $derived<ReelCell[]>(live?.reelPool ?? []);

	$effect(() => {
		if (!itemRoll) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	function decoyCells(n: number): ReelCell[] {
		const pool = reelPool;
		if (pool.length === 0) return [];
		return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
	}

	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('.m-task-reel-cell')?.[index];
			if (!cell) return;
			reelOffset = wrapW / 2 - (cell.offsetLeft + cell.offsetWidth / 2);
		});
	}

	async function runItemRoll(day: number, jackpot: boolean, won: ReelCell) {
		const cells = decoyCells(40);
		if (cells.length === 0) {
			loginWin = { day, jackpot, text: won.name };
			setTimeout(() => (loginWin = null), jackpot ? 6000 : 3500);
			return;
		}

		const landIndex = 32;
		cells[landIndex] = won;
		reel = cells;
		reelAnimating = false;
		reelSettled = false;
		reelOffset = 0;
		itemRoll = { day, jackpot, won };

		await new Promise((r) => requestAnimationFrame(() => r(null)));
		reelWrapEl?.offsetHeight;
		centerCell(2);
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		reelAnimating = true;
		centerCell(landIndex);

		setTimeout(() => (reelSettled = true), 3400);
	}

	let synced = $state(false);

	$effect(() => {
		const incoming = data.tasks;
		if (synced) return;
		if (!incoming) return;
		live = incoming;
		resetAt = Date.now() + (Number(incoming.resetsInMs) || 0);
		weeklyResetAt = Date.now() + (Number(incoming.weeklyResetsInMs) || 0);
	});

	let ticker: any = null;
	onMount(async () => {
		document.cookie = `tz_offset=${tzOffset()}; path=/; max-age=31536000; SameSite=Lax`;
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
			synced = false;
		}
	}

	function applyState(next: any) {
		live = next;
		synced = true;
		resetAt = Date.now() + (Number(next.resetsInMs) || 0);
		weeklyResetAt = Date.now() + (Number(next.weeklyResetsInMs) || 0);
		ctx.setTaskSummary?.(next.streak ?? null);

		if (next.streakEarned && next.streakMilestone) {
			celebrate = { streak: next.streak.current, emoji: next.streakMilestone.emoji, label: next.streakMilestone.label };
			setTimeout(() => (celebrate = null), 6000);
		}
	}

	const dailyTasks = $derived((live?.daily ?? []) as any[]);
	const weeklyTasks = $derived((live?.weekly ?? []) as any[]);
	const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
	const tasks = $derived(
		[...(tab === 'weekly' ? weeklyTasks : dailyTasks)].sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1) || a.slot - b.slot)
	);
	const login = $derived(live?.login ?? { rewards: [], canClaim: false, nextDay: 1, cycleDays: 7 });
	const doneCount = $derived(dailyTasks.filter((t) => t.claimed).length);
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
			const item = g?.kind === 'item';
			taskWin = {
				title: t.period === 'weekly' ? 'Weekly task done' : 'Task complete',
				text: item ? g.name : `+${fmt(g?.xp ?? 0)} XP`,
				item
			};
			setTimeout(() => (taskWin = null), 3500);

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

			if (g?.kind === 'item') {
				await runItemRoll(body.day, !!body.jackpot, {
					name: g.name,
					cost: Number(g.cost) || 0,
					effectType: String(g.effectType || '')
				});
			} else {
				loginWin = { day: body.day, jackpot: !!body.jackpot, text };
				setTimeout(() => (loginWin = null), body.jackpot ? 6000 : 3500);
			}

			ctx.invalidateAll?.();
		} catch {
			showToast('Could not reach the server.', 'error');
		} finally {
			claimingLogin = false;
		}
	}
</script>

<svelte:head><title>Daily Tasks — {data.server.name}</title></svelte:head>

{#snippet dayFace(r: any, busy: boolean)}
	<span class="m-task-daynum">Day {r.day}</span>
	<span class="m-task-dayicon">
		{#if busy}
			<i class="fas fa-spinner fa-spin"></i>
		{:else if r.claimed}
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
{/snippet}

<div class="m-task">
	<section class="m-task-login">
		<div class="m-task-loginhead">
			<div>
				<h3><i class="fas fa-gift"></i> Daily check-in</h3>
				<p>
					{#if login.tzKnown === false}
						Checking today’s reward…
					{:else if login.canClaim}
						Tap day {login.nextDay} to claim — day {login.cycleDays} is the big one.
					{:else}
						Claimed today. Come back tomorrow for day {login.nextDay}.
					{/if}
				</p>
			</div>
			{#if !login.canClaim && login.tzKnown !== false}
				<span class="m-task-claimed"><i class="fas fa-circle-check"></i> Claimed today</span>
			{/if}
		</div>

		<div class="m-task-days">
			{#each login.rewards as r (r.day)}
				{@const claimable = r.current && login.canClaim && !ctx.readOnly}
				{#if claimable}
					<button
						type="button"
						class="m-task-day m-task-day--current m-task-day--claimable"
						class:m-task-day--jackpot={r.jackpot}
						disabled={claimingLogin}
						aria-label={`Claim day ${r.day} reward`}
						onclick={claimLogin}
					>
						{@render dayFace(r, claimingLogin)}
						<span class="m-task-daycta">Claim</span>
					</button>
				{:else}
					<div class="m-task-day" class:m-task-day--claimed={r.claimed} class:m-task-day--jackpot={r.jackpot}>
						{@render dayFace(r, false)}
					</div>
				{/if}
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

	{#if tasks.length === 0 && !synced}
		<div class="m-task-empty">
			<i class="fas fa-spinner fa-spin"></i>
			<h3>Loading your tasks…</h3>
			<p>Lining up today's goals.</p>
		</div>
	{:else if tasks.length === 0}
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

{#if itemRoll}
	<div class="m-task-roll" role="status">
		<div class="m-task-roll-card" class:m-task-roll-card--done={reelSettled} class:m-task-roll-card--jackpot={itemRoll.jackpot && reelSettled}>
			<p class="m-task-roll-eyebrow">{itemRoll.jackpot ? `Day ${itemRoll.day} jackpot` : `Day ${itemRoll.day} reward`}</p>
			<h3 class="m-task-roll-title">{reelSettled ? 'You got it!' : 'Rolling your item…'}</h3>

			<div class="m-task-reelwrap" class:m-task-reelwrap--done={reelSettled} bind:this={reelWrapEl}>
				<div class="m-task-reel-frame"></div>
				<div class="m-task-reel-pointer"></div>
				<div
					class="m-task-reel"
					class:m-task-reel--spin={reelAnimating && !reelSettled}
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 3.2s cubic-bezier(0.06, 0.72, 0.06, 1)' : 'none'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-task-reel-cell" style="--accent:{effectAccentHex(cell.effectType)}">
							<i class="fas {effectIcon(cell.effectType)}"></i>
							<span class="m-task-reel-name">{cell.name}</span>
							<span class="m-task-reel-cost">{fmt(cell.cost)} XP</span>
						</div>
					{/each}
				</div>
			</div>

			{#if reelSettled}
				<div class="m-task-roll-verdict">
					<span class="m-task-roll-name">{itemRoll.won.name}</span>
					<span class="m-task-roll-worth">worth {fmt(itemRoll.won.cost)} XP</span>
					<span class="m-task-roll-effect">{effectLabel(itemRoll.won.effectType)}</span>
				</div>
				<button class="m-task-roll-close" onclick={() => (itemRoll = null)}>Nice</button>
			{/if}
		</div>
	</div>
{:else if celebrate}
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
{:else if taskWin}
	<div class="m-task-celebrate" role="status">
		<div class="m-task-celebrate-card">
			<div class="m-task-celebrate-emoji">{taskWin.item ? '🎁' : '✨'}</div>
			<h3>{taskWin.title}</h3>
			<p>{taskWin.text}</p>
		</div>
	</div>
{/if}
