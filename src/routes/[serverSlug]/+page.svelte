<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import type { PublicPageStats } from '$lib/publicStatistics/index.js';

	let { data }: PageProps = $props();

	let liveStats = $state<PublicPageStats>({ ...data.stats });
	let liveBoost = $state(data.boost_level);
	let es: EventSource | null = null;

	const boostLevel = $derived(liveBoost);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toLocaleString();
	}

	function fmtDec(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toFixed(2);
	}

	const membersWithoutLevels = $derived(Math.max(0, (liveStats.members_total ?? 0) - (liveStats.members_with_levels ?? 0)));

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

	const membersLevelShare = $derived.by(() => {
		const total = Math.max(0, Number(liveStats.members_total) || 0);
		const withL = Math.max(0, Number(liveStats.members_with_levels) || 0);
		if (total <= 0) return { withPct: 0, withoutPct: 0, empty: true };
		const withPct = (withL / total) * 100;
		return { withPct, withoutPct: 100 - withPct, empty: false };
	});

	const channelMix = $derived.by(() => {
		const t = Math.max(0, Number(liveStats.channels_total) || 0);
		const text = Math.max(0, Number(liveStats.channels_text) || 0);
		const voice = Math.max(0, Number(liveStats.channels_voice) || 0);
		const other = Math.max(0, (Number(liveStats.channels_announcement) || 0) + (Number(liveStats.channels_stage) || 0));
		if (t <= 0) return { textPct: 0, voicePct: 0, otherPct: 0, empty: true };
		return {
			textPct: (text / t) * 100,
			voicePct: (voice / t) * 100,
			otherPct: (other / t) * 100,
			empty: false
		};
	});

	const boostersCount = $derived(Number(liveStats.members_unique_boosters ?? liveStats.members_boosters) || 0);

	const channelsOtherTotal = $derived((Number(liveStats.channels_announcement) || 0) + (Number(liveStats.channels_stage) || 0));

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
		source.onmessage = (e) => {
			try {
				const payload = JSON.parse(e.data) as { stats: PublicPageStats; boost_level: number };
				if (payload?.stats) applyPayload(payload);
			} catch (_) {}
		};
		source.onerror = () => {};
	});

	onDestroy(() => {
		es?.close();
		if (rafXp) cancelAnimationFrame(rafXp);
	});
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot</title>
	<meta name="description" content="Public server statistics for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot" />
	<meta property="og:description" content="Members, channels, leveling, and voice activity for this community." />
</svelte:head>

<div class="lb-leaderboard-subhead lb-stats-overview-subhead">
	<p>Server statistics</p>
</div>

