<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
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
		return Number(r.experience || 0);
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

<div class="m-leaderboard-subhead m-stats-subhead mb-3 mb-4">
	<p>
		Leaderboard
		<span class="m-metric-pill text-chili-peach rounded-[99px] px-2 py-0 text-xs font-semibold">{metricLabel(metric)}</span>
		<span class="m-metric-pill text-chili-peach rounded-[99px] px-2 py-0 text-xs font-semibold"
			>{PERIODS.find((p) => p.id === period)?.label ?? 'All time'}</span
		>
		{#if streamConnected}
			<span class="m-metric-pill m-metric-pill--live text-chili-peach inline-flex items-center gap-1 rounded-[99px] px-2 py-0 text-xs font-semibold">
				<span class="m-live-dot h-2 w-2 rounded-full"></span>
				Live
			</span>
		{/if}
	</p>
</div>

<div class="m-period mb-3 flex w-fit gap-1 rounded-xl p-1">
	{#each PERIODS as p}
		<button
			class="m-period-btn {period === p.id
				? 'm-period-btn--active'
				: ''} text-lb-text-faint cursor-pointer rounded-[9px] px-4 py-2 text-xs font-bold whitespace-nowrap"
			onclick={() => setPeriod(p.id)}
		>
			{p.label}
		</button>
	{/each}
</div>

<div class="m-tabs mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
	<button
		class="m-tab {metric === 'xp'
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('xp')}
	>
		<i class="fas fa-star"></i> XP
	</button>
	<button
		class="m-tab {metric === 'chat'
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('chat')}
	>
		<i class="fas fa-message"></i> Chat
	</button>
	<button
		class="m-tab {isVoiceGroup
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('voice_total')}
	>
		<i class="fas fa-microphone"></i> Voice
	</button>
	<button
		class="m-tab {metric === 'video'
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('video')}
	>
		<i class="fas fa-video"></i> Video
	</button>
	<button
		class="m-tab {metric === 'streaming'
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('streaming')}
	>
		<i class="fas fa-tv"></i> Streaming
	</button>
	<button
		class="m-tab {isItemsGroup
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('items_bounty_total')}
	>
		<i class="fas fa-store"></i> Items
	</button>
	<button
		class="m-tab {isMinigamesGroup
			? 'm-tab--active'
			: ''} text-lb-text-faint flex grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-3 py-2 text-xs font-semibold"
		onclick={() => setMetric('minigames_gamble_net')}
	>
		<i class="fas fa-dice"></i> Minigames
	</button>
</div>

{#if isItemsGroup}
	<div class="m-tabs m-tabs--sub mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
		<button
			class="m-tab m-tab--sm {isStealGroup
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('items_steal_total')}
		>
			<i class="fas fa-hand"></i> Stealer
		</button>
		<button
			class="m-tab m-tab--sm {isBombGroup
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('items_bomb_total')}
		>
			<i class="fas fa-bomb"></i> Bomber
		</button>
		<button
			class="m-tab m-tab--sm {isBountyGroup
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('items_bounty_total')}
		>
			<i class="fas fa-crosshairs"></i> Bounties
		</button>
		<button
			class="m-tab m-tab--sm {isGiftGroup
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('items_gift_give')}
		>
			<i class="fas fa-gift"></i> Gifts
		</button>
	</div>
	{#if isStealGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2 mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
			<button
				class="m-tab m-tab--sm {metric === 'items_steal_total'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_steal_total')}
			>
				<i class="fas fa-coins"></i> XP stolen
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_steal_rate'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_steal_rate')}
			>
				<i class="fas fa-percent"></i> Success rate
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_steal_big'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_steal_big')}
			>
				<i class="fas fa-trophy"></i> Big steal
			</button>
		</div>
	{:else if isBombGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2 mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
			<button
				class="m-tab m-tab--sm {metric === 'items_bomb_total'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bomb_total')}
			>
				<i class="fas fa-coins"></i> XP destroyed
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_bomb_rate'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bomb_rate')}
			>
				<i class="fas fa-percent"></i> Success rate
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_bomb_big'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bomb_big')}
			>
				<i class="fas fa-trophy"></i> Big bomb
			</button>
		</div>
	{:else if isBountyGroup}
		<div class="m-tabs m-tabs--sub m-tabs--sub2 mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
			<button
				class="m-tab m-tab--sm {metric === 'items_bounty_total'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bounty_total')}
			>
				<i class="fas fa-skull"></i> Total bounties
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_bounty_claimer'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bounty_claimer')}
			>
				<i class="fas fa-coins"></i> Claimer
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_bounty_give'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_bounty_give')}
			>
				<i class="fas fa-crosshairs"></i> Giver
			</button>
		</div>
	{:else}
		<div class="m-tabs m-tabs--sub m-tabs--sub2 mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
			<button
				class="m-tab m-tab--sm {metric === 'items_gift_give'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_gift_give')}
			>
				<i class="fas fa-gift"></i> Given
			</button>
			<button
				class="m-tab m-tab--sm {metric === 'items_gift_receive'
					? 'm-tab--active'
					: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
				onclick={() => setMetric('items_gift_receive')}
			>
				<i class="fas fa-coins"></i> Received
			</button>
		</div>
	{/if}
{/if}

