<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import type { PublicPageStats } from '$lib/frontend/public/statistics/index.js';

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

	const hasMarket = $derived((liveStats.assets_market_value ?? 0) > 0 || (liveStats.assets_trade_count ?? 0) > 0);
	const hasItems = $derived(
		(liveStats.items_buys ?? 0) > 0 ||
			(liveStats.items_steal_attempts ?? 0) > 0 ||
			(liveStats.items_bomb_attempts ?? 0) > 0 ||
			(liveStats.items_gifts ?? 0) > 0 ||
			(liveStats.items_spies ?? 0) > 0 ||
			(liveStats.items_bounties_placed ?? 0) > 0
	);
	const hasMinigames = $derived((liveStats.minigames_plays ?? 0) > 0);
	const hasGiveaways = $derived((liveStats.giveaways_total ?? 0) > 0);
	const hasStreams = $derived((liveStats.streams_total ?? 0) > 0);
	const hasQuests = $derived((liveStats.quests_enrolled ?? 0) > 0);
	const hasStaffFeedback = $derived((liveStats.staff_reviews ?? 0) > 0 || (liveStats.feedback_submissions ?? 0) > 0 || (liveStats.afk_active ?? 0) > 0);

	const stealHitRate = $derived(
		(liveStats.items_steal_attempts ?? 0) > 0 ? Math.round((Number(liveStats.items_steals_landed) / Number(liveStats.items_steal_attempts)) * 100) : 0
	);

	const minigamesWinRate = $derived(
		(liveStats.minigames_plays ?? 0) > 0 ? Math.round((Number(liveStats.minigames_wins) / Number(liveStats.minigames_plays)) * 100) : 0
	);

	function pct(part: number | null | undefined, whole: number | null | undefined): number {
		const w = Number(whole) || 0;
		if (w <= 0) return 0;
		return Math.min(100, Math.max(0, (Number(part) / w) * 100));
	}

	const marketFlow = $derived.by(() => {
		const inn = Math.max(0, Number(liveStats.assets_buy_volume) || 0);
		const out = Math.max(0, Number(liveStats.assets_sell_volume) || 0);
		const t = inn + out;
		if (t <= 0) return { inPct: 0, outPct: 0, empty: true };
		return { inPct: (inn / t) * 100, outPct: (out / t) * 100, empty: false };
	});

	const marketProfit = $derived(Number(liveStats.assets_realized_net) || 0);

	const heistMix = $derived.by(() => {
		const landed = Math.max(0, Number(liveStats.items_steals_landed) || 0);
		const caught = Math.max(0, Number(liveStats.items_steals_caught) || 0);
		const t = landed + caught;
		if (t <= 0) return { landedPct: 0, caughtPct: 0, empty: true };
		return { landedPct: (landed / t) * 100, caughtPct: (caught / t) * 100, empty: false };
	});

	const giveawayClaimPct = $derived(pct(liveStats.giveaways_winners, liveStats.giveaways_entrants));
	const questClaimPct = $derived(pct(liveStats.quests_claimed, liveStats.quests_enrolled));
	const staffRatingPct = $derived(pct(liveStats.staff_avg_rating, 5));

	const streamEngage = $derived.by(() => {
		const likes = Math.max(0, Number(liveStats.streams_likes) || 0);
		const chat = Math.max(0, Number(liveStats.streams_chat_messages) || 0);
		const gifts = Math.max(0, Number(liveStats.streams_gifts) || 0);
		const shares = Math.max(0, Number(liveStats.streams_shares) || 0);
		const t = likes + chat + gifts + shares;
		if (t <= 0) return { likePct: 0, chatPct: 0, giftPct: 0, sharePct: 0, empty: true };
		return { likePct: (likes / t) * 100, chatPct: (chat / t) * 100, giftPct: (gifts / t) * 100, sharePct: (shares / t) * 100, empty: false };
	});

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
		const url = `/api/public-statistics/${encodeURIComponent(data.server.slug)}/overview-stream`;
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
	<title>{data.server.name || data.server.slug} Statistics | {APP_NAME} Discord Bot</title>
	<meta name="description" content="Public statistics for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#245f73" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Statistics | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="Members, channels, leveling, and voice activity for this community." />
