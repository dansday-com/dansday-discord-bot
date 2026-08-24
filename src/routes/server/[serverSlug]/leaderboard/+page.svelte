<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import { EmptyState, MetricTabs, PODIUM_HEIGHT, RankAvatar, RANK_STYLES } from '$lib/frontend/components/public';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;
	type Period = typeof data.period;

	const MINIGAMES_METRICS: Metric[] = ['minigames_gamble_net', 'minigames_gamble_ratio', 'minigames_gamble_big'];
	const BOUNTY_METRICS: Metric[] = ['items_bounty_total', 'items_bounty_claimer', 'items_bounty_give'];
	const STEAL_METRICS: Metric[] = ['items_steal_total', 'items_steal_rate', 'items_steal_big'];
	const BOMB_METRICS: Metric[] = ['items_bomb_total', 'items_bomb_rate', 'items_bomb_big'];
	const GIFT_METRICS: Metric[] = ['items_gift_give', 'items_gift_receive'];
	const ITEMS_METRICS: Metric[] = [...BOUNTY_METRICS, ...STEAL_METRICS, ...BOMB_METRICS, ...GIFT_METRICS];
	const VOICE_METRICS: Metric[] = ['voice_total', 'voice_active', 'voice_afk'];
	const METRICS: Metric[] = ['xp', 'chat', ...VOICE_METRICS, 'video', 'streaming', ...ITEMS_METRICS, ...MINIGAMES_METRICS];
	const PERIODS: { id: Period; label: string }[] = [
		{ id: 'all', label: 'All time' },
		{ id: 'month', label: 'This month' },
		{ id: 'week', label: 'This week' }
	];

	const tabPrefetch = new Map<string, any[]>();
	const prefetchKey = (m: Metric, p: Period) => `${m}:${p}`;

	let metric = $state<Metric>(data.metric);
	let period = $state<Period>(data.period);
	let rows = $state(data.rows);
	let es: EventSource | null = null;
	let streamConnected = $state(false);

	const isVoiceGroup = $derived(VOICE_METRICS.includes(metric));
	const isItemsGroup = $derived(ITEMS_METRICS.includes(metric));
	const isMinigamesGroup = $derived(MINIGAMES_METRICS.includes(metric));
	const isBountyGroup = $derived(BOUNTY_METRICS.includes(metric));
	const isStealGroup = $derived(STEAL_METRICS.includes(metric));
	const isBombGroup = $derived(BOMB_METRICS.includes(metric));
	const isGiftGroup = $derived(GIFT_METRICS.includes(metric));
	const isPeriod = $derived(period !== 'all');

	const top3 = $derived(rows.slice(0, 3));
	const rest = $derived(rows.slice(3));
	const maxValue = $derived(Math.max(1, ...rows.map((r: any) => metricValueNumber(r, metric))));

	let anim = $state<Record<string, number>>({});
	let raf: number | null = null;
	let mounted = $state(false);

	function cleanName(s: string): string {
		return s.replace(/^\s*(\[AFK\]\s*)+/gi, '').trim();
	}

	function displayName(r: any) {
		const raw = String(r.server_display_name || r.display_name || r.username || r.discord_member_id || '');
		const cleaned = cleanName(raw);
		return cleaned || raw || 'Unknown';
	}

	function metricLabel(m: string) {
		if (m === 'chat') return 'Messages';
		if (m === 'voice_total') return 'Voice (Total)';
		if (m === 'voice_active') return 'Voice (Active)';
		if (m === 'voice_afk') return 'Voice (AFK)';
		if (m === 'video') return 'Video';
		if (m === 'streaming') return 'Streaming';
		if (m === 'minigames_gamble_net') return 'Minigames — Gamble — Net XP';
		if (m === 'minigames_gamble_ratio') return 'Minigames — Gamble — Win ratio';
		if (m === 'minigames_gamble_big') return 'Minigames — Gamble — Big win';
		if (m === 'items_bounty_total') return 'Bounties — Total bounties';
		if (m === 'items_bounty_claimer') return 'Bounties — Claimer';
		if (m === 'items_bounty_give') return 'Bounties — Giver';
		if (m === 'items_steal_total') return 'Stealer — XP stolen';
		if (m === 'items_steal_rate') return 'Stealer — Success rate';
		if (m === 'items_steal_big') return 'Stealer — Big steal';
		if (m === 'items_bomb_total') return 'Bomber — XP destroyed';
		if (m === 'items_bomb_rate') return 'Bomber — Success rate';
		if (m === 'items_bomb_big') return 'Bomber — Big bomb';
		if (m === 'items_gift_give') return 'Gifts — Given';
		if (m === 'items_gift_receive') return 'Gifts — Received';
		return 'XP';
	}

	function metricValueNumber(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0);
		if (m === 'voice_total') return Number(r.voice_minutes_total || 0);
		if (m === 'voice_active') return Number(r.voice_minutes_active || 0);
		if (m === 'voice_afk') return Number(r.voice_minutes_afk || 0);
		if (m === 'video') return Number(r.voice_minutes_video || 0);
		if (m === 'streaming') return Number(r.voice_minutes_streaming || 0);
		if (m === 'minigames_gamble_net') return Number(r.minigame_net || 0);
		if (m === 'minigames_gamble_ratio') return Number(r.minigame_ratio || 0);
		if (m === 'minigames_gamble_big') return Number(r.minigame_big_win || 0);
		if (m === 'items_bounty_total') return Number(r.bounty_on_them || 0);
		if (m === 'items_bounty_claimer') return Number(r.bounty_collected || 0);
		if (m === 'items_bounty_give') return Number(r.bounty_given || 0);
		if (m === 'items_steal_rate' || m === 'items_bomb_rate') return Number(r.attack_rate || 0);
		if (m === 'items_steal_big' || m === 'items_bomb_big') return Number(r.attack_big || 0);
		if (m === 'items_steal_total' || m === 'items_bomb_total') return Number(r.attack_total || 0);
		if (m === 'items_gift_give') return Number(r.gift_given || 0);
		if (m === 'items_gift_receive') return Number(r.gift_received || 0);
		return Number(r.xp || 0);
	}

	function metricValueAnimated(r: any, m: string) {
		const n = anim[r.discord_member_id] ?? metricValueNumber(r, m);
		if (m === 'minigames_gamble_ratio' || m === 'items_steal_rate' || m === 'items_bomb_rate') return (Math.round(n * 10) / 10).toLocaleString();
		const rounded = Math.round(n);
		return rounded.toLocaleString();
	}

	function metricUnit(m: string) {
		if (m === 'minigames_gamble_ratio' || m === 'items_steal_rate' || m === 'items_bomb_rate') return '%';
		if (m === 'minigames_gamble_net' || m === 'minigames_gamble_big') return 'xp';
		if (m === 'items_bounty_total' || m === 'items_bounty_claimer' || m === 'items_bounty_give') return 'xp';
		if (m.startsWith('items_steal_') || m.startsWith('items_bomb_')) return 'xp';
		if (m.startsWith('items_gift_')) return 'xp';
		if (isPeriod) {
			if (m === 'xp') return 'xp';
			return 'times';
		}
		if (m === 'chat') return 'msgs';
		if (m.startsWith('voice_') || m === 'video' || m === 'streaming') return 'min';
		return 'xp';
	}

	function itemsSub(r: any, m: string) {
		if (m.startsWith('minigames_')) {
			return `${Number(r.minigame_wins || 0)}/${Number(r.minigame_total || 0)} wins`;
		}
		if (m === 'items_bounty_claimer') return 'claimed';
		if (m === 'items_bounty_give') return 'placed';
		if (m === 'items_bounty_total') return 'on their head';
		if (m.startsWith('items_steal_') || m.startsWith('items_bomb_')) {
			return `${Number(r.attack_success || 0)}/${Number(r.attack_attempts || 0)} hits`;
		}
		if (m === 'items_gift_give') return 'gifted';
		if (m === 'items_gift_receive') return 'received';
		return '';
	}

	function rowSub(r: any) {
		return isItemsGroup || isMinigamesGroup ? itemsSub(r, metric) : `Level ${r.level ?? 0}`;
	}

	function barWidthPct(r: any, m: string) {
		const v = metricValueNumber(r, m);
		if (v <= 0) return 0;
		return Math.max(1, Math.round((v / maxValue) * 100));
	}

	function animateToCurrentValues(fromZero = false) {
		if (raf) cancelAnimationFrame(raf);
		const duration = 1100;
		const start = performance.now();
		const targets: Record<string, number> = {};
		for (const r of rows as any[]) targets[r.discord_member_id] = metricValueNumber(r, metric);
		const initial: Record<string, number> = {};
		for (const [id, target] of Object.entries(targets)) initial[id] = fromZero ? 0 : (anim[id] ?? 0);

		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			const e = 1 - Math.pow(1 - t, 4);
			const next: Record<string, number> = {};
			for (const [id, target] of Object.entries(targets)) {
				const a = initial[id] ?? 0;
				next[id] = a + (target - a) * e;
			}
			anim = next;
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
	}

	function snapshotUrl(m: Metric, p: Period) {
		return `/api/public-statistics/${data.server.slug}/snapshot?metric=${m}&period=${p}&limit=${data.limit}`;
	}

	function connect() {
		es?.close();
		const myEs = new EventSource(`/api/public-statistics/${data.server.slug}/stream?metric=${metric}&period=${period}&limit=${data.limit}`);
		es = myEs;
		myEs.onmessage = (e) => {
			if (es !== myEs) return;
			try {
				const snap = JSON.parse(e.data);
				if (snap?.rows) {
					rows = snap.rows;
					tabPrefetch.set(prefetchKey(metric, period), snap.rows);
					animateToCurrentValues(false);
				}
			} catch (_) {}
		};
		myEs.onerror = () => {
			if (es !== myEs) return;
			streamConnected = false;
		};
	}

	onMount(() => {
		tabPrefetch.set(prefetchKey(data.metric, data.period), data.rows);
		for (const m of METRICS) {
			if (m === data.metric) continue;
			fetch(snapshotUrl(m, period))
				.then((r) => (r.ok ? r.json() : null))
				.then((snap) => {
					if (snap?.rows && Array.isArray(snap.rows)) tabPrefetch.set(prefetchKey(m, period), snap.rows);
				})
				.catch(() => {});
		}
		connect();
		animateToCurrentValues(true);
		mounted = true;
	});

	onDestroy(() => {
		es?.close();
		if (raf) cancelAnimationFrame(raf);
	});

	async function loadCurrent() {
		const hit = tabPrefetch.get(prefetchKey(metric, period));
		if (hit && hit.length > 0) {
			rows = hit;
			animateToCurrentValues(false);
		} else {
			rows = [];
		}
		connect();
		try {
			const res = await fetch(snapshotUrl(metric, period));
			if (res.ok) {
				const snap = await res.json();
				if (Array.isArray(snap?.rows)) {
					tabPrefetch.set(prefetchKey(metric, period), snap.rows);
					rows = snap.rows;
					animateToCurrentValues(false);
				}
			}
		} catch (_) {}
	}

	async function setMetric(m: string) {
		if (m === metric) return;
		metric = m as Metric;
		await loadCurrent();
	}

	async function setPeriod(p: string) {
		if (p === period) return;
		period = p as Period;
		await loadCurrent();
	}

	const periodTabs = $derived(PERIODS.map((p) => ({ id: p.id as string, label: p.label, active: period === p.id })));

	const metricTabs = $derived([
		{ id: 'xp', label: 'XP', icon: 'fa-star', active: metric === 'xp' },
		{ id: 'chat', label: 'Chat', icon: 'fa-message', active: metric === 'chat' },
		{ id: 'voice_total', label: 'Voice', icon: 'fa-microphone', active: isVoiceGroup },
		{ id: 'video', label: 'Video', icon: 'fa-video', active: metric === 'video' },
		{ id: 'streaming', label: 'Streaming', icon: 'fa-tv', active: metric === 'streaming' },
		{ id: 'items_bounty_total', label: 'Items', icon: 'fa-store', active: isItemsGroup },
		{ id: 'minigames_gamble_net', label: 'Minigames', icon: 'fa-dice', active: isMinigamesGroup }
	]);

	const itemsGroupTabs = $derived([
		{ id: 'items_steal_total', label: 'Stealer', icon: 'fa-hand', active: isStealGroup },
		{ id: 'items_bomb_total', label: 'Bomber', icon: 'fa-bomb', active: isBombGroup },
		{ id: 'items_bounty_total', label: 'Bounties', icon: 'fa-crosshairs', active: isBountyGroup },
		{ id: 'items_gift_give', label: 'Gifts', icon: 'fa-gift', active: isGiftGroup }
	]);

	const itemsLeafTabs = $derived.by(() => {
		if (isStealGroup)
			return [
				{ id: 'items_steal_total', label: 'XP stolen', icon: 'fa-coins', active: metric === 'items_steal_total' },
				{ id: 'items_steal_rate', label: 'Success rate', icon: 'fa-percent', active: metric === 'items_steal_rate' },
				{ id: 'items_steal_big', label: 'Big steal', icon: 'fa-trophy', active: metric === 'items_steal_big' }
			];
		if (isBombGroup)
			return [
				{ id: 'items_bomb_total', label: 'XP destroyed', icon: 'fa-coins', active: metric === 'items_bomb_total' },
				{ id: 'items_bomb_rate', label: 'Success rate', icon: 'fa-percent', active: metric === 'items_bomb_rate' },
				{ id: 'items_bomb_big', label: 'Big bomb', icon: 'fa-trophy', active: metric === 'items_bomb_big' }
			];
		if (isBountyGroup)
			return [
				{ id: 'items_bounty_total', label: 'Total bounties', icon: 'fa-skull', active: metric === 'items_bounty_total' },
				{ id: 'items_bounty_claimer', label: 'Claimer', icon: 'fa-coins', active: metric === 'items_bounty_claimer' },
				{ id: 'items_bounty_give', label: 'Giver', icon: 'fa-crosshairs', active: metric === 'items_bounty_give' }
			];
		return [
			{ id: 'items_gift_give', label: 'Given', icon: 'fa-gift', active: metric === 'items_gift_give' },
			{ id: 'items_gift_receive', label: 'Received', icon: 'fa-coins', active: metric === 'items_gift_receive' }
		];
	});

	const minigamesLeafTabs = $derived([
		{ id: 'minigames_gamble_net', label: 'Net XP', icon: 'fa-coins', active: metric === 'minigames_gamble_net' },
		{ id: 'minigames_gamble_ratio', label: 'Win ratio', icon: 'fa-percent', active: metric === 'minigames_gamble_ratio' },
		{ id: 'minigames_gamble_big', label: 'Big win', icon: 'fa-trophy', active: metric === 'minigames_gamble_big' }
	]);

	const voiceTabs = $derived([
		{ id: 'voice_total', label: 'Total', icon: 'fa-layer-group', active: metric === 'voice_total' },
		{ id: 'voice_active', label: 'Active', icon: 'fa-microphone-lines', active: metric === 'voice_active' },
		{ id: 'voice_afk', label: 'AFK', icon: 'fa-moon', active: metric === 'voice_afk' }
	]);

	const podiumOrder = $derived(
		top3.length >= 3
			? [
					{ r: top3[1], rank: 2 },
					{ r: top3[0], rank: 1 },
					{ r: top3[2], rank: 3 }
				]
			: top3.map((r: any, i: number) => ({ r, rank: i + 1 }))
	);
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Leaderboard | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Top members leaderboard for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Leaderboard | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="See who's on top in {data.server.name || data.server.slug}." />
</svelte:head>

