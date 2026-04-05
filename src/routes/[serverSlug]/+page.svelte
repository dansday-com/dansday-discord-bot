<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import type { PublicPageStats } from '$lib/publicStatistics/index.js';

	let { data }: PageProps = $props();

	let liveStats = $state<PublicPageStats>({ ...data.stats });
	let liveBoost = $state(data.boost_level);
	let streamConnected = $state(false);
	let es: EventSource | null = null;

	const boostLevel = $derived(liveBoost);

	const leaderboardHref = $derived(`/${encodeURIComponent(data.server.slug)}/leaderboard`);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toLocaleString();
	}

	function fmtDec(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toFixed(2);
	}

	const membersWithoutLevels = $derived(
		Math.max(0, (liveStats.members_total ?? 0) - (liveStats.members_with_levels ?? 0))
	);

	const avgXP = $derived(
		(liveStats.members_with_levels ?? 0) > 0
			? Math.round((liveStats.leveling_total_experience ?? 0) / Number(liveStats.members_with_levels)).toLocaleString()
			: '0'
	);

	const avgVoiceMinutes = $derived(
		(liveStats.members_with_levels ?? 0) > 0
			? Math.round((liveStats.leveling_total_voice_minutes ?? 0) / Number(liveStats.members_with_levels)).toLocaleString()
			: '0'
	);

	const avgVoiceActive = $derived(
		(liveStats.members_with_levels ?? 0) > 0
			? Math.round((liveStats.leveling_total_voice_active ?? 0) / Number(liveStats.members_with_levels)).toLocaleString()
			: '0'
	);

	const avgLevelBarPct = $derived.by(() => {
		const maxL = Number(liveStats.leveling_max_level) || 0;
		const avgL = Number(liveStats.leveling_avg_level) || 0;
		if (maxL <= 0) return 0;
		return Math.min(100, Math.max(4, (avgL / maxL) * 100));
	});

	const voiceMix = $derived.by(() => {
		const a = Math.max(0, Number(liveStats.leveling_total_voice_active) || 0);
		const k = Math.max(0, Number(liveStats.leveling_total_voice_afk) || 0);
		const t = a + k;
		if (t <= 0) return { activePct: 0, afkPct: 0, empty: true };
		return { activePct: (a / t) * 100, afkPct: (k / t) * 100, empty: false };
	});

	let heroXpDisplay = $state(0);
	let rafXp: number | null = null;
	let lastXpForHero: number | null = null;

	function animateHeroXp(target: number) {
		if (rafXp) cancelAnimationFrame(rafXp);
		const start = performance.now();
		const from = heroXpDisplay;
		const dur = 900;
		const tick = (now: number) => {
			const u = Math.min(1, (now - start) / dur);
			const e = 1 - Math.pow(1 - u, 3);
			heroXpDisplay = Math.round(from + (target - from) * e);
			if (u < 1) rafXp = requestAnimationFrame(tick);
			else rafXp = null;
		};
		rafXp = requestAnimationFrame(tick);
	}

	$effect(() => {
		const t = Number(liveStats.leveling_total_experience) || 0;
		if (lastXpForHero === null) {
			heroXpDisplay = t;
			lastXpForHero = t;
			return;
		}
		if (t !== lastXpForHero) {
			lastXpForHero = t;
			animateHeroXp(t);
		}
	});

	function applyPayload(payload: { stats: PublicPageStats; boost_level: number }) {
		liveStats = { ...payload.stats };
		liveBoost = payload.boost_level;
	}

	onMount(() => {
		const url = `/api/leaderboards/${encodeURIComponent(data.server.slug)}/overview-stream`;
		const source = new EventSource(url);
		es = source;
		source.onopen = () => {
			streamConnected = true;
		};
		source.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data) as { stats: PublicPageStats; boost_level: number };
				if (payload?.stats) applyPayload(payload);
			} catch (_) {}
		};
		source.onerror = () => {
			streamConnected = false;
		};
	});

	onDestroy(() => {
		es?.close();
		if (rafXp) cancelAnimationFrame(rafXp);
	});
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot</title>
	<meta name="description" content="Public server statistics for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#0c0306" />
	<meta property="og:title" content="{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot" />
	<meta property="og:description" content="Members, channels, leveling, and voice activity for this community." />
</svelte:head>

