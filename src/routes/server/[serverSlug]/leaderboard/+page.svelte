<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;

	const METRICS: Metric[] = ['xp', 'chat', 'voice_total', 'voice_active', 'voice_afk', 'video', 'streaming'];
	const tabPrefetch = new Map<Metric, any[]>();

	let metric = $state<Metric>(data.metric);
	let rows = $state(data.rows);
	let es: EventSource | null = null;
	let streamConnected = $state(false);

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
		return 'XP';
	}

	function metricValueNumber(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0);
		if (m === 'voice_total') return Number(r.voice_minutes_total || 0);
		if (m === 'voice_active') return Number(r.voice_minutes_active || 0);
		if (m === 'voice_afk') return Number(r.voice_minutes_afk || 0);
		if (m === 'video') return Number(r.voice_minutes_video || 0);
		if (m === 'streaming') return Number(r.voice_minutes_streaming || 0);
		return Number(r.experience || 0);
	}

	function metricValueAnimated(r: any, m: string) {
		const n = anim[r.discord_member_id] ?? metricValueNumber(r, m);
		return Math.round(n).toLocaleString();
	}

	function metricUnit(m: string) {
		if (m === 'chat') return 'msgs';
		if (m.startsWith('voice_') || m === 'video' || m === 'streaming') return 'min';
		return 'xp';
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

	function snapshotUrl(m: Metric) {
		return `/api/leaderboards/${data.server.slug}/snapshot?metric=${m}&limit=${data.limit}`;
	}

	function connect() {
		es?.close();
		const myEs = new EventSource(`/api/leaderboards/${data.server.slug}/stream?metric=${metric}&limit=${data.limit}`);
		es = myEs;
		myEs.onmessage = (e) => {
			if (es !== myEs) return;
			try {
				const snap = JSON.parse(e.data);
				if (snap?.rows) {
					rows = snap.rows;
					tabPrefetch.set(metric, snap.rows);
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
		tabPrefetch.set(data.metric, data.rows);
		for (const m of METRICS) {
			if (m === data.metric) continue;
			fetch(snapshotUrl(m))
				.then((r) => (r.ok ? r.json() : null))
				.then((snap) => {
					if (snap?.rows && Array.isArray(snap.rows)) tabPrefetch.set(m, snap.rows);
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

	async function setMetric(m: Metric) {
		if (m === metric) return;
		metric = m;
		const hit = tabPrefetch.get(m);
		if (hit && hit.length > 0) {
			rows = hit;
			animateToCurrentValues(false);
		}
		connect();
		try {
			const res = await fetch(snapshotUrl(m));
			if (res.ok) {
				const snap = await res.json();
				if (Array.isArray(snap?.rows)) {
					tabPrefetch.set(m, snap.rows);
					rows = snap.rows;
					animateToCurrentValues(false);
				}
			}
		} catch (_) {}
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
		{#if streamConnected}
			<span class="m-metric-pill m-metric-pill--live">
				<span class="m-live-dot"></span>
				Live
			</span>
		{/if}
	</p>
</div>

<div class="m-tabs">
	{#each METRICS as m}
		<button class="m-tab {metric === m ? 'm-tab--active' : ''}" onclick={() => setMetric(m)}>
			{#if m === 'xp'}
				<i class="fas fa-star"></i> XP
			{:else if m === 'chat'}
				<i class="fas fa-message"></i> Chat
			{:else if m === 'voice_total'}
				<i class="fas fa-microphone"></i> Voice
			{:else if m === 'voice_active'}
				<i class="fas fa-microphone-lines"></i> Active
			{:else if m === 'voice_afk'}
				<i class="fas fa-moon"></i> AFK
			{:else if m === 'video'}
				<i class="fas fa-video"></i> Video
			{:else if m === 'streaming'}
				<i class="fas fa-tv"></i> Streaming
			{/if}
		</button>
	{/each}
</div>

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
						<div class="m-podium-level">Level {r.level ?? 0}</div>
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
						<div class="m-list-sub">Level {r.level ?? 0}</div>
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
