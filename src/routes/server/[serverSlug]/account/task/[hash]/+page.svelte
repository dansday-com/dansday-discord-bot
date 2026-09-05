<script lang="ts">
	import { lockScroll } from '$lib/frontend/scrollLock.js';
	import { getContext, onMount, onDestroy } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { effectIcon, effectAccentHex, effectLabel } from '$lib/items.js';
	import { rarityTierFor, rarityMeta, type RarityTier } from '$lib/tasks.js';
	import FeatureDisabled from '$lib/frontend/components/FeatureDisabled.svelte';
	import { EmptyState, MetricTabs, ReelStrip } from '$lib/frontend/components/public';
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

	type ReelCell = { name: string; cost: number; effectType: string; tier: RarityTier };
	let itemRoll = $state<{ day: number; jackpot: boolean; won: ReelCell } | null>(null);
	let reel = $state<ReelCell[]>([]);
	let reelOffset = $state(0);
	let reelAnimating = $state(false);
	let reelSettled = $state(false);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	const reelPool = $derived<ReelCell[]>(live?.reelPool ?? []);

	$effect(() => {
		if (!itemRoll) return;
		return lockScroll();
	});

	function decoyCells(n: number): ReelCell[] {
		const pool = reelPool;
		if (pool.length === 0) return [];
		return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
	}

	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('[data-reel-cell]')?.[index];
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

		setTimeout(() => (reelSettled = true), 7000);
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
		if (data.featureDisabled) return;
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

	const periodTabs = $derived([
		{ id: 'daily', label: 'Daily', icon: 'fa-sun', count: `${doneCount}/${dailyTasks.length}`, active: tab === 'daily' },
		{ id: 'weekly', label: 'Weekly', icon: 'fa-calendar-week', count: `${weeklyDone}/${weeklyTasks.length}`, active: tab === 'weekly' }
	]);

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

			if (g?.kind === 'item') {
				await runItemRoll(body.day, !!body.jackpot, {
					name: g.name,
					cost: Number(g.cost) || 0,
					effectType: String(g.effectType || ''),
					tier: rarityTierFor(
						Number(g.cost) || 0,
						reelPool.map((c) => c.cost)
					)
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

{#if data.featureDisabled}
	<FeatureDisabled
		title="Tasks are turned off"
		message="This server has not enabled daily and weekly tasks. An administrator can turn them on in the bot configuration panel."
		icon="fa-list-check"
	/>
{:else}
	{#snippet dayFace(r: any, busy: boolean)}
		<span class="text-base-content/40 text-[9px] font-extrabold tracking-[0.4px] uppercase">Day {r.day}</span>
		<span class="text-warning text-[15px] leading-none">
			{#if busy}
				<i class="fas fa-spinner fa-spin"></i>
			{:else if r.claimed}
				<i class="fas fa-circle-check"></i>
			{:else if r.jackpot}
				<i class="fas fa-crown"></i>
			{:else}
				<i class="fas fa-gift"></i>
			{/if}
		</span>
		<span class="text-base-content/55 text-[10px] font-bold tabular-nums">
			{#if r.claimed}Claimed{:else}?{/if}
		</span>
	{/snippet}

	{#snippet celebrationModal(emoji: string, title: string, body: string, close: () => void)}
		<div class="modal modal-open" role="dialog" aria-modal="true">
			<div class="modal-box border-base-300 max-w-sm border text-center">
				<div class="mb-2 text-[58px] leading-none">{emoji}</div>
				<h3 class="text-base-content text-lg font-extrabold">{title}</h3>
				<p class="text-base-content/60 mt-1 text-sm">{body}</p>
			</div>
			<button type="button" class="modal-backdrop bg-base-content/55 backdrop-blur-[5px]" onclick={close}>close</button>
		</div>
	{/snippet}

	<div class="flex flex-col gap-4 sm:gap-[18px]">
		<section class="card border-base-300 bg-base-100 border shadow-sm">
			<div class="card-body gap-3 p-4 sm:px-[18px]">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 class="text-base-content flex items-center gap-2 text-[15px] font-extrabold">
							<i class="fas fa-gift text-warning"></i> Daily check-in
						</h3>
						<p class="text-base-content/60 mt-1 text-xs">
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
						<span class="text-success inline-flex items-center gap-1.5 text-xs font-bold">
							<i class="fas fa-circle-check"></i> Claimed today
						</span>
					{/if}
				</div>

				<div class="grid grid-cols-7 gap-1.5 sm:gap-2">
					{#each login.rewards as r (r.day)}
						{@const claimable = r.current && login.canClaim && !ctx.readOnly}
						{@const jackpot = r.jackpot
							? 'border-error/45 bg-linear-to-br from-warning/12 to-error/14'
							: r.claimed
								? 'border-success/32 bg-success/10'
								: 'border-base-300 bg-base-content/4'}
						{#if claimable}
							<button
								type="button"
								class="animate-task-daypulse border-warning/50 from-warning/16 to-error/12 relative flex -translate-y-0.5 cursor-pointer flex-col items-center gap-1 rounded-xl border bg-linear-to-br px-1 pt-2.5 pb-6 text-center transition-all"
								disabled={claimingLogin}
								aria-label={`Claim day ${r.day} reward`}
								onclick={claimLogin}
							>
								{@render dayFace(r, claimingLogin)}
								<span
									class="from-warning to-secondary absolute bottom-1.5 left-1/2 max-w-[calc(100%-2px)] -translate-x-1/2 rounded-full bg-linear-to-br px-1.5 py-0.5 text-[8px] font-extrabold tracking-normal whitespace-nowrap text-white uppercase sm:px-2.5 sm:text-[9px] sm:tracking-[0.5px]"
								>
									Claim
								</span>
							</button>
						{:else}
							<div class="relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-all {jackpot}">
								{@render dayFace(r, false)}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</section>

		<div class="flex flex-wrap items-center gap-2">
			<MetricTabs tabs={periodTabs} label="Task period" margin={false} onselect={(id) => (tab = id as 'daily' | 'weekly')} />
			<span class="text-base-content/40 ml-auto inline-flex items-center gap-1.5 text-xs font-bold tabular-nums">
				<i class="fas fa-rotate"></i>
				{tab === 'weekly' ? weeklyCountdown : countdown}
			</span>
		</div>

		{#if tasks.length === 0 && !synced}
			<EmptyState icon="fa-spinner fa-spin" message="Loading your tasks…" hint="Lining up today's goals." boxed />
		{:else if tasks.length === 0}
			<EmptyState icon="fa-list-check" message="No {tab} tasks available" hint="Tasks need leveling, items, or minigames enabled on this server." boxed />
		{:else}
			<div class="grid grid-cols-1 gap-3.5 min-[680px]:grid-cols-[repeat(auto-fill,minmax(310px,1fr))]">
				{#each tasks as t (`${t.period}:${t.slot}`)}
					<article
						class="card border-base-300 bg-base-100 border border-l-[3px] shadow-sm transition-all {t.claimed ? 'opacity-60' : ''} {t.complete && !t.claimed
							? 'ring-success/30 ring-2'
							: ''}"
						style="--accent:{t.accent}; border-left-color: {t.accent};"
					>
						<div class="card-body gap-3 p-4">
							<header class="flex items-center gap-3">
								<div class="relative grid size-15 shrink-0 place-items-center">
									<svg viewBox="0 0 60 60" class="absolute inset-0 size-full" aria-hidden="true">
										<circle cx="30" cy="30" r="26" fill="none" stroke="var(--color-base-content)" stroke-opacity="0.1" stroke-width="5" />
										<circle
											cx="30"
											cy="30"
											r="26"
											fill="none"
											stroke="var(--accent)"
											stroke-width="5"
											stroke-linecap="round"
											stroke-dasharray={ringDash(t)}
											class="transition-[stroke-dasharray] duration-500 ease-out"
										/>
									</svg>
									<i class="fas {t.icon} text-base-content/70 relative text-sm"></i>
								</div>
								<div class="flex min-w-0 flex-col items-start gap-1">
									<span
										class="rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-[0.7px] uppercase"
										style="--d:{diffAccent(
											t.difficulty
										)}; color: var(--d); background: color-mix(in srgb, var(--d) 12%, transparent); border-color: color-mix(in srgb, var(--d) 30%, transparent);"
									>
										{t.difficulty}
									</span>
									<h3 class="text-base-content text-sm font-bold">{t.description}</h3>
									<span class="text-base-content/40 text-[11px] font-semibold">{t.label}</span>
								</div>
							</header>

							<div class="flex items-center gap-2.5">
								<div class="bg-base-content/10 h-1.5 flex-1 overflow-hidden rounded-full">
									<div
										class="h-full rounded-full transition-[width] duration-500 ease-out"
										style="width:{Math.min(100, (t.progress / Math.max(1, t.goal)) * 100)}%; background: var(--accent);"
									></div>
								</div>
								<span class="text-base-content/55 text-[11px] font-bold whitespace-nowrap tabular-nums">
									{fmt(t.progress)}/{fmt(t.goal)}
									{t.unit === 'xp' ? 'XP' : t.unit}
								</span>
							</div>

							<footer class="border-base-300 flex items-center justify-between gap-2.5 border-t border-dashed pt-3">
								{#if t.reward.kind === 'item'}
									<div class="flex min-w-0 flex-1 items-center gap-2.5">
										<i class="fas {effectIcon(t.reward.effectType)} shrink-0 text-lg" style="color: {effectAccentHex(t.reward.effectType)};"></i>
										<div class="min-w-0">
											<strong class="text-base-content block truncate text-xs font-bold">{t.reward.name}</strong>
											<span class="text-base-content/50 block truncate text-[10px] font-semibold">
												{effectLabel(t.reward.effectType)} · worth {fmt(t.reward.cost)} XP
											</span>
										</div>
									</div>
								{:else}
									<div class="flex min-w-0 flex-1 items-center gap-2.5">
										<i class="fas fa-star text-warning shrink-0 text-lg"></i>
										<div class="min-w-0">
											<strong class="text-base-content block text-xs font-bold">+{fmt(t.reward.xp)} XP</strong>
											<span class="text-base-content/50 block text-[10px] font-semibold">Reward</span>
										</div>
									</div>
								{/if}

								{#if t.claimed}
									<span class="text-success inline-flex shrink-0 items-center gap-1.5 text-xs font-bold">
										<i class="fas fa-circle-check"></i> Claimed
									</span>
								{:else if t.complete}
									<button
										class="btn btn-sm btn-success animate-task-pulse shrink-0 font-extrabold"
										onclick={() => claim(t)}
										disabled={busySlot != null || ctx.readOnly}
									>
										{#if busySlot === `${t.period}:${t.slot}`}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-gift"></i>{/if}
										Claim
									</button>
								{:else}
									<span class="text-base-content/40 shrink-0 text-[11px] font-bold whitespace-nowrap">{fmt(Math.max(0, t.goal - t.progress))} to go</span>
								{/if}
							</footer>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</div>

	{#if itemRoll}
		<div class="modal modal-open" role="dialog" aria-modal="true" aria-label="Daily reward roll">
			<div
				class="modal-box w-full max-w-[560px] border text-center transition-colors {itemRoll.jackpot && reelSettled
					? 'border-error/60 shadow-error/50 shadow-2xl'
					: 'border-base-300'}"
			>
				<p class="text-base-content/40 mb-0.5 text-[11px] font-extrabold tracking-[0.09em] uppercase">
					{itemRoll.jackpot ? `Day ${itemRoll.day} jackpot` : `Day ${itemRoll.day} reward`}
				</p>
				<h3 class="from-warning to-error mb-4 bg-linear-to-br bg-clip-text text-xl font-extrabold text-transparent">
					{reelSettled ? 'You got it!' : 'Rolling your item…'}
				</h3>

				<ReelStrip
					bind:wrap={reelWrapEl}
					items={reel}
					offset={reelOffset}
					animating={reelAnimating}
					frameWidth={116}
					frameWidthSm={100}
					cellClass="basis-28 h-[114px] max-[680px]:basis-24 max-[680px]:h-[106px]"
					glow={reelSettled}
				>
					{#snippet cell(c)}
						<div
							class="border-base-300 from-base-100 to-base-200 flex size-full flex-col items-center justify-center gap-1 rounded-xl border bg-linear-[160deg] px-2 py-1.5"
							style="--tier:{rarityMeta(c.tier).accent}"
						>
							<span
								class="rounded-full px-1.5 py-px text-[8px] font-extrabold tracking-[0.09em] uppercase"
								style="color: var(--tier); background: color-mix(in srgb, var(--tier) 14%, transparent);"
							>
								{rarityMeta(c.tier).label}
							</span>
							<i class="fas {effectIcon(c.effectType)}" style="color: {effectAccentHex(c.effectType)};"></i>
							<span class="text-base-content line-clamp-2 text-[11px] leading-tight font-bold">{c.name}</span>
							<span class="text-base-content/40 text-[10px] font-bold tabular-nums">{fmt(c.cost)} XP</span>
						</div>
					{/snippet}
				</ReelStrip>

				{#if reelSettled}
					<div class="mt-4 flex flex-col gap-0.5">
						<span
							class="mb-1 self-center rounded-full border px-3 py-0.5 text-[10px] font-extrabold tracking-widest uppercase"
							style="--tier:{rarityMeta(itemRoll.won.tier)
								.accent}; color: var(--tier); background: color-mix(in srgb, var(--tier) 14%, transparent); border-color: color-mix(in srgb, var(--tier) 45%, transparent);"
						>
							{rarityMeta(itemRoll.won.tier).label}
						</span>
						<span class="text-base-content text-[17px] font-extrabold">{itemRoll.won.name}</span>
						<span class="text-base-content/50 text-xs font-semibold">worth {fmt(itemRoll.won.cost)} XP</span>
					</div>
					<div class="modal-action justify-center">
						<button class="btn from-warning to-error border-none bg-linear-to-br px-8 font-extrabold text-white" onclick={() => (itemRoll = null)}>
							Nice
						</button>
					</div>
				{/if}
			</div>
			<button type="button" class="modal-backdrop bg-base-content/55 backdrop-blur-[5px]" onclick={() => (reelSettled ? (itemRoll = null) : null)}>
				close
			</button>
		</div>
	{:else if celebrate}
		{@render celebrationModal(celebrate.emoji, `${celebrate.label} streak!`, `${celebrate.streak} days in a row. Keep it burning.`, () => (celebrate = null))}
	{:else if loginWin}
		{@render celebrationModal(
			loginWin.jackpot ? '🎁' : '✨',
			loginWin.jackpot ? 'Day 7 jackpot!' : `Day ${loginWin.day} claimed`,
			loginWin.text,
			() => (loginWin = null)
		)}
	{:else if taskWin}
		{@render celebrationModal(taskWin.item ? '🎁' : '✨', taskWin.title, taskWin.text, () => (taskWin = null))}
	{/if}
{/if}