{#if isMinigamesGroup}
	<div class="m-tabs m-tabs--sub mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
		<button
			class="m-tab m-tab--sm m-tab--active text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold text-white"
			onclick={() => setMetric('minigames_gamble_net')}
		>
			<i class="fas fa-dice"></i> Gamble
		</button>
	</div>
	<div class="m-tabs m-tabs--sub m-tabs--sub2 mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
		<button
			class="m-tab m-tab--sm {metric === 'minigames_gamble_net'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('minigames_gamble_net')}
		>
			<i class="fas fa-coins"></i> Net XP
		</button>
		<button
			class="m-tab m-tab--sm {metric === 'minigames_gamble_ratio'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('minigames_gamble_ratio')}
		>
			<i class="fas fa-percent"></i> Win ratio
		</button>
		<button
			class="m-tab m-tab--sm {metric === 'minigames_gamble_big'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('minigames_gamble_big')}
		>
			<i class="fas fa-trophy"></i> Big win
		</button>
	</div>
{/if}

{#if isVoiceGroup}
	<div class="m-tabs m-tabs--sub mb-7 flex gap-2 overflow-x-auto rounded-[14px] p-1">
		<button
			class="m-tab m-tab--sm {metric === 'voice_total'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('voice_total')}
		>
			<i class="fas fa-layer-group"></i> Total
		</button>
		<button
			class="m-tab m-tab--sm {metric === 'voice_active'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('voice_active')}
		>
			<i class="fas fa-microphone-lines"></i> Active
		</button>
		<button
			class="m-tab m-tab--sm {metric === 'voice_afk'
				? 'm-tab--active'
				: ''} text-lb-text-faint flex flex-initial grow cursor-pointer items-center justify-center gap-1 rounded-[10px] px-2 px-3 py-2 text-xs font-semibold"
			onclick={() => setMetric('voice_afk')}
		>
			<i class="fas fa-moon"></i> AFK
		</button>
	</div>
{/if}

{#if top3.length > 0}
	<section class="m-podium-section mb-7">
		<div class="m-podium-stage flex items-end justify-center gap-0">
			{#each podiumOrder as { r, rank }}
				<div class="m-podium-col m-podium-col--{rank} relative flex min-w-0 flex-1 flex-col items-center opacity-0" class:m-mounted={mounted}>
					{#if rank === 1}
						<div class="m-crown relative z-10 -mb-2 w-11">
							<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M4 28L10 10L18 20L24 4L30 20L38 10L44 28H4Z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round" />
								<circle cx="4" cy="28" r="3" fill="#FFD700" />
								<circle cx="44" cy="28" r="3" fill="#FFD700" />
								<circle cx="24" cy="4" r="3" fill="#FFD700" />
								<rect x="2" y="28" width="44" height="4" rx="2" fill="#FFA500" />
							</svg>
						</div>
					{/if}

					<div class="m-avatar-wrap m-avatar-wrap--{rank} relative mb-2">
						<div class="m-avatar-ring rounded-full p-1" style="--ring-color: {rankColors[rank]}; --ring-glow: {rankGlow[rank]};">
							<div class="m-avatar-img h-full w-full overflow-hidden rounded-full">
								{#if r.avatar}
									<img src={r.avatar} alt={displayName(r)} />
								{:else}
									<div class="m-avatar-fallback flex h-full w-full items-center justify-center text-xl font-extrabold text-[rgba(36,95,115,0.9)]">
										{displayName(r).charAt(0).toUpperCase()}
									</div>
								{/if}
							</div>
						</div>
						<div
							class="m-rank-badge flex h-6 w-6 items-center justify-center rounded-full text-xs font-black"
							style="background: {rankGradients[rank]}; color: #111;"
						>
							{rank}
						</div>
					</div>

					<div class="m-podium-info mb-2 w-full min-w-0 overflow-hidden px-1 py-0 text-center">
						<div
							class="m-podium-name text-lb-text mb-1 max-w-full min-w-0 overflow-hidden text-base font-bold text-ellipsis whitespace-nowrap"
							title={displayName(r)}
						>
							{displayName(r)}
						</div>
						<div
							class="m-podium-score flex flex-nowrap items-baseline justify-center gap-1 text-lg font-black whitespace-nowrap tabular-nums"
							style="color: {rankColors[rank]};"
						>
							{metricValueAnimated(r, metric)}
							<span class="m-podium-unit ml-0 text-xs font-semibold opacity-70">{metricUnit(metric)}</span>
						</div>
						<div class="m-podium-level text-lb-text-faint mt-0 text-xs">{isItemsGroup || isMinigamesGroup ? itemsSub(r, metric) : `Level ${r.level ?? 0}`}</div>
					</div>

					<div
						class="m-podium-block relative flex w-full items-center justify-center overflow-hidden rounded-t-lg opacity-85"
						style="height: {podiumHeights[rank]}; background: {rankGradients[rank]};"
					>
						<span class="m-podium-block-num relative z-1 text-xs font-black text-[rgba(0,0,0,0.5)]">#{rank}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rest.length > 0}
	<section class="m-list-section overflow-hidden rounded-[20px]">
		<div class="m-list-header text-lb-text flex items-center justify-between px-4 pt-4 pb-3 text-base font-bold">
			<span>Rankings</span>
			<span class="m-list-count text-lb-text-soft text-xs font-medium">{rows.length.toLocaleString()} members</span>
		</div>
		<div class="m-list">
			{#each rest as r, i (r.discord_member_id)}
				<div class="m-list-row flex items-center gap-3 px-4 py-3 opacity-0" class:m-mounted={mounted} style="animation-delay: {i * 40}ms">
					<div class="m-list-rank text-lb-text-soft w-8 shrink-0 text-right text-xs font-bold">#{i + 4}</div>
					<div class="m-list-avatar h-10 w-10 shrink-0 overflow-hidden rounded-full">
						{#if r.avatar}
							<img src={r.avatar} alt={displayName(r)} />
						{:else}
							<div class="m-list-avatar-fallback text-lb-text-muted flex h-full w-full items-center justify-center text-base font-extrabold">
								{displayName(r).charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>
					<div class="m-list-info min-w-0 flex-1">
						<div
							class="m-list-name text-lb-text mb-0 max-w-full min-w-0 overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap"
							title={displayName(r)}
						>
							{displayName(r)}
						</div>
						<div class="m-list-sub text-lb-text-soft mb-1 text-xs">{isItemsGroup || isMinigamesGroup ? itemsSub(r, metric) : `Level ${r.level ?? 0}`}</div>
						<div class="m-list-bar-track h-1 overflow-hidden rounded-[99px]">
							<div class="m-list-bar-fill h-full rounded-[99px]" style="width: {barWidthPct(r, metric)}%"></div>
						</div>
					</div>
					<div class="m-list-score text-lb-text shrink-0 text-right text-base font-extrabold whitespace-nowrap tabular-nums">
						{metricValueAnimated(r, metric)}
						<span class="m-list-unit text-lb-text-faint ml-0 text-xs font-semibold">{metricUnit(metric)}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rows.length === 0}
	<div class="m-empty text-lb-text-soft flex flex-col items-center gap-3 px-5 py-15 text-center">
		<i class="fas fa-trophy" style="font-size: 48px; opacity: 0.2;"></i>
		<p>No data yet</p>
	</div>
{/if}