<div class="lb-leaderboard-subhead lb-stats-overview-subhead">
	<p>
		Server overview
		{#if streamConnected}
			<span class="lb-metric-pill lb-metric-pill--live">
				<span class="lb-live-dot"></span>
				Live
			</span>
		{:else}
			<span class="lb-metric-pill lb-metric-pill--muted">Connecting…</span>
		{/if}
	</p>
</div>

<div class="lb-stats-grid">
	<div class="lb-stat-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-1">
				<i class="fas fa-users"></i>
			</div>
			<h2 class="lb-stat-card-title">Members</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-user-friends', label: 'Total', value: fmt(liveStats.members_total) }, { icon: 'fa-chart-line', label: 'With Levels', value: fmt(liveStats.members_with_levels) }, { icon: 'fa-gift', label: 'Boosting', value: fmt(liveStats.members_unique_boosters ?? liveStats.members_boosters) }, { icon: 'fa-moon', label: 'Active AFK', value: fmt(liveStats.member_afk) }, { icon: 'fa-user-slash', label: 'Without Levels', value: fmt(membersWithoutLevels) }] as row}
				<div class="lb-stat-row">
					<span class="lb-stat-row-label">
						<i class="fas {row.icon}"></i>
						{row.label}
					</span>
					<span class="lb-stat-row-value">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="lb-stat-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-2">
				<i class="fas fa-hashtag"></i>
			</div>
			<h2 class="lb-stat-card-title">Channels</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-list', label: 'Total', value: fmt(liveStats.channels_total) }, { icon: 'fa-comment', label: 'Text', value: fmt(liveStats.channels_text) }, { icon: 'fa-microphone', label: 'Voice', value: fmt(liveStats.channels_voice) }, { icon: 'fa-bullhorn', label: 'Announcement', value: fmt(liveStats.channels_announcement) }, { icon: 'fa-video', label: 'Stage', value: fmt(liveStats.channels_stage) }] as row}
				<div class="lb-stat-row">
					<span class="lb-stat-row-label">
						<i class="fas {row.icon}"></i>
						{row.label}
					</span>
					<span class="lb-stat-row-value">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="lb-stat-card lb-stat-card--leveling">
		<div class="lb-leveling-card-top">
			<div class="lb-stat-card-head lb-leveling-card-head">
				<div class="lb-stat-card-icon lb-chili-stat-3">
					<i class="fas fa-star"></i>
				</div>
				<h2 class="lb-stat-card-title">Leveling</h2>
			</div>
			<a href={leaderboardHref} class="lb-leveling-board-link" data-sveltekit-preload-data="hover">
				<span>Leaderboard</span>
				<i class="fas fa-arrow-right"></i>
			</a>
		</div>

		<div class="lb-leveling-hero">
			<p class="lb-leveling-hero-label">Total experience</p>
			<p class="lb-leveling-hero-value">{heroXpDisplay.toLocaleString()}</p>
			<p class="lb-leveling-hero-hint">Pooled XP from all tracked members</p>
		</div>

		<div class="lb-leveling-meters">
			<div class="lb-level-meter">
				<div class="lb-level-meter-head">
					<span class="lb-level-meter-title">Average vs peak level</span>
					<span class="lb-level-meter-meta">{fmtDec(liveStats.leveling_avg_level)} / {fmt(liveStats.leveling_max_level)}</span>
				</div>
				<div class="lb-level-meter-track">
					<div class="lb-level-meter-fill lb-level-meter-fill--avg" style="width: {avgLevelBarPct}%"></div>
				</div>
			</div>

			<div class="lb-level-meter">
				<div class="lb-level-meter-head">
					<span class="lb-level-meter-title">Voice mix (active vs AFK minutes)</span>
					<span class="lb-level-meter-meta">{fmt(liveStats.leveling_total_voice_active)} act · {fmt(liveStats.leveling_total_voice_afk)} AFK</span>
				</div>
				{#if voiceMix.empty}
					<div class="lb-level-meter-track lb-level-meter-track--empty">
						<span>No voice data yet</span>
					</div>
				{:else}
					<div class="lb-level-meter-stack" title="Share of active + AFK voice minutes">
						<div class="lb-level-meter-stack-active" style="width: {voiceMix.activePct}%"></div>
						<div class="lb-level-meter-stack-afk" style="width: {voiceMix.afkPct}%"></div>
					</div>
				{/if}
			</div>
		</div>

		<div class="lb-leveling-tiles">
			<div class="lb-level-tile">
				<i class="fas fa-comments"></i>
				<span class="lb-level-tile-value">{fmt(liveStats.leveling_total_chat)}</span>
				<span class="lb-level-tile-label">Messages</span>
			</div>
			<div class="lb-level-tile">
				<i class="fas fa-chart-line"></i>
				<span class="lb-level-tile-value">{avgXP}</span>
				<span class="lb-level-tile-label">Avg XP / member</span>
			</div>
			<div class="lb-level-tile">
				<i class="fas fa-crown"></i>
				<span class="lb-level-tile-value">{fmt(liveStats.leveling_max_level)}</span>
				<span class="lb-level-tile-label">Highest level</span>
			</div>
		</div>
	</div>

	<div class="lb-stat-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-4">
				<i class="fas fa-user-tag"></i>
			</div>
			<h2 class="lb-stat-card-title">Roles &amp; structure</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-shield-alt', label: 'Total Roles', value: fmt(liveStats.roles_total) }, { icon: 'fa-rocket', label: 'Boost Level', value: fmt(boostLevel) }, { icon: 'fa-gift', label: 'Total Boosts', value: fmt(liveStats.members_boosters) }, { icon: 'fa-folder', label: 'Categories', value: fmt(liveStats.categories_total) }, { icon: 'fa-user-cog', label: 'Custom Roles', value: fmt(liveStats.members_with_custom_roles) }] as row}
				<div class="lb-stat-row">
					<span class="lb-stat-row-label">
						<i class="fas {row.icon}"></i>
						{row.label}
					</span>
					<span class="lb-stat-row-value">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="lb-stat-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-5">
				<i class="fas fa-microphone-alt"></i>
			</div>
			<h2 class="lb-stat-card-title">Voice activity</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-clock', label: 'Total Minutes', value: fmt(liveStats.leveling_total_voice_minutes) }, { icon: 'fa-check-circle', label: 'Active', value: fmt(liveStats.leveling_total_voice_active) }, { icon: 'fa-chart-line', label: 'Avg Minutes', value: avgVoiceMinutes }, { icon: 'fa-chart-bar', label: 'Avg Active', value: avgVoiceActive }, { icon: 'fa-pause-circle', label: 'AFK', value: fmt(liveStats.leveling_total_voice_afk) }] as row}
				<div class="lb-stat-row">
					<span class="lb-stat-row-label">
						<i class="fas {row.icon}"></i>
						{row.label}
					</span>
					<span class="lb-stat-row-value">{row.value}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
