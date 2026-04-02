<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Metric = typeof data.metric;

	let metric = $state<Metric>(data.metric);
	let rows = $state(data.rows);
	let es: EventSource | null = null;

	const top3 = $derived(rows.slice(0, 3));
	const rest = $derived(rows.slice(3));
	const maxValue = $derived(Math.max(1, ...rows.map((r: any) => metricValueNumber(r, metric))));

	let anim = $state<Record<string, number>>({});
	let raf: number | null = null;
	let mounted = $state(false);

	function displayName(r: any) {
		return r.server_display_name || r.display_name || r.username || r.discord_member_id;
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
		if (m === 'chat') return Math.round(n).toLocaleString();
		if (m.startsWith('voice_')) return `${Math.round(n).toLocaleString()}m`;
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

	function connect() {
		es?.close();
		es = new EventSource(`/api/leaderboards/${data.server.slug}/stream?metric=${metric}&range=all&limit=${data.limit}`);
		es.onmessage = (e) => {
			try {
				const snap = JSON.parse(e.data);
				if (snap?.rows) {
					rows = snap.rows;
					animateToCurrentValues(false);
				}
			} catch (_) {}
		};
	}

	onMount(() => {
		connect();
		animateToCurrentValues(true);
		mounted = true;
	});

	onDestroy(() => {
		es?.close();
		if (raf) cancelAnimationFrame(raf);
	});

	function setMetric(m: Metric) {
		metric = m;
		connect();
		animateToCurrentValues(true);
	}

	// Podium order: 2nd, 1st, 3rd
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
	<title>{data.server.name || data.server.slug} Leaderboard</title>
	<meta name="description" content="Top members leaderboard for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#0f0f17" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Leaderboard" />
	<meta property="og:description" content="See who's on top in {data.server.name || data.server.slug}." />
</svelte:head>

<div class="lb-root">
	<!-- Ambient background blobs -->
	<div class="blob blob-1"></div>
	<div class="blob blob-2"></div>
	<div class="blob blob-3"></div>

	<div class="lb-inner">
		<!-- Header -->
		<header class="lb-header">
			<div class="lb-server-icon">
				{#if data.server.server_icon}
					<img src={data.server.server_icon} alt={data.server.name} />
				{:else}
					<span class="lb-icon-placeholder">🏆</span>
				{/if}
			</div>
			<div class="lb-header-text">
				<h1>{data.server.name || data.server.slug}</h1>
				<p>Leaderboard <span class="lb-metric-pill">{metricLabel(metric)}</span></p>
			</div>
		</header>

		<!-- Metric tabs -->
		<div class="lb-tabs">
			{#each ['xp', 'chat', 'voice_total', 'voice_active', 'voice_afk'] as const as m}
				<button class="lb-tab {metric === m ? 'lb-tab--active' : ''}" onclick={() => setMetric(m)}>
					{#if m === 'xp'}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" /></svg
						>
						XP
					{:else if m === 'chat'}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor" /></svg
						>
						Chat
					{:else if m === 'voice_total'}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							><path
								d="M12 1C10.3 1 9 2.3 9 4V12C9 13.7 10.3 15 12 15S15 13.7 15 12V4C15 2.3 13.7 1 12 1ZM19 12C19 15.5 16.2 18.4 12.7 18.9V21H11.3V18.9C7.8 18.4 5 15.5 5 12H7C7 14.8 9.2 17 12 17S17 14.8 17 12H19Z"
								fill="currentColor"
							/></svg
						>
						Voice
					{:else if m === 'voice_active'}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" /><path
								d="M12 6C10.3 6 9 7.3 9 9V13C9 14.7 10.3 16 12 16S15 14.7 15 13V9C15 7.3 13.7 6 12 6Z"
								fill="currentColor"
							/></svg
						>
						Active
					{:else}
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							><path
								d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
								fill="currentColor"
							/></svg
						>
						AFK
					{/if}
				</button>
			{/each}
		</div>

		<!-- Podium -->
		{#if top3.length > 0}
			<section class="lb-podium-section">
				<div class="lb-podium-stage">
					{#each podiumOrder as { r, rank }}
						<div class="lb-podium-col lb-podium-col--{rank}" class:lb-mounted={mounted}>
							<!-- Crown for #1 -->
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

							<!-- Avatar -->
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

							<!-- Name & score -->
							<div class="lb-podium-info">
								<div class="lb-podium-name" title={displayName(r)}>{displayName(r)}</div>
								<div class="lb-podium-score" style="color: {rankColors[rank]};">
									{metricValueAnimated(r, metric)}
									<span class="lb-podium-unit">{metricUnit(metric)}</span>
								</div>
								{#if metric === 'xp'}
									<div class="lb-podium-level">Lvl {r.level ?? 1}</div>
								{/if}
							</div>

							<!-- Podium block -->
							<div class="lb-podium-block" style="height: {podiumHeights[rank]}; background: {rankGradients[rank]};">
								<span class="lb-podium-block-num">#{rank}</span>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Rest of rankings -->
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
								{#if metric === 'xp'}
									<div class="lb-list-sub">Level {r.level ?? 1}</div>
								{/if}
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
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none"
					><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.2" /></svg
				>
				<p>No data yet</p>
			</div>
		{/if}
	</div>
</div>

<style>
	/* ── Root & background ─────────────────────────────── */
	.lb-root {
		min-height: 100dvh;
		background: #0d0d14;
		position: relative;
		overflow: hidden;
		font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
	}

	.blob {
		position: fixed;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.18;
		pointer-events: none;
		z-index: 0;
		animation: blob-drift 18s ease-in-out infinite alternate;
	}
	.blob-1 {
		width: 420px;
		height: 420px;
		background: #7c3aed;
		top: -100px;
		left: -100px;
		animation-delay: 0s;
	}
	.blob-2 {
		width: 320px;
		height: 320px;
		background: #2563eb;
		bottom: 10%;
		right: -80px;
		animation-delay: -6s;
	}
	.blob-3 {
		width: 260px;
		height: 260px;
		background: #db2777;
		top: 40%;
		left: 30%;
		animation-delay: -12s;
	}

	@keyframes blob-drift {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(30px, 20px) scale(1.08);
		}
	}

	.lb-inner {
		position: relative;
		z-index: 1;
		max-width: 480px;
		margin: 0 auto;
		padding: 20px 16px 48px;
	}

	/* ── Header ─────────────────────────────────────────── */
	.lb-header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 22px;
	}
	.lb-server-icon {
		width: 52px;
		height: 52px;
		border-radius: 16px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.06);
		border: 1.5px solid rgba(255, 255, 255, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
	}
	.lb-server-icon img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.lb-icon-placeholder {
		font-size: 24px;
	}
	.lb-header-text h1 {
		font-size: 18px;
		font-weight: 800;
		color: #fff;
		margin: 0 0 2px;
		line-height: 1.2;
		letter-spacing: -0.3px;
	}
	.lb-header-text p {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.lb-metric-pill {
		background: rgba(124, 58, 237, 0.3);
		border: 1px solid rgba(124, 58, 237, 0.5);
		color: #a78bfa;
		padding: 1px 7px;
		border-radius: 99px;
		font-size: 11px;
		font-weight: 600;
	}

	/* ── Tabs ────────────────────────────────────────────── */
	.lb-tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 28px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 14px;
		padding: 5px;
	}
	.lb-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 4px;
		border-radius: 10px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.35);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.2s,
			color 0.2s,
			transform 0.15s;
		white-space: nowrap;
	}
	.lb-tab:hover {
		color: rgba(255, 255, 255, 0.7);
	}
	.lb-tab--active {
		background: linear-gradient(135deg, rgba(124, 58, 237, 0.7), rgba(37, 99, 235, 0.7));
		color: #fff;
		box-shadow: 0 2px 12px rgba(124, 58, 237, 0.4);
		transform: scale(1.02);
	}

	/* ── Podium section ──────────────────────────────────── */
	.lb-podium-section {
		margin-bottom: 28px;
	}
	.lb-podium-stage {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 0;
	}
	.lb-podium-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		position: relative;
		opacity: 0;
		transform: translateY(24px);
		transition:
			opacity 0.5s ease,
			transform 0.5s ease;
	}
	.lb-podium-col.lb-mounted {
		opacity: 1;
		transform: translateY(0);
	}
	.lb-podium-col--1 {
		z-index: 3;
		transition-delay: 0.1s;
	}
	.lb-podium-col--2 {
		z-index: 2;
		transition-delay: 0.2s;
	}
	.lb-podium-col--3 {
		z-index: 1;
		transition-delay: 0.3s;
	}

	/* Crown */
	.lb-crown {
		width: 44px;
		margin-bottom: -6px;
		position: relative;
		z-index: 10;
		filter: drop-shadow(0 2px 8px rgba(255, 215, 0, 0.6));
		animation: crown-float 3s ease-in-out infinite;
	}
	@keyframes crown-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	/* Avatar ring */
	.lb-avatar-wrap {
		position: relative;
		margin-bottom: 10px;
	}
	.lb-avatar-wrap--1 .lb-avatar-ring {
		width: 84px;
		height: 84px;
	}
	.lb-avatar-wrap--2 .lb-avatar-ring,
	.lb-avatar-wrap--3 .lb-avatar-ring {
		width: 66px;
		height: 66px;
	}

	.lb-avatar-ring {
		border-radius: 50%;
		padding: 3px;
		background: conic-gradient(from 0deg, var(--ring-color), transparent 60%, var(--ring-color));
		box-shadow:
			0 0 20px var(--ring-glow),
			0 0 40px var(--ring-glow);
		animation: ring-spin 4s linear infinite;
	}
	.lb-podium-col--2 .lb-avatar-ring,
	.lb-podium-col--3 .lb-avatar-ring {
		animation-play-state: paused;
	}

	@keyframes ring-spin {
		from {
			background: conic-gradient(from 0deg, var(--ring-color), transparent 60%, var(--ring-color));
		}
		to {
			background: conic-gradient(from 360deg, var(--ring-color), transparent 60%, var(--ring-color));
		}
	}

	.lb-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		overflow: hidden;
		background: #1a1a2e;
		border: 2px solid #0d0d14;
	}
	.lb-avatar-img img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.lb-avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.7);
		background: linear-gradient(135deg, #1e1e2e, #2d2d44);
	}

	.lb-rank-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 900;
		border: 2px solid #0d0d14;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	/* Podium info */
	.lb-podium-info {
		text-align: center;
		margin-bottom: 8px;
		padding: 0 4px;
		width: 100%;
	}
	.lb-podium-name {
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		margin-bottom: 3px;
	}
	.lb-podium-score {
		font-size: 18px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.5px;
		font-variant-numeric: tabular-nums;
	}
	.lb-podium-col--2 .lb-podium-score,
	.lb-podium-col--3 .lb-podium-score {
		font-size: 15px;
	}
	.lb-podium-unit {
		font-size: 10px;
		font-weight: 600;
		opacity: 0.7;
		margin-left: 1px;
	}
	.lb-podium-level {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 2px;
	}

	/* Podium block */
	.lb-podium-block {
		width: 100%;
		border-radius: 10px 10px 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.85;
		position: relative;
		overflow: hidden;
	}
	.lb-podium-block::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 50%);
	}
	.lb-podium-block-num {
		font-size: 11px;
		font-weight: 900;
		color: rgba(0, 0, 0, 0.5);
		position: relative;
		z-index: 1;
	}

	/* ── List section ────────────────────────────────────── */
	.lb-list-section {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 20px;
		overflow: hidden;
	}
	.lb-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px 12px;
		font-size: 13px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.8);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.lb-list-count {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
		font-weight: 500;
	}

	.lb-list-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		opacity: 0;
		transform: translateX(-16px);
		transition:
			opacity 0.4s ease,
			transform 0.4s ease,
			background 0.2s;
	}
	.lb-list-row:last-child {
		border-bottom: none;
	}
	.lb-list-row.lb-mounted {
		opacity: 1;
		transform: translateX(0);
	}
	.lb-list-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.lb-list-rank {
		width: 32px;
		text-align: right;
		font-size: 11px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.25);
		flex-shrink: 0;
	}
	.lb-list-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		overflow: hidden;
		border: 1.5px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
		background: #1a1a2e;
	}
	.lb-list-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.lb-list-avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 15px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.6);
	}
	.lb-list-info {
		flex: 1;
		min-width: 0;
	}
	.lb-list-name {
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 1px;
	}
	.lb-list-sub {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.3);
		margin-bottom: 5px;
	}
	.lb-list-bar-track {
		height: 3px;
		background: rgba(255, 255, 255, 0.07);
		border-radius: 99px;
		overflow: hidden;
	}
	.lb-list-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #7c3aed, #2563eb);
		border-radius: 99px;
		transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.lb-list-score {
		font-size: 14px;
		font-weight: 800;
		color: #fff;
		white-space: nowrap;
		text-align: right;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.lb-list-unit {
		font-size: 9px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.35);
		margin-left: 2px;
	}

	/* ── Empty state ─────────────────────────────────────── */
	.lb-empty {
		text-align: center;
		padding: 60px 20px;
		color: rgba(255, 255, 255, 0.25);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.lb-empty p {
		font-size: 14px;
		font-weight: 600;
	}
</style>
