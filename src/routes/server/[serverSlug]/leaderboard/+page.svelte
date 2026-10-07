<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import '../../../../server.css';
	import { EmptyState, MetricTabs, PODIUM_HEIGHT, RankAvatar, RANK_STYLES } from '$lib/frontend/components/public';
	import { normalizeAccent } from '$lib/themes.js';
	import { COLOR_MAX_TOTAL } from '$lib/color';
	import ThemeEffect from '$lib/frontend/components/ThemeEffect.svelte';
	import EffectName from '$lib/frontend/components/EffectName.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const serverName = $derived(data.server.name || data.server.slug);
	const metaDescription = $derived(
		`Live leaderboard for ${serverName} on Discord. Members ranked by XP, chat, voice, video, streaming, invites, items and minigames, for all time, this month or this week.`
	);

	type Metric = typeof data.metric;
	type Period = typeof data.period;

	const GAMBLE_METRICS: Metric[] = ['minigames_gamble_net', 'minigames_gamble_ratio', 'minigames_gamble_big'];
	const TOWER_METRICS: Metric[] = ['minigames_tower_net', 'minigames_tower_ratio', 'minigames_tower_big'];
	const COLOR_METRICS: Metric[] = ['minigames_color_net', 'minigames_color_avg', 'minigames_color_best'];
	const MINIGAMES_METRICS: Metric[] = [...GAMBLE_METRICS, ...TOWER_METRICS, ...COLOR_METRICS];
	const BOUNTY_METRICS: Metric[] = ['items_bounty_total', 'items_bounty_claimer', 'items_bounty_give'];
	const STEAL_METRICS: Metric[] = ['items_steal_total', 'items_steal_rate', 'items_steal_big'];
	const BOMB_METRICS: Metric[] = ['items_bomb_total', 'items_bomb_rate', 'items_bomb_big'];
	const GIFT_METRICS: Metric[] = ['items_gift_give', 'items_gift_receive'];
	const ITEMS_METRICS: Metric[] = [...BOUNTY_METRICS, ...STEAL_METRICS, ...BOMB_METRICS, ...GIFT_METRICS];
	const VOICE_METRICS: Metric[] = ['voice_total', 'voice_active', 'voice_afk'];
	const METRICS: Metric[] = ['xp', 'chat', ...VOICE_METRICS, 'video', 'streaming', 'invites', ...ITEMS_METRICS, ...MINIGAMES_METRICS];
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
	const isTowerGroup = $derived(TOWER_METRICS.includes(metric));
	const isColorGroup = $derived(COLOR_METRICS.includes(metric));
	const isBountyGroup = $derived(BOUNTY_METRICS.includes(metric));
	const isStealGroup = $derived(STEAL_METRICS.includes(metric));
	const isBombGroup = $derived(BOMB_METRICS.includes(metric));
	const isGiftGroup = $derived(GIFT_METRICS.includes(metric));
	const isInvites = $derived(metric === 'invites');

	const top3 = $derived(rows.slice(0, 3));
	const rest = $derived(rows.slice(3));
	const maxValue = $derived(Math.max(1, ...rows.map((r: any) => metricValueNumber(r, metric))));

	let anim = $state<Record<string, number>>({});
	let animKey = $state('');
	let raf: number | null = null;
	const tabKey = $derived(`${metric}|${period}`);
	let mounted = $state(false);

	function cleanName(s: string): string {
		return s.replace(/^\s*(\[AFK\]\s*)+/gi, '').trim();
	}

	function displayName(r: any) {
		const raw = String(r.server_display_name || r.display_name || r.username || r.discord_member_id || '');
		const cleaned = cleanName(raw);
		return cleaned || raw || 'Unknown';
	}

	function rowAccent(r: any): string | null {
		return normalizeAccent(r.theme_accent);
	}

	function metricValueNumber(r: any, m: string) {
		const n = rawMetricValue(r, m);
		return Number.isFinite(n) ? n : 0;
	}

	function rawMetricValue(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0);
		if (m === 'voice_total') return Number(r.voice_minutes_total || 0);
		if (m === 'voice_active') return Number(r.voice_minutes_active || 0);
		if (m === 'voice_afk') return Number(r.voice_minutes_afk || 0);
		if (m === 'video') return Number(r.voice_minutes_video || 0);
		if (m === 'streaming') return Number(r.voice_minutes_streaming || 0);
		if (m === 'minigames_gamble_net' || m === 'minigames_tower_net' || m === 'minigames_color_net') return Number(r.minigame_net || 0);
		if (m === 'minigames_gamble_ratio' || m === 'minigames_tower_ratio') return Number(r.minigame_ratio || 0);
		if (m === 'minigames_gamble_big' || m === 'minigames_tower_big') return Number(r.minigame_big_win || 0);
		if (m === 'minigames_color_avg') return Number(r.minigame_avg_score || 0);
		if (m === 'minigames_color_best') return Number(r.minigame_best_score || 0);
		if (m === 'items_bounty_total') return Number(r.bounty_on_them || 0);
		if (m === 'items_bounty_claimer') return Number(r.bounty_collected || 0);
		if (m === 'items_bounty_give') return Number(r.bounty_given || 0);
		if (m === 'items_steal_rate' || m === 'items_bomb_rate') return Number(r.attack_rate || 0);
		if (m === 'items_steal_big' || m === 'items_bomb_big') return Number(r.attack_big || 0);
		if (m === 'items_steal_total' || m === 'items_bomb_total') return Number(r.attack_total || 0);
		if (m === 'items_gift_give') return Number(r.gift_given || 0);
		if (m === 'items_gift_receive') return Number(r.gift_received || 0);
		if (m === 'invites') return Number(r.invites_total || 0);
		return Number(r.xp || 0);
	}

	function isRateMetric(m: string) {
		return m === 'minigames_gamble_ratio' || m === 'minigames_tower_ratio' || m === 'items_steal_rate' || m === 'items_bomb_rate';
	}

	function isScoreMetric(m: string) {
		return m === 'minigames_color_avg' || m === 'minigames_color_best';
	}

	function formatMetric(n: number, m: string) {
		const safe = Number.isFinite(n) ? n : 0;
		if (isScoreMetric(m)) return safe.toFixed(2);
		if (isRateMetric(m)) return (Math.round(safe * 10) / 10).toLocaleString();
		return Math.round(safe).toLocaleString();
	}

	function metricValueAnimated(r: any, m: string) {
		const live = animKey === tabKey ? anim[r.discord_member_id] : undefined;
		return formatMetric(live ?? metricValueNumber(r, m), m);
	}

	function podiumValueSize(r: any, m: string) {
		const len = formatMetric(metricValueNumber(r, m), m).length;
		if (len > 12) return 'text-[12px]';
		if (len > 9) return 'text-[15px]';
		return 'text-lg';
	}

	function metricUnit(m: string) {
		if (isRateMetric(m)) return '%';
		if (isScoreMetric(m)) return `/ ${COLOR_MAX_TOTAL}`;
		if (m === 'invites') return 'invites';
		if (m === 'chat') return 'msgs';
		if (m.startsWith('voice_') || m === 'video' || m === 'streaming') return 'min';
		return 'xp';
	}

	function itemsSub(r: any, m: string) {
		if (m.startsWith('minigames_color_')) {
			const total = Number(r.minigame_total || 0);
			const games = `${total} game${total === 1 ? '' : 's'}`;
			return m === 'minigames_color_best' ? games : `${games} · best ${Number(r.minigame_best_score || 0).toFixed(2)}`;
		}
		if (m.startsWith('minigames_')) {
			const wins = `${Number(r.minigame_wins || 0)}/${Number(r.minigame_total || 0)} wins`;
			return r.minigame_best_floor == null ? wins : `${wins} · floor ${Number(r.minigame_best_floor) || 0}`;
		}
		if (m === 'items_bounty_claimer') return 'claimed';
		if (m === 'items_bounty_give') return 'placed';
		if (m === 'items_bounty_total') return 'on their head';
		if (m.startsWith('items_steal_') || m.startsWith('items_bomb_')) {
			return `${Number(r.attack_success || 0)}/${Number(r.attack_attempts || 0)} hits`;
		}
		if (m === 'items_gift_give') return 'gifted';
		if (m === 'items_gift_receive') return 'received';
		if (m === 'invites') {
			const parts = [`${Number(r.invites_active || 0)} still here`];
			if (Number(r.invites_left || 0) > 0) parts.push(`${Number(r.invites_left)} left`);
			if (Number(r.invites_bonus || 0) !== 0) parts.push(`${Number(r.invites_bonus) > 0 ? '+' : ''}${Number(r.invites_bonus)} bonus`);
			return parts.join(' · ');
		}
		return '';
	}

	function rowSub(r: any) {
		return isItemsGroup || isMinigamesGroup || isInvites ? itemsSub(r, metric) : `Level ${r.level ?? 0}`;
	}

	function barWidthPct(r: any, m: string) {
		const v = metricValueNumber(r, m);
		if (v <= 0) return 0;
		return Math.max(1, Math.round((v / maxValue) * 100));
	}

	function animateToCurrentValues() {
		if (raf) cancelAnimationFrame(raf);
		const duration = 1100;
		const key = tabKey;
		const sameTab = animKey === key;
		const start = performance.now();
		const targets: Record<string, number> = {};
		for (const r of rows as any[]) targets[r.discord_member_id] = metricValueNumber(r, metric);
		const initial: Record<string, number> = {};
		for (const id of Object.keys(targets)) initial[id] = sameTab ? (anim[id] ?? 0) : 0;
		anim = { ...initial };
		animKey = key;

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
		myEs.onopen = () => {
			if (es === myEs) streamConnected = true;
		};
		myEs.onmessage = (e) => {
			if (es !== myEs) return;
			try {
				const snap = JSON.parse(e.data);
				if (snap?.rows) {
					rows = snap.rows;
					tabPrefetch.set(prefetchKey(metric, period), snap.rows);
					animateToCurrentValues();
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
		anim = Object.fromEntries((rows as any[]).map((r) => [r.discord_member_id, metricValueNumber(r, metric)]));
		animKey = tabKey;
		mounted = true;
		return onFirstInteraction(() => {
			const prefetchPeriod = period;
			for (const m of METRICS) {
				if (m === data.metric) continue;
				fetch(snapshotUrl(m, prefetchPeriod))
					.then((r) => (r.ok ? r.json() : null))
					.then((snap) => {
						if (snap?.rows && Array.isArray(snap.rows)) tabPrefetch.set(prefetchKey(m, prefetchPeriod), snap.rows);
					})
					.catch(() => {});
			}
			connect();
		});
	});

	onDestroy(() => {
		es?.close();
		if (raf) cancelAnimationFrame(raf);
	});

	async function loadCurrent() {
		const requested = prefetchKey(metric, period);
		const requestedMetric = metric;
		const requestedPeriod = period;
		const hit = tabPrefetch.get(requested);
		if (hit && hit.length > 0) {
			rows = hit;
			animateToCurrentValues();
		} else {
			rows = [];
		}
		connect();
		try {
			const res = await fetch(snapshotUrl(requestedMetric, requestedPeriod));
			if (res.ok) {
				const snap = await res.json();
				if (Array.isArray(snap?.rows)) {
					tabPrefetch.set(requested, snap.rows);
					if (prefetchKey(metric, period) !== requested) return;
					rows = snap.rows;
					animateToCurrentValues();
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
		{ id: 'invites', label: 'Invites', icon: 'fa-user-plus', active: isInvites },
		{ id: 'items_steal_total', label: 'Items', icon: 'fa-store', active: isItemsGroup },
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

	const minigamesGroupTabs = $derived([
		{ id: 'minigames_gamble_net', label: 'Gamble', icon: 'fa-dice', active: !isTowerGroup && !isColorGroup },
		{ id: 'minigames_tower_net', label: 'Tower', icon: 'fa-tower-observation', active: isTowerGroup },
		{ id: 'minigames_color_net', label: 'Color', icon: 'fa-eye-dropper', active: isColorGroup }
	]);

	const minigamesLeafTabs = $derived.by(() => {
		if (isColorGroup)
			return [
				{ id: 'minigames_color_net', label: 'XP won', icon: 'fa-coins', active: metric === 'minigames_color_net' },
				{ id: 'minigames_color_avg', label: 'Avg score', icon: 'fa-bullseye', active: metric === 'minigames_color_avg' },
				{ id: 'minigames_color_best', label: 'Best score', icon: 'fa-trophy', active: metric === 'minigames_color_best' }
			];
		if (isTowerGroup)
			return [
				{ id: 'minigames_tower_net', label: 'XP won', icon: 'fa-coins', active: metric === 'minigames_tower_net' },
				{ id: 'minigames_tower_ratio', label: 'Win rate', icon: 'fa-percent', active: metric === 'minigames_tower_ratio' },
				{ id: 'minigames_tower_big', label: 'Big win', icon: 'fa-trophy', active: metric === 'minigames_tower_big' }
			];
		return [
			{ id: 'minigames_gamble_net', label: 'Net XP', icon: 'fa-coins', active: metric === 'minigames_gamble_net' },
			{ id: 'minigames_gamble_ratio', label: 'Win rate', icon: 'fa-percent', active: metric === 'minigames_gamble_ratio' },
			{ id: 'minigames_gamble_big', label: 'Big win', icon: 'fa-trophy', active: metric === 'minigames_gamble_big' }
		];
	});

	const voiceTabs = $derived([
		{ id: 'voice_total', label: 'Total', icon: 'fa-layer-group', active: metric === 'voice_total' },
		{ id: 'voice_active', label: 'Active', icon: 'fa-microphone-lines', active: metric === 'voice_active' },
		{ id: 'voice_afk', label: 'AFK', icon: 'fa-moon', active: metric === 'voice_afk' }
	]);

	const metricPath = $derived(
		[
			metricTabs,
			isItemsGroup ? itemsGroupTabs : isMinigamesGroup ? minigamesGroupTabs : isVoiceGroup ? voiceTabs : [],
			isItemsGroup ? itemsLeafTabs : isMinigamesGroup ? minigamesLeafTabs : []
		]
			.map((tabs) => tabs.find((t) => t.active)?.label)
			.filter(Boolean)
			.join(' — ')
	);

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
	<title>{serverName} Leaderboard | {APP_NAME} Discord Bot</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={APP_NAME} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:title" content="{serverName} Leaderboard | {APP_NAME} Discord Bot" />
	<meta property="og:description" content={metaDescription} />
	<link rel="canonical" href={data.canonicalUrl} />
</svelte:head>

<div class="text-base-content/70 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
	<p class="m-0 flex flex-wrap items-center gap-1.5">
		Leaderboard
		<span class="badge badge-sm bg-primary/20 border-primary/35 text-accent font-semibold">{metricPath}</span>
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

<MetricTabs tabs={periodTabs} label="Time period" fit onselect={setPeriod} />
<MetricTabs tabs={metricTabs} label="Metric" onselect={setMetric} />

{#if isItemsGroup}
	<MetricTabs tabs={itemsGroupTabs} size="sm" depth={1} label="Item category" onselect={setMetric} />
	<MetricTabs tabs={itemsLeafTabs} size="sm" depth={2} label="Item metric" onselect={setMetric} />
{/if}

{#if isMinigamesGroup}
	<MetricTabs tabs={minigamesGroupTabs} size="sm" depth={1} label="Minigame" onselect={setMetric} />
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
					class="relative isolate flex min-w-0 flex-1 flex-col items-center transition-all duration-500 ease-out {mounted
						? 'translate-y-0 opacity-100'
						: 'translate-y-6 opacity-0'}"
					style={rowAccent(r) ? `--row-accent: ${rowAccent(r)}` : undefined}
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
						<div class="mb-0.5 truncate text-xs font-bold">
							<EffectName
								name={displayName(r)}
								effect={r.theme_effect}
								seed={r.theme_effect_seed}
								accent={r.theme_accent}
								class="text-base-content"
								title={displayName(r)}
							/>
						</div>
						<div
							class="flex items-baseline justify-center gap-[3px] font-black whitespace-nowrap tabular-nums {podiumValueSize(r, metric)}"
							style="color: {RANK_STYLES[rank].color};"
						>
							{metricValueAnimated(r, metric)}
							<span class="text-[10px] font-semibold opacity-70">{metricUnit(metric)}</span>
						</div>
						<div class="text-base-content/40 mt-0.5 text-[10px]">{rowSub(r)}</div>
					</div>

					<div
						class="relative isolate flex w-full items-center justify-center overflow-hidden rounded-t-[10px] opacity-85"
						style="height: {PODIUM_HEIGHT[rank]}; background: {RANK_STYLES[rank].gradient};"
					>
						{#if rowAccent(r)}
							{@const podiumImage = r.theme_image ?? null}
							{#if podiumImage}
								<div
									class="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-45"
									style="background-image: url('{podiumImage}')"
									aria-hidden="true"
								></div>
							{/if}
							<div
								class="pointer-events-none absolute inset-0 -z-10"
								style="background: color-mix(in srgb, {rowAccent(r)} 55%, transparent)"
								aria-hidden="true"
							></div>
							<ThemeEffect effect={r.theme_effect} seed={r.theme_effect_seed} accent={r.theme_accent} />
						{/if}
						<span class="relative text-[11px] font-black text-black/50">#{rank}</span>
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
			<span class="text-base-content/45 text-[11px] font-medium">Top {rows.length.toLocaleString()}</span>
		</div>
		<ul class="list">
			{#each rest as r, i (r.discord_member_id)}
				<li
					class="list-row border-base-300 relative isolate items-center gap-3 rounded-none border-b px-3 py-2.5 sm:px-4"
					style={rowAccent(r) ? `--row-accent: ${rowAccent(r)}` : undefined}
				>
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
						<div class="truncate text-[13px] font-semibold">
							<EffectName
								name={displayName(r)}
								effect={r.theme_effect}
								seed={r.theme_effect_seed}
								accent={r.theme_accent}
								class="text-base-content"
								title={displayName(r)}
							/>
						</div>
						<div class="text-base-content/45 mb-1.5 text-[10px]">{rowSub(r)}</div>
						<div class="bg-base-content/15 h-[3px] overflow-hidden rounded-full">
							<div
								class="h-full rounded-full transition-[width] duration-700 ease-out {rowAccent(r)
									? 'bg-(--row-accent)'
									: 'from-secondary to-primary bg-linear-to-r'}"
								style="width: {barWidthPct(r, metric)}%"
							></div>
						</div>
					</div>

					<span class="text-base-content shrink-0 text-right text-sm font-extrabold tabular-nums">
						{metricValueAnimated(r, metric)}
						<span class="text-base-content/40 text-[9px] font-semibold">{metricUnit(metric)}</span>
					</span>

					{#if rowAccent(r)}
						{@const rowImage = r.theme_image ?? null}
						{#if rowImage}
							<div
								class="fx-layer pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-16"
								style="background-image: url('{rowImage}')"
								aria-hidden="true"
							></div>
						{/if}
						<div
							class="fx-layer pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-[color-mix(in_srgb,var(--row-accent)_20%,transparent)] to-transparent"
							aria-hidden="true"
						></div>
						<div class="fx-layer pointer-events-none absolute inset-y-0 left-0 -z-10 w-[3px] bg-(--row-accent)" aria-hidden="true"></div>
						<ThemeEffect effect={r.theme_effect} seed={r.theme_effect_seed} accent={r.theme_accent} />
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if rows.length === 0}
	<EmptyState icon="fa-trophy" message="No data yet" />
{/if}