<div class="text-base-content/60 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
	<p class="m-0 flex flex-wrap items-center gap-1.5">
		Leaderboard
		<span class="badge badge-sm bg-primary/20 border-primary/35 text-accent font-semibold">{metricLabel(metric)}</span>
		<span class="badge badge-sm bg-primary/20 border-primary/35 text-accent font-semibold">
			{PERIODS.find((p) => p.id === period)?.label ?? 'All time'}
		</span>
		{#if streamConnected}
			<span class="badge badge-sm bg-primary/20 border-primary/35 text-accent gap-1.5 font-semibold">
				<span class="bg-primary size-1.5 animate-pulse rounded-full" aria-hidden="true"></span>
				Live
			</span>
		{/if}
	</p>
</div>

<MetricTabs tabs={periodTabs} label="Time period" onselect={setPeriod} />
<MetricTabs tabs={metricTabs} label="Metric" onselect={setMetric} />

{#if isItemsGroup}
	<MetricTabs tabs={itemsGroupTabs} size="sm" depth={1} label="Item category" onselect={setMetric} />
	<MetricTabs tabs={itemsLeafTabs} size="sm" depth={2} label="Item metric" onselect={setMetric} />
{/if}

{#if isMinigamesGroup}
	<MetricTabs
		tabs={[{ id: 'minigames_gamble_net', label: 'Gamble', icon: 'fa-dice', active: true }]}
		size="sm"
		depth={1}
		label="Minigame"
		onselect={setMetric}
	/>
	<MetricTabs tabs={minigamesLeafTabs} size="sm" depth={2} label="Minigame metric" onselect={setMetric} />
{/if}

{#if isVoiceGroup}
	<MetricTabs tabs={voiceTabs} size="sm" depth={1} label="Voice metric" onselect={setMetric} />
{/if}

{#if top3.length > 0}
	<section class="mb-7">
		<div class="flex items-end justify-center">
			{#each podiumOrder as { r, rank }}
				<div
					class="relative flex min-w-0 flex-1 flex-col items-center transition-all duration-500 ease-out {mounted
						? 'translate-y-0 opacity-100'
						: 'translate-y-6 opacity-0'}"
				>
					{#if rank === 1}
						<div class="animate-crown-float relative z-10 -mb-1.5 w-11 drop-shadow-[0_2px_8px_rgba(255,215,0,0.6)]">
							<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M4 28L10 10L18 20L24 4L30 20L38 10L44 28H4Z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round" />
								<circle cx="4" cy="28" r="3" fill="#FFD700" />
								<circle cx="44" cy="28" r="3" fill="#FFD700" />
								<circle cx="24" cy="4" r="3" fill="#FFD700" />
								<rect x="2" y="28" width="44" height="4" rx="2" fill="#FFA500" />
							</svg>
						</div>
					{/if}

					<div class="mb-2.5">
						<RankAvatar src={r.avatar} name={displayName(r)} size={rank === 1 ? 84 : 66} {rank} badge />
					</div>

					<div class="mb-2 w-full min-w-0 overflow-hidden px-1 text-center">
						<div class="text-base-content mb-0.5 truncate text-xs font-bold" title={displayName(r)}>{displayName(r)}</div>
						<div
							class="flex items-baseline justify-center gap-[3px] text-lg font-black whitespace-nowrap tabular-nums"
							style="color: {RANK_STYLES[rank].color};"
						>
							{metricValueAnimated(r, metric)}
							<span class="text-[10px] font-semibold opacity-70">{metricUnit(metric)}</span>
						</div>
						<div class="text-base-content/40 mt-0.5 text-[10px]">{rowSub(r)}</div>
					</div>

					<div
						class="flex w-full items-center justify-center rounded-t-[10px] opacity-85"
						style="height: {PODIUM_HEIGHT[rank]}; background: {RANK_STYLES[rank].gradient};"
					>
						<span class="text-[11px] font-black text-black/50">#{rank}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rest.length > 0}
	<section class="card border-base-300 bg-base-100/85 overflow-hidden border shadow-sm">
		<div class="border-base-300 text-base-content flex items-center justify-between border-b px-4 py-3 text-[13px] font-bold sm:px-5">
			<span>Rankings</span>
			<span class="text-base-content/45 text-[11px] font-medium">{rows.length.toLocaleString()} members</span>
		</div>
		<ul class="list">
			{#each rest as r, i (r.discord_member_id)}
				<li class="list-row border-base-300 items-center gap-3 rounded-none border-b px-3 py-2.5 sm:px-4">
					<span class="text-base-content/45 w-8 shrink-0 text-right text-[11px] font-bold tabular-nums">#{i + 4}</span>

					<div class="border-base-300 bg-base-300 size-10 shrink-0 overflow-hidden rounded-full border">
						{#if r.avatar}
							<img src={r.avatar} alt={displayName(r)} class="size-full object-cover" loading="lazy" />
						{:else}
							<div class="text-base-content/55 grid size-full place-items-center text-[15px] font-extrabold">
								{displayName(r).charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>

					<div class="list-col-grow min-w-0">
						<div class="text-base-content truncate text-[13px] font-semibold" title={displayName(r)}>{displayName(r)}</div>
						<div class="text-base-content/45 mb-1.5 text-[10px]">{rowSub(r)}</div>
						<div class="bg-base-content/15 h-[3px] overflow-hidden rounded-full">
							<div
								class="from-secondary to-primary h-full rounded-full bg-linear-to-r transition-[width] duration-700 ease-out"
								style="width: {barWidthPct(r, metric)}%"
							></div>
						</div>
					</div>

					<span class="text-base-content shrink-0 text-right text-sm font-extrabold tabular-nums">
						{metricValueAnimated(r, metric)}
						<span class="text-base-content/40 text-[9px] font-semibold">{metricUnit(metric)}</span>
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if rows.length === 0}
	<EmptyState icon="fa-trophy" message="No data yet" />
{/if}
