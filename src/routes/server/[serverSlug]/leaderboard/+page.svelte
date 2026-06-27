<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;
	type Period = typeof data.period;

	const GAMBLER_METRICS: Metric[] = ['items_gamble_net', 'items_gamble_ratio', 'items_gamble_big'];
	const BOUNTY_METRICS: Metric[] = ['items_bounty_total', 'items_bounty_claimer', 'items_bounty_give'];
	const STEAL_METRICS: Metric[] = ['items_steal_total', 'items_steal_rate', 'items_steal_big'];
	const BOMB_METRICS: Metric[] = ['items_bomb_total', 'items_bomb_rate', 'items_bomb_big'];
	const GIFT_METRICS: Metric[] = ['items_gift_give', 'items_gift_receive'];
	const ITEMS_METRICS: Metric[] = [...GAMBLER_METRICS, ...BOUNTY_METRICS, ...STEAL_METRICS, ...BOMB_METRICS, ...GIFT_METRICS];
	const VOICE_METRICS: Metric[] = ['voice_total', 'voice_active', 'voice_afk'];
	const METRICS: Metric[] = ['xp', 'chat', ...VOICE_METRICS, 'video', 'streaming', ...ITEMS_METRICS];
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
	const isGamblerGroup = $derived(GAMBLER_METRICS.includes(metric));
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
		if (m === 'items_gamble_net') return 'Gambler — Win XP';
		if (m === 'items_gamble_ratio') return 'Gambler — Win ratio';
		if (m === 'items_gamble_big') return 'Gambler — Big win';
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
		if (m === 'items_gamble_net') return Number(r.gamble_net || 0);
		if (m === 'items_gamble_ratio') return Number(r.gamble_ratio || 0);
		if (m === 'items_gamble_big') return Number(r.gamble_big_win || 0);
		if (m === 'items_bounty_total') return Number(r.bounty_on_them || 0);
		if (m === 'items_bounty_claimer') return Number(r.bounty_collected || 0);
		if (m === 'items_bounty_give') return Number(r.bounty_given || 0);
		if (m === 'items_steal_rate' || m === 'items_bomb_rate') return Number(r.attack_rate || 0);
		if (m === 'items_steal_big' || m === 'items_bomb_big') return Number(r.attack_big || 0);
		if (m === 'items_steal_total' || m === 'items_bomb_total') return Number(r.attack_total || 0);
		if (m === 'items_gift_give') return Number(r.gift_given || 0);
		if (m === 'items_gift_receive') return Number(r.gift_received || 0);
		return Number(r.experience || 0);
	}

	function metricValueAnimated(r: any, m: string) {
		const n = anim[r.discord_member_id] ?? metricValueNumber(r, m);
		if (m === 'items_gamble_ratio' || m === 'items_steal_rate' || m === 'items_bomb_rate') return (Math.round(n * 10) / 10).toLocaleString();
		const rounded = Math.round(n);
		return rounded.toLocaleString();
	}

	function metricUnit(m: string) {
		if (m === 'items_gamble_ratio' || m === 'items_steal_rate' || m === 'items_bomb_rate') return '%';
		if (m === 'items_gamble_net' || m === 'items_gamble_big') return 'xp';
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
		if (m.startsWith('items_gamble_')) {
			return `${Number(r.gamble_wins || 0)}/${Number(r.gamble_total || 0)} wins`;
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

	function barWidthPct(r: any, m: string) {
		const v = metricValueNumber(r, m);
		if (v <= 0) return 0;
		const pct = Math.round((v / maxValue) * 100);
		return Math.max(1, pct);
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

	async function setMetric(m: Metric) {
		if (m === metric) return;
		metric = m;
		await loadCurrent();
	}

	async function setPeriod(p: Period) {
		if (p === period) return;
		period = p;
		await loadCurrent();
	}

	const podiumOrder = $derived(
		top3.length >= 3
			? [
					{ r: top3[1], rank: 2 },
					{ r: top3[0], rank: 1 },
					{ r: top3[2], rank: 3 }
				]
			: top3.map((r: any, i: number) => ({ r, rank: i + 1 }))
	);

	const rankColors: Record<number, string> = {
		1: '#FFD700',
		2: '#C0C0C0',
		3: '#CD7F32'
	};

	const rankGlow: Record<number, string> = {
		1: 'rgba(255,215,0,0.45)',
		2: 'rgba(192,192,192,0.3)',
		3: 'rgba(205,127,50,0.3)'
	};

	const rankGradients: Record<number, string> = {
		1: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
		2: 'linear-gradient(135deg, #e0e0e0 0%, #a0aec0 100%)',
		3: 'linear-gradient(135deg, #f093fb 0%, #cd7f32 100%)'
	};

	const podiumHeights: Record<number, string> = {
		1: '88px',
		2: '60px',
		3: '44px'
	};
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} Leaderboard | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Top members leaderboard for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Leaderboard | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="See who's on top in {data.server.name || data.server.slug}." />
</svelte:head>

<div class="m-leaderboard-subhead m-stats-subhead">
	<p>
		Leaderboard
		<span class="m-metric-pill">{metricLabel(metric)}</span>
		<span class="m-metric-pill">{PERIODS.find((p) => p.id === period)?.label ?? 'All time'}</span>
		{#if streamConnected}
			<span class="m-metric-pill m-metric-pill--live">
				<span class="m-live-dot"></span>
				Live
			</span>
		{/if}
	</p>
</div>

<div class="m-period">
	{#each PERIODS as p}
		<button class="m-period-btn {period === p.id ? 'm-period-btn--active' : ''}" onclick={() => setPeriod(p.id)}>
			{p.label}
		</button>
	{/each}
</div>

<div class="m-tabs">
	<button class="m-tab {metric === 'xp' ? 'm-tab--active' : ''}" onclick={() => setMetric('xp')}>
		<i class="fas fa-star"></i> XP
	</button>
	<button class="m-tab {metric === 'chat' ? 'm-tab--active' : ''}" onclick={() => setMetric('chat')}>
		<i class="fas fa-message"></i> Chat
	</button>
	<button class="m-tab {isVoiceGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('voice_total')}>
		<i class="fas fa-microphone"></i> Voice
	</button>
	<button class="m-tab {metric === 'video' ? 'm-tab--active' : ''}" onclick={() => setMetric('video')}>
		<i class="fas fa-video"></i> Video
	</button>
	<button class="m-tab {metric === 'streaming' ? 'm-tab--active' : ''}" onclick={() => setMetric('streaming')}>
		<i class="fas fa-tv"></i> Streaming
	</button>
	<button class="m-tab {isItemsGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gamble_net')}>
		<i class="fas fa-store"></i> Items
	</button>
</div>

{#if isItemsGroup}
	<div class="m-tabs m-tabs--sub">
		<button class="m-tab m-tab--sm {isGamblerGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gamble_net')}>
			<i class="fas fa-dice"></i> Gambler
		</button>
		<button class="m-tab m-tab--sm {isStealGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_steal_total')}>
			<i class="fas fa-hand"></i> Stealer
		</button>
		<button class="m-tab m-tab--sm {isBombGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bomb_total')}>
			<i class="fas fa-bomb"></i> Bomber
		</button>
		<button class="m-tab m-tab--sm {isBountyGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bounty_total')}>
			<i class="fas fa-crosshairs"></i> Bounties
		</button>
		<button class="m-tab m-tab--sm {isGiftGroup ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gift_give')}>
			<i class="fas fa-gift"></i> Gifts
		</button>
	</div>
	{#if isGamblerGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2">
			<button class="m-tab m-tab--sm {metric === 'items_gamble_net' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gamble_net')}>
				<i class="fas fa-coins"></i> Win XP
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_gamble_ratio' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gamble_ratio')}>
				<i class="fas fa-percent"></i> Win ratio
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_gamble_big' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gamble_big')}>
				<i class="fas fa-trophy"></i> Big win
			</button>
		</div>
	{:else if isStealGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2">
			<button class="m-tab m-tab--sm {metric === 'items_steal_total' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_steal_total')}>
				<i class="fas fa-coins"></i> XP stolen
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_steal_rate' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_steal_rate')}>
				<i class="fas fa-percent"></i> Success rate
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_steal_big' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_steal_big')}>
				<i class="fas fa-trophy"></i> Big steal
			</button>
		</div>
	{:else if isBombGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2">
			<button class="m-tab m-tab--sm {metric === 'items_bomb_total' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bomb_total')}>
				<i class="fas fa-coins"></i> XP destroyed
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_bomb_rate' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bomb_rate')}>
				<i class="fas fa-percent"></i> Success rate
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_bomb_big' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bomb_big')}>
				<i class="fas fa-trophy"></i> Big bomb
			</button>
		</div>
	{:else if isBountyGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2">
			<button class="m-tab m-tab--sm {metric === 'items_bounty_total' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bounty_total')}>
				<i class="fas fa-skull"></i> Total bounties
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_bounty_claimer' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bounty_claimer')}>
				<i class="fas fa-coins"></i> Claimer
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_bounty_give' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_bounty_give')}>
				<i class="fas fa-crosshairs"></i> Giver
			</button>
		</div>
	{:else}
		<div class="m-tabs m-tabs--sub m-tabs--sub2">
			<button class="m-tab m-tab--sm {metric === 'items_gift_give' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gift_give')}>
				<i class="fas fa-gift"></i> Given
			</button>
			<button class="m-tab m-tab--sm {metric === 'items_gift_receive' ? 'm-tab--active' : ''}" onclick={() => setMetric('items_gift_receive')}>
				<i class="fas fa-coins"></i> Received
			</button>
		</div>
	{/if}
{/if}