<section class="lb-overview-strip" aria-label="Key metrics">
	{#each [{ icon: 'fa-users', label: 'Members', value: fmt(liveStats.members_total) }, { icon: 'fa-hashtag', label: 'Channels', value: fmt(liveStats.channels_total) }, { icon: 'fa-star', label: 'Total XP', value: heroXpDisplay.toLocaleString() }, { icon: 'fa-microphone', label: 'Voice min', value: fmt(liveStats.leveling_total_voice_minutes) }, { icon: 'fa-user-tag', label: 'Roles', value: fmt(liveStats.roles_total) }] as chip}
		<div class="lb-overview-strip-item">
			<div class="lb-overview-strip-icon"><i class="fas {chip.icon}"></i></div>
			<div class="lb-overview-strip-text">
				<span class="lb-overview-strip-value">{chip.value}</span>
				<span class="lb-overview-strip-label">{chip.label}</span>
			</div>
		</div>
	{/each}
</section>

<div class="lb-stats-grid">
	<div class="lb-stat-card lb-overview-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-1">
				<i class="fas fa-users"></i>
			</div>
			<h2 class="lb-stat-card-title">Members</h2>
		</div>
		<div class="lb-overview-hero">
			<p class="lb-overview-hero-label">Community size</p>
			<p class="lb-overview-hero-value">{fmt(liveStats.members_total)}</p>
		</div>
		<div class="lb-overview-bar-block">
			<div class="lb-overview-bar-head">
				<span>Leveling coverage</span>
				<span class="lb-overview-bar-meta">{fmt(liveStats.members_with_levels)} with levels</span>
			</div>
			{#if membersLevelShare.empty}
				<div class="lb-level-meter-track lb-level-meter-track--empty lb-overview-bar-empty"><span>No members yet</span></div>
			{:else}
				<div class="lb-overview-seg-bar" title="Share of members with leveling data">
					<div class="lb-overview-seg lb-overview-seg--a" style="width: {membersLevelShare.withPct}%"></div>
					<div class="lb-overview-seg lb-overview-seg--b" style="width: {membersLevelShare.withoutPct}%"></div>
				</div>
				<div class="lb-overview-legend">
					<span><i class="fas fa-circle"></i> With levels</span>
					<span><i class="fas fa-circle"></i> Without</span>
				</div>
			{/if}
		</div>
		<div class="lb-overview-mini-grid">
			<div class="lb-overview-mini">
				<i class="fas fa-chart-line"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.members_with_levels)}</span>
				<span class="lb-overview-mini-label">With levels</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-gift"></i>
				<span class="lb-overview-mini-value">{fmt(boostersCount)}</span>
				<span class="lb-overview-mini-label">Boosting</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-moon"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.member_afk)}</span>
				<span class="lb-overview-mini-label">Active AFK</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-user-slash"></i>
				<span class="lb-overview-mini-value">{fmt(membersWithoutLevels)}</span>
				<span class="lb-overview-mini-label">No levels</span>
			</div>
		</div>
	</div>

	<div class="lb-stat-card lb-overview-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-2">
				<i class="fas fa-hashtag"></i>
			</div>
			<h2 class="lb-stat-card-title">Channels</h2>
		</div>
		<div class="lb-overview-hero">
			<p class="lb-overview-hero-label">Server layout</p>
			<p class="lb-overview-hero-value">{fmt(liveStats.channels_total)}</p>
		</div>
		<div class="lb-overview-bar-block">
			<div class="lb-overview-bar-head">
				<span>Mix</span>
				<span class="lb-overview-bar-meta">Text · Voice · Other</span>
			</div>
			{#if channelMix.empty}
				<div class="lb-level-meter-track lb-level-meter-track--empty lb-overview-bar-empty"><span>No channels</span></div>
			{:else}
				<div class="lb-overview-seg-bar lb-overview-seg-bar--3" title="Channel types">
					<div class="lb-overview-seg lb-overview-seg--text" style="width: {channelMix.textPct}%"></div>
					<div class="lb-overview-seg lb-overview-seg--voice" style="width: {channelMix.voicePct}%"></div>
					<div class="lb-overview-seg lb-overview-seg--other" style="width: {channelMix.otherPct}%"></div>
				</div>
				<div class="lb-overview-legend lb-overview-legend--3">
					<span><i class="fas fa-circle"></i> Text {fmt(liveStats.channels_text)}</span>
					<span><i class="fas fa-circle"></i> Voice {fmt(liveStats.channels_voice)}</span>
					<span><i class="fas fa-circle"></i> Ann. / stage {fmt(channelsOtherTotal)}</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="lb-stat-card lb-stat-card--leveling lb-overview-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-3">
				<i class="fas fa-star"></i>
			</div>
			<h2 class="lb-stat-card-title">Leveling</h2>
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

	<div class="lb-stat-card lb-overview-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-4">
				<i class="fas fa-user-tag"></i>
			</div>
			<h2 class="lb-stat-card-title">Roles &amp; structure</h2>
		</div>
		<div class="lb-overview-hero">
			<p class="lb-overview-hero-label">Role catalog</p>
			<p class="lb-overview-hero-value">{fmt(liveStats.roles_total)}</p>
		</div>
		<div class="lb-overview-mini-grid">
			<div class="lb-overview-mini">
				<i class="fas fa-rocket"></i>
				<span class="lb-overview-mini-value">{fmt(boostLevel)}</span>
				<span class="lb-overview-mini-label">Boost tier</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-gift"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.members_boosters)}</span>
				<span class="lb-overview-mini-label">Boosts</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-folder"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.categories_total)}</span>
				<span class="lb-overview-mini-label">Categories</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-user-cog"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.members_with_custom_roles)}</span>
				<span class="lb-overview-mini-label">Custom roles</span>
			</div>
		</div>
	</div>

	<div class="lb-stat-card lb-overview-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-5">
				<i class="fas fa-microphone-alt"></i>
			</div>
			<h2 class="lb-stat-card-title">Voice activity</h2>
		</div>
		<div class="lb-overview-hero">
			<p class="lb-overview-hero-label">Tracked minutes</p>
			<p class="lb-overview-hero-value">{fmt(liveStats.leveling_total_voice_minutes)}</p>
		</div>
		<div class="lb-overview-bar-block">
			<div class="lb-overview-bar-head">
				<span>Active vs AFK</span>
				<span class="lb-overview-bar-meta">{fmt(liveStats.leveling_total_voice_active)} · {fmt(liveStats.leveling_total_voice_afk)}</span>
			</div>
			{#if voiceMix.empty}
				<div class="lb-level-meter-track lb-level-meter-track--empty lb-overview-bar-empty"><span>No voice data yet</span></div>
			{:else}
				<div class="lb-level-meter-stack" title="Share of voice minutes">
					<div class="lb-level-meter-stack-active" style="width: {voiceMix.activePct}%"></div>
					<div class="lb-level-meter-stack-afk" style="width: {voiceMix.afkPct}%"></div>
				</div>
			{/if}
		</div>
		<div class="lb-overview-mini-grid">
			<div class="lb-overview-mini">
				<i class="fas fa-check-circle"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.leveling_total_voice_active)}</span>
				<span class="lb-overview-mini-label">Active min</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-chart-line"></i>
				<span class="lb-overview-mini-value">{avgVoiceMinutes}</span>
				<span class="lb-overview-mini-label">Avg / member</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-chart-bar"></i>
				<span class="lb-overview-mini-value">{avgVoiceActive}</span>
				<span class="lb-overview-mini-label">Avg active</span>
			</div>
			<div class="lb-overview-mini">
				<i class="fas fa-pause-circle"></i>
				<span class="lb-overview-mini-value">{fmt(liveStats.leveling_total_voice_afk)}</span>
				<span class="lb-overview-mini-label">AFK min</span>
			</div>
		</div>
	</div>
</div>
