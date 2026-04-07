<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;

	const METRICS: Metric[] = ['xp', 'chat', 'voice_total', 'voice_active', 'voice_afk'];
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
		return 'XP';
	}

	function metricValueNumber(r: any, m: string) {
		if (m === 'chat') return Number(r.chat_total || 0);
		if (m === 'voice_total') return Number(r.voice_minutes_total || 0);
		if (m === 'voice_active') return Number(r.voice_minutes_active || 0);
		if (m === 'voice_afk') return Number(r.voice_minutes_afk || 0);
		return Number(r.experience || 0);
	}

	function metricValueAnimated(r: any, m: string) {
		const n = anim[r.discord_member_id] ?? metricValueNumber(r, m);
		return Math.round(n).toLocaleString();
	}

	function metricUnit(m: string) {
		if (m === 'chat') return 'msgs';
		if (m.startsWith('voice_')) return 'min';
		return 'xp';
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
	<title>{data.server.name || data.server.slug} Leaderboard | Dansday Discord Bot</title>
	<meta name="description" content="Top members leaderboard for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Leaderboard | Dansday Discord Bot" />
	<meta property="og:description" content="See who's on top in {data.server.name || data.server.slug}." />
</svelte:head>

<div class="lb-leaderboard-subhead lb-stats-overview-subhead">
	<p>
		Leaderboard
		<span class="lb-metric-pill">{metricLabel(metric)}</span>
		{#if streamConnected}
			<span class="lb-metric-pill lb-metric-pill--live">
				<span class="lb-live-dot"></span>
				Live
			</span>
		{/if}
	</p>
</div>

<div class="lb-tabs">
	{#each METRICS as m}
		<button class="lb-tab {metric === m ? 'lb-tab--active' : ''}" onclick={() => setMetric(m)}>
			{#if m === 'xp'}
				<i class="fas fa-star"></i> XP
			{:else if m === 'chat'}
				<i class="fas fa-message"></i> Chat
			{:else if m === 'voice_total'}
				<i class="fas fa-microphone"></i> Voice
			{:else if m === 'voice_active'}
				<i class="fas fa-microphone-lines"></i> Active
			{:else}
				<i class="fas fa-moon"></i> AFK
			{/if}
		</button>
	{/each}
</div>

{#if top3.length > 0}
	<section class="lb-podium-section">
		<div class="lb-podium-stage">
			{#each podiumOrder as { r, rank }}
				<div class="lb-podium-col lb-podium-col--{rank}" class:lb-mounted={mounted}>
					{#if rank === 1}
						<div class="lb-crown">
							<svg viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M4 28L10 10L18 20L24 4L30 20L38 10L44 28H4Z" fill="#FFD700" stroke="#FFA500" stroke-width="1.5" stroke-linejoin="round" />
								<circle cx="4" cy="28" r="3" fill="#FFD700" />
								<circle cx="44" cy="28" r="3" fill="#FFD700" />
								<circle cx="24" cy="4" r="3" fill="#FFD700" />
								<rect x="2" y="28" width="44" height="4" rx="2" fill="#FFA500" />
							</svg>
						</div>
					{/if}

					<div class="lb-avatar-wrap lb-avatar-wrap--{rank}">
						<div class="lb-avatar-ring" style="--ring-color: {rankColors[rank]}; --ring-glow: {rankGlow[rank]};">
							<div class="lb-avatar-img">
								{#if r.avatar}
									<img src={r.avatar} alt={displayName(r)} />
								{:else}
									<div class="lb-avatar-fallback">{displayName(r).charAt(0).toUpperCase()}</div>
								{/if}
							</div>
						</div>
						<div class="lb-rank-badge" style="background: {rankGradients[rank]}; color: #111;">
							{rank}
						</div>
					</div>

					<div class="lb-podium-info">
						<div class="lb-podium-name" title={displayName(r)}>{displayName(r)}</div>
						<div class="lb-podium-score" style="color: {rankColors[rank]};">
							{metricValueAnimated(r, metric)}
							<span class="lb-podium-unit">{metricUnit(metric)}</span>
						</div>
						<div class="lb-podium-level">Level {r.level ?? 0}</div>
					</div>

					<div class="lb-podium-block" style="height: {podiumHeights[rank]}; background: {rankGradients[rank]};">
						<span class="lb-podium-block-num">#{rank}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rest.length > 0}
	<section class="lb-list-section">
		<div class="lb-list-header">
			<span>Rankings</span>
			<span class="lb-list-count">{rows.length.toLocaleString()} members</span>
		</div>
		<div class="lb-list">
			{#each rest as r, i (r.discord_member_id)}
				<div class="lb-list-row" class:lb-mounted={mounted} style="animation-delay: {i * 40}ms">
					<div class="lb-list-rank">#{i + 4}</div>
					<div class="lb-list-avatar">
						{#if r.avatar}
							<img src={r.avatar} alt={displayName(r)} />
						{:else}
							<div class="lb-list-avatar-fallback">{displayName(r).charAt(0).toUpperCase()}</div>
						{/if}
					</div>
					<div class="lb-list-info">
						<div class="lb-list-name" title={displayName(r)}>{displayName(r)}</div>
						<div class="lb-list-sub">Level {r.level ?? 0}</div>
						<div class="lb-list-bar-track">
							<div class="lb-list-bar-fill" style="width: {Math.max(3, Math.round((metricValueNumber(r, metric) / maxValue) * 100))}%"></div>
						</div>
					</div>
					<div class="lb-list-score">
						{metricValueAnimated(r, metric)}
						<span class="lb-list-unit">{metricUnit(metric)}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if rows.length === 0}
	<div class="lb-empty">
		<i class="fas fa-trophy" style="font-size: 48px; opacity: 0.2;"></i>
		<p>No data yet</p>
	</div>
{/if}