{#if isVoiceGroup}
	<div class="m-tabs m-tabs--sub">
		<button class="m-tab m-tab--sm {metric === 'voice_total' ? 'm-tab--active' : ''}" onclick={() => setMetric('voice_total')}>
			<i class="fas fa-layer-group"></i> Total
		</button>
		<button class="m-tab m-tab--sm {metric === 'voice_active' ? 'm-tab--active' : ''}" onclick={() => setMetric('voice_active')}>
			<i class="fas fa-microphone-lines"></i> Active
		</button>
		<button class="m-tab m-tab--sm {metric === 'voice_afk' ? 'm-tab--active' : ''}" onclick={() => setMetric('voice_afk')}>
			<i class="fas fa-moon"></i> AFK
		</button>
	</div>
{/if}

{#if top3.length > 0}
	<section class="m-podium-section">
		<div class="m-podium-stage">
			{#each podiumOrder as { r, rank }}
				<div class="m-podium-col m-podium-col--{rank}" class:m-mounted={mounted}>
					{#if rank === 1}
						<div class="m-crown">
							<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M4 28L10 10L18 20L24 4L30 20L38 10L44 28H4Z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round" />
								<circle cx="4" cy="28" r="3" fill="#FFD700" />
								<circle cx="44" cy="28" r="3" fill="#FFD700" />
								<circle cx="24" cy="4" r="3" fill="#FFD700" />
								<rect x="2" y="28" width="44" height="4" rx="2" fill="#FFA500" />
							</svg>
						</div>
					{/if}

					<div class="m-avatar-wrap m-avatar-wrap--{rank}">
						<div class="m-avatar-ring" style="--ring-color: {rankColors[rank]}; --ring-glow: {rankGlow[rank]};">
							<div class="m-avatar-img">
								{#if r.avatar}
									<img src={r.avatar} alt={displayName(r)} />
								{:else}
									<div class="m-avatar-fallback">{displayName(r).charAt(0).toUpperCase()}</div>
								{/if}
							</div>
						</div>
						<div class="m-rank-badge" style="background: {rankGradients[rank]}; color: #111;">
							{rank}
						</div>
					</div>

					<div class="m-podium-info">
						<div class="m-podium-name" title={displayName(r)}>{displayName(r)}</div>
						<div class="m-podium-score" style="color: {rankColors[rank]};">
							{metricValueAnimated(r, metric)}
							<span class="m-podium-unit">{metricUnit(metric)}</span>
						</div>
						<div class="m-podium-level">{isItemsGroup ? itemsSub(r, metric) : `Level ${r.level ?? 0}`}</div>
					</div>

					<div class="m-podium-block" style="height: {podiumHeights[rank]}; background: {rankGradients[rank]};">
						<span class="m-podium-block-num">#{rank}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rest.length > 0}
	<section class="m-list-section">
		<div class="m-list-header">
			<span>Rankings</span>
			<span class="m-list-count">{rows.length.toLocaleString()} members</span>
		</div>
		<div class="m-list">
			{#each rest as r, i (r.discord_member_id)}
				<div class="m-list-row" class:m-mounted={mounted} style="animation-delay: {i * 40}ms">
					<div class="m-list-rank">#{i + 4}</div>
					<div class="m-list-avatar">
						{#if r.avatar}
							<img src={r.avatar} alt={displayName(r)} />
						{:else}
							<div class="m-list-avatar-fallback">{displayName(r).charAt(0).toUpperCase()}</div>
						{/if}
					</div>
					<div class="m-list-info">
						<div class="m-list-name" title={displayName(r)}>{displayName(r)}</div>
						<div class="m-list-sub">{isItemsGroup ? itemsSub(r, metric) : `Level ${r.level ?? 0}`}</div>
						<div class="m-list-bar-track">
							<div class="m-list-bar-fill" style="width: {barWidthPct(r, metric)}%"></div>
						</div>
					</div>
					<div class="m-list-score">
						{metricValueAnimated(r, metric)}
						<span class="m-list-unit">{metricUnit(metric)}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rows.length === 0}
	<div class="m-empty">
		<i class="fas fa-trophy" style="font-size: 48px; opacity: 0.2;"></i>
		<p>No data yet</p>
	</div>
{/if}