</svelte:head>

<div class="m-leaderboard-subhead m-stats-subhead">
	<p>Statistics</p>
</div>

<section class="m-overview-strip" aria-label="Key metrics">
	{#each [{ icon: 'fa-users', label: 'Members', value: fmt(liveStats.members_total) }, { icon: 'fa-hashtag', label: 'Channels', value: fmt(liveStats.channels_total) }, { icon: 'fa-star', label: 'Total XP', value: heroXpDisplay.toLocaleString() }, { icon: 'fa-microphone', label: 'Voice min', value: fmt(liveStats.leveling_total_voice_minutes) }, { icon: 'fa-user-tag', label: 'Roles', value: fmt(liveStats.roles_total) }] as chip}
		<div class="m-overview-strip-item">
			<div class="m-overview-strip-icon"><i class="fas {chip.icon}"></i></div>
			<div class="m-overview-strip-text">
				<span class="m-overview-strip-value">{chip.value}</span>
				<span class="m-overview-strip-label">{chip.label}</span>
			</div>
		</div>
	{/each}
</section>

<div class="m-stats-grid">
	<div class="m-stat-card m-overview-card">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-1">
				<i class="fas fa-users"></i>
			</div>
			<h2 class="m-stat-card-title">Members</h2>
		</div>
		<div class="m-overview-hero">
			<p class="m-overview-hero-label">Community size</p>
			<p class="m-overview-hero-value">{fmt(liveStats.members_total)}</p>
		</div>
		<div class="m-bar-block">
			<div class="m-bar-head">
				<span>Leveling coverage</span>
				<span class="m-bar-meta">{fmt(liveStats.members_with_levels)} with levels</span>
			</div>
			{#if membersLevelShare.empty}
				<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No members yet</span></div>
			{:else}
				<div class="m-seg-bar" title="Share of members with leveling data">
					<div class="m-seg m-seg--a" style="width: {membersLevelShare.withPct}%"></div>
					<div class="m-seg m-seg--b" style="width: {membersLevelShare.withoutPct}%"></div>
				</div>
				<div class="m-legend">
					<span><i class="fas fa-circle"></i> With levels</span>
					<span><i class="fas fa-circle"></i> Without</span>
				</div>
			{/if}
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-chart-line"></i>
				<span class="m-mini-value">{fmt(liveStats.members_with_levels)}</span>
				<span class="m-mini-label">With levels</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-gift"></i>
				<span class="m-mini-value">{fmt(boostersCount)}</span>
				<span class="m-mini-label">Boosting</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-moon"></i>
				<span class="m-mini-value">{fmt(liveStats.member_afk)}</span>
				<span class="m-mini-label">Active AFK</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-user-slash"></i>
				<span class="m-mini-value">{fmt(membersWithoutLevels)}</span>
				<span class="m-mini-label">No levels</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-2">
				<i class="fas fa-hashtag"></i>
			</div>
			<h2 class="m-stat-card-title">Channels</h2>
		</div>
		<div class="m-overview-hero">
			<p class="m-overview-hero-label">Server layout</p>
			<p class="m-overview-hero-value">{fmt(liveStats.channels_total)}</p>
		</div>
		<div class="m-bar-block">
			<div class="m-bar-head">
				<span>Mix</span>
				<span class="m-bar-meta">Text · Voice · Other</span>
			</div>
			{#if channelMix.empty}
				<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No channels</span></div>
			{:else}
				<div class="m-seg-bar m-seg-bar--3" title="Channel types">
					<div class="m-seg m-seg--text" style="width: {channelMix.textPct}%"></div>
					<div class="m-seg m-seg--voice" style="width: {channelMix.voicePct}%"></div>
					<div class="m-seg m-seg--other" style="width: {channelMix.otherPct}%"></div>
				</div>
				<div class="m-legend m-legend--3">
					<span><i class="fas fa-circle"></i> Text {fmt(liveStats.channels_text)}</span>
					<span><i class="fas fa-circle"></i> Voice {fmt(liveStats.channels_voice)}</span>
					<span><i class="fas fa-circle"></i> Ann. / stage {fmt(channelsOtherTotal)}</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="m-stat-card m-stat-card--leveling m-overview-card">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-3">
				<i class="fas fa-star"></i>
			</div>
			<h2 class="m-stat-card-title">Leveling</h2>
		</div>

		<div class="m-leveling-hero">
			<p class="m-leveling-hero-label">Total experience</p>
			<p class="m-leveling-hero-value">{heroXpDisplay.toLocaleString()}</p>
			<p class="m-leveling-hero-hint">
				Wallet + XP invested in assets{#if liveStats.leveling_assets_value > 0}
					· {fmt(liveStats.leveling_wallet_experience)} wallet + {fmt(liveStats.leveling_assets_value)} in market{/if}
			</p>
		</div>

		<div class="m-leveling-meters">
			<div class="m-level-meter">
				<div class="m-level-meter-head">
					<span class="m-level-meter-title">Average vs peak level</span>
					<span class="m-level-meter-meta">{fmtDec(liveStats.leveling_avg_level)} / {fmt(liveStats.leveling_max_level)}</span>
				</div>
				<div class="m-level-meter-track">
					<div class="m-level-meter-fill m-level-meter-fill--avg" style="width: {avgLevelBarPct}%"></div>
				</div>
			</div>
		</div>

		<div class="m-leveling-tiles">
			<div class="m-level-tile">
				<i class="fas fa-comments"></i>
				<span class="m-level-tile-value">{fmt(liveStats.leveling_total_chat)}</span>
				<span class="m-level-tile-label">Messages</span>
			</div>
			<div class="m-level-tile">
				<i class="fas fa-chart-line"></i>
				<span class="m-level-tile-value">{avgXP}</span>
				<span class="m-level-tile-label">Avg XP / member</span>
			</div>
			<div class="m-level-tile">
				<i class="fas fa-crown"></i>
				<span class="m-level-tile-value">{fmt(liveStats.leveling_max_level)}</span>
				<span class="m-level-tile-label">Highest level</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-4">
				<i class="fas fa-user-tag"></i>
			</div>
			<h2 class="m-stat-card-title">Roles &amp; structure</h2>
		</div>
		<div class="m-overview-hero">
			<p class="m-overview-hero-label">Role catalog</p>
			<p class="m-overview-hero-value">{fmt(liveStats.roles_total)}</p>
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-rocket"></i>
				<span class="m-mini-value">{fmt(boostLevel)}</span>
				<span class="m-mini-label">Boost tier</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-gift"></i>
				<span class="m-mini-value">{fmt(liveStats.members_boosters)}</span>
				<span class="m-mini-label">Boosts</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-folder"></i>
				<span class="m-mini-value">{fmt(liveStats.categories_total)}</span>
				<span class="m-mini-label">Categories</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-user-cog"></i>
				<span class="m-mini-value">{fmt(liveStats.members_with_custom_roles)}</span>
				<span class="m-mini-label">Custom roles</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card">
		<div class="m-stat-card-head">
			<div class="m-stat-card-icon m-chili-stat-5">
				<i class="fas fa-microphone-alt"></i>
			</div>
			<h2 class="m-stat-card-title">Voice activity</h2>
		</div>
		<div class="m-overview-hero">
			<p class="m-overview-hero-label">Tracked minutes</p>
			<p class="m-overview-hero-value">{fmt(liveStats.leveling_total_voice_minutes)}</p>
		</div>
		<div class="m-bar-block">
			<div class="m-bar-head">
				<span>Active vs AFK</span>
				<span class="m-bar-meta">{fmt(liveStats.leveling_total_voice_active)} · {fmt(liveStats.leveling_total_voice_afk)}</span>
			</div>
			{#if voiceMix.empty}
				<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No voice data yet</span></div>
			{:else}
				<div class="m-level-meter-stack" title="Share of voice minutes">
					<div class="m-level-meter-stack-active" style="width: {voiceMix.activePct}%"></div>
					<div class="m-level-meter-stack-afk" style="width: {voiceMix.afkPct}%"></div>
				</div>
			{/if}
		</div>
		<div class="m-mini-grid">
			<div class="m-mini">
				<i class="fas fa-check-circle"></i>
				<span class="m-mini-value">{fmt(liveStats.leveling_total_voice_active)}</span>
				<span class="m-mini-label">Active min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-chart-line"></i>
				<span class="m-mini-value">{avgVoiceMinutes}</span>
				<span class="m-mini-label">Avg / member</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-chart-bar"></i>
				<span class="m-mini-value">{avgVoiceActive}</span>
				<span class="m-mini-label">Avg active</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-pause-circle"></i>
				<span class="m-mini-value">{fmt(liveStats.leveling_total_voice_afk)}</span>
				<span class="m-mini-label">AFK min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-video"></i>
				<span class="m-mini-value">{fmt(liveStats.leveling_total_voice_video)}</span>
				<span class="m-mini-label">Video min</span>
			</div>
			<div class="m-mini">
				<i class="fas fa-desktop"></i>
				<span class="m-mini-value">{fmt(liveStats.leveling_total_voice_streaming)}</span>
				<span class="m-mini-label">Stream min</span>
			</div>
		</div>
	</div>

	{#if hasMarket}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-chart-line"></i></div>
				<h2 class="m-stat-card-title">Market</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">XP in the market</p>
				<p class="m-overview-hero-value">{fmt(liveStats.assets_market_value)}</p>
				<p class="m-overview-hero-hint m-hero-trend" class:m-hero-trend--up={marketProfit >= 0} class:m-hero-trend--down={marketProfit < 0}>
					<i class="fas {marketProfit >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
					{marketProfit >= 0 ? '+' : '−'}{fmt(Math.abs(marketProfit))} XP realized P/L
				</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Capital flow</span>
					<span class="m-bar-meta">In · Out</span>
				</div>
				{#if marketFlow.empty}
					<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No trades yet</span></div>
				{:else}
					<div class="m-seg-bar" title="XP bought in vs cashed out">
						<div class="m-seg m-seg--a" style="width: {marketFlow.inPct}%"></div>
						<div class="m-seg m-seg--b" style="width: {marketFlow.outPct}%"></div>
					</div>
					<div class="m-legend">
						<span><i class="fas fa-circle"></i> Bought in {fmt(liveStats.assets_buy_volume)}</span>
						<span><i class="fas fa-circle"></i> Cashed out {fmt(liveStats.assets_sell_volume)}</span>
					</div>
				{/if}
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-right-left"></i>
					<span class="m-mini-value">{fmt(liveStats.assets_trade_count)}</span>
					<span class="m-mini-label">Trades</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-users"></i>
					<span class="m-mini-value">{fmt(liveStats.assets_traders)}</span>
					<span class="m-mini-label">Traders</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-briefcase"></i>
					<span class="m-mini-value">{fmt(liveStats.assets_open_positions)}</span>
					<span class="m-mini-label">Open assets</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-arrow-up-from-bracket"></i>
					<span class="m-mini-value">{fmt(liveStats.assets_buy_volume)}</span>
					<span class="m-mini-label">XP bought in</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-download"></i>
					<span class="m-mini-value">{fmt(liveStats.assets_sell_volume)}</span>
					<span class="m-mini-label">XP cashed out</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasItems}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-bag-shopping"></i></div>
				<h2 class="m-stat-card-title">Items</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">Items bought</p>
				<p class="m-overview-hero-value">{fmt(liveStats.items_buys)}</p>
				<p class="m-overview-hero-hint">{fmt(liveStats.items_buy_spend)} XP spent across {fmt(liveStats.items_distinct_bought)} unique items</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Heist outcomes</span>
					<span class="m-bar-meta">{stealHitRate}% success</span>
				</div>
				{#if heistMix.empty}
					<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No heists attempted</span></div>
				{:else}
					<div class="m-seg-bar" title="Successful steals vs caught">
						<div class="m-seg m-seg--a" style="width: {heistMix.landedPct}%"></div>
						<div class="m-seg m-seg--b" style="width: {heistMix.caughtPct}%"></div>
					</div>
					<div class="m-legend">
						<span><i class="fas fa-circle"></i> Landed {fmt(liveStats.items_steals_landed)}</span>
						<span><i class="fas fa-circle"></i> Caught {fmt(liveStats.items_steals_caught)}</span>
					</div>
				{/if}
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-wand-magic-sparkles"></i>
					<span class="m-mini-value">{fmt(liveStats.items_activations)}</span>
					<span class="m-mini-label">Activations</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-hand"></i>
					<span class="m-mini-value">{fmt(liveStats.items_stolen)}</span>
					<span class="m-mini-label">XP stolen</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-bomb"></i>
					<span class="m-mini-value">{fmt(liveStats.items_bombed)}</span>
					<span class="m-mini-label">XP bombed</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-gift"></i>
					<span class="m-mini-value">{fmt(liveStats.items_gifted)}</span>
					<span class="m-mini-label">XP gifted</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-magnifying-glass"></i>
					<span class="m-mini-value">{fmt(liveStats.items_spies)}</span>
					<span class="m-mini-label">Spy reports</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-crown"></i>
					<span class="m-mini-value">{fmt(liveStats.items_bounties_placed)}</span>
					<span class="m-mini-label">Bounties set</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasMinigames}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-3"><i class="fas fa-dice"></i></div>
				<h2 class="m-stat-card-title">Minigames</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">XP wagered</p>
				<p class="m-overview-hero-value">{fmt(liveStats.minigames_wagered)}</p>
				<p class="m-overview-hero-hint">{fmt(liveStats.minigames_plays)} plays · {fmt(liveStats.minigames_paid_out)} XP paid out</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Player win rate</span>
					<span class="m-bar-meta">{minigamesWinRate}%</span>
				</div>
				<div class="m-level-meter-track">
					<div class="m-level-meter-fill m-level-meter-fill--avg" style="width: {Math.max(4, minigamesWinRate)}%"></div>
				</div>
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-trophy"></i>
					<span class="m-mini-value">{fmt(liveStats.minigames_biggest_win)}</span>
					<span class="m-mini-label">Biggest win</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-scale-balanced"></i>
					<span class="m-mini-value">{liveStats.minigames_net <= 0 ? '+' : '−'}{fmt(Math.abs(liveStats.minigames_net))}</span>
					<span class="m-mini-label">House edge</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasGiveaways}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-4"><i class="fas fa-gift"></i></div>
				<h2 class="m-stat-card-title">Giveaways</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">Giveaways hosted</p>
				<p class="m-overview-hero-value">{fmt(liveStats.giveaways_total)}</p>
				<p class="m-overview-hero-hint">{fmt(liveStats.giveaways_entries)} entries from {fmt(liveStats.giveaways_entrants)} members</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Odds of winning</span>
					<span class="m-bar-meta">{giveawayClaimPct.toFixed(1)}%</span>
				</div>
				{#if liveStats.giveaways_entrants > 0}
					<div class="m-level-meter-track">
						<div class="m-level-meter-fill m-level-meter-fill--avg" style="width: {Math.max(4, giveawayClaimPct)}%"></div>
					</div>
				{:else}
					<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No entrants yet</span></div>
				{/if}
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-medal"></i>
					<span class="m-mini-value">{fmt(liveStats.giveaways_winners)}</span>
					<span class="m-mini-label">Winners drawn</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-hourglass-half"></i>
					<span class="m-mini-value">{fmt(liveStats.giveaways_active)}</span>
					<span class="m-mini-label">Running now</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasStreams}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-5"><i class="fas fa-tower-broadcast"></i></div>
				<h2 class="m-stat-card-title">Content creators</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">Streams broadcast</p>
				<p class="m-overview-hero-value">{fmt(liveStats.streams_total)}</p>
				<p class="m-overview-hero-hint">{fmt(liveStats.streams_creators)} creators · {fmt(liveStats.streams_peak_viewers)} peak viewers</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Engagement mix</span>
					<span class="m-bar-meta">Likes · Chat · Gifts · Shares</span>
				</div>
				{#if streamEngage.empty}
					<div class="m-level-meter-track m-level-meter-track--empty m-bar-empty"><span>No engagement yet</span></div>
				{:else}
					<div class="m-seg-bar m-seg-bar--3" title="Stream engagement breakdown">
						<div class="m-seg m-seg--text" style="width: {streamEngage.likePct}%"></div>
						<div class="m-seg m-seg--voice" style="width: {streamEngage.chatPct}%"></div>
						<div class="m-seg m-seg--other" style="width: {streamEngage.giftPct}%"></div>
						<div class="m-seg m-seg--b" style="width: {streamEngage.sharePct}%"></div>
					</div>
					<div class="m-legend m-legend--3">
						<span><i class="fas fa-circle"></i> Likes {fmt(liveStats.streams_likes)}</span>
						<span><i class="fas fa-circle"></i> Chat {fmt(liveStats.streams_chat_messages)}</span>
						<span><i class="fas fa-circle"></i> Gifts {fmt(liveStats.streams_gifts)}</span>
					</div>
				{/if}
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-user-plus"></i>
					<span class="m-mini-value">{fmt(liveStats.streams_follows)}</span>
					<span class="m-mini-label">Follows</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-share-nodes"></i>
					<span class="m-mini-value">{fmt(liveStats.streams_shares)}</span>
					<span class="m-mini-label">Shares</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-user-group"></i>
					<span class="m-mini-value">{fmt(liveStats.streams_unique_chatters)}</span>
					<span class="m-mini-label">Chatters</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasQuests}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-1"><i class="fas fa-scroll"></i></div>
				<h2 class="m-stat-card-title">Quests</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">Quests enrolled</p>
				<p class="m-overview-hero-value">{fmt(liveStats.quests_enrolled)}</p>
			</div>
			<div class="m-bar-block">
				<div class="m-bar-head">
					<span>Rewards claimed</span>
					<span class="m-bar-meta">{questClaimPct.toFixed(0)}%</span>
				</div>
				<div class="m-level-meter-track">
					<div class="m-level-meter-fill m-level-meter-fill--avg" style="width: {Math.max(4, questClaimPct)}%"></div>
				</div>
			</div>
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-award"></i>
					<span class="m-mini-value">{fmt(liveStats.quests_claimed)}</span>
					<span class="m-mini-label">Rewards claimed</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-users"></i>
					<span class="m-mini-value">{fmt(liveStats.quests_participants)}</span>
					<span class="m-mini-label">Participants</span>
				</div>
			</div>
		</div>
	{/if}

	{#if hasStaffFeedback}
		<div class="m-stat-card m-overview-card">
			<div class="m-stat-card-head">
				<div class="m-stat-card-icon m-chili-stat-2"><i class="fas fa-shield-halved"></i></div>
				<h2 class="m-stat-card-title">Staff &amp; feedback</h2>
			</div>
			<div class="m-overview-hero">
				<p class="m-overview-hero-label">Staff reviews</p>
				<p class="m-overview-hero-value">{fmt(liveStats.staff_reviews)}</p>
			</div>
			{#if liveStats.staff_reviews > 0}
				<div class="m-bar-block">
					<div class="m-bar-head">
						<span>Average staff rating</span>
						<span class="m-bar-meta">{liveStats.staff_avg_rating || '—'} / 5</span>
					</div>
					<div class="m-level-meter-track">
						<div class="m-level-meter-fill m-level-meter-fill--avg" style="width: {Math.max(4, staffRatingPct)}%"></div>
					</div>
				</div>
			{/if}
			<div class="m-mini-grid">
				<div class="m-mini">
					<i class="fas fa-comment-dots"></i>
					<span class="m-mini-value">{fmt(liveStats.feedback_submissions)}</span>
					<span class="m-mini-label">Feedback</span>
				</div>
				<div class="m-mini">
					<i class="fas fa-moon"></i>
					<span class="m-mini-value">{fmt(liveStats.afk_active)}</span>
					<span class="m-mini-label">AFK now</span>
				</div>
			</div>
		</div>
	{/if}
</div>
