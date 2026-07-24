<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import type { PageProps } from './$types';
	import type { PublicPageStats } from '$lib/frontend/public/statistics/index.js';

	let { data }: PageProps = $props();

	let liveStats = $state<PublicPageStats>({ ...data.stats });
	let liveBoost = $state(data.boost_level);
	let es: EventSource | null = null;

	let mounted = $state(false);
	const grow = $derived(mounted ? 1 : 0);

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
		if (t <= 0) return { inPct: 0, outPct: 0 };
		return { inPct: (inn / t) * 100, outPct: (out / t) * 100 };
	});

	const marketProfit = $derived(Number(liveStats.assets_realized_net) || 0);
	const marketUnrealized = $derived(Number(liveStats.assets_unrealized_net) || 0);

	const heistMix = $derived.by(() => {
		const landed = Math.max(0, Number(liveStats.items_steals_landed) || 0);
		const caught = Math.max(0, Number(liveStats.items_steals_caught) || 0);
		const t = landed + caught;
		if (t <= 0) return { landedPct: 0, caughtPct: 0 };
		return { landedPct: (landed / t) * 100, caughtPct: (caught / t) * 100 };
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
		if (t <= 0) return { likePct: 0, chatPct: 0, giftPct: 0, sharePct: 0 };
		return { likePct: (likes / t) * 100, chatPct: (chat / t) * 100, giftPct: (gifts / t) * 100, sharePct: (shares / t) * 100 };
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
		if (t <= 0) return { activePct: 0, afkPct: 0 };
		return { activePct: (a / t) * 100, afkPct: (k / t) * 100 };
	});

	const membersLevelShare = $derived.by(() => {
		const total = Math.max(0, Number(liveStats.members_total) || 0);
		const withL = Math.max(0, Number(liveStats.members_with_levels) || 0);
		if (total <= 0) return { withPct: 0, withoutPct: 0 };
		const withPct = (withL / total) * 100;
		return { withPct, withoutPct: 100 - withPct };
	});

	const channelMix = $derived.by(() => {
		const t = Math.max(0, Number(liveStats.channels_total) || 0);
		const text = Math.max(0, Number(liveStats.channels_text) || 0);
		const voice = Math.max(0, Number(liveStats.channels_voice) || 0);
		const other = Math.max(0, (Number(liveStats.channels_announcement) || 0) + (Number(liveStats.channels_stage) || 0));
		if (t <= 0) return { textPct: 0, voicePct: 0, otherPct: 0 };
		return {
			textPct: (text / t) * 100,
			voicePct: (voice / t) * 100,
			otherPct: (other / t) * 100
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
			lastXpForHero = t;
			const reduce = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
			if (reduce) heroXpDisplay = t;
			else animateHeroXp(t);
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
		const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		if (reduce) mounted = true;
		else requestAnimationFrame(() => requestAnimationFrame(() => (mounted = true)));

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

<div class="m-leaderboard-subhead m-stats-subhead mb-4">
	<p>Statistics</p>
</div>

<section class="m-overview-strip mb-5 flex gap-2 overflow-x-auto px-0.5 pt-1 pb-2" class:m-overview-strip--in={mounted} aria-label="Key metrics">
	{#each [{ icon: 'fa-users', label: 'Members', value: fmt(liveStats.members_total) }, { icon: 'fa-hashtag', label: 'Channels', value: fmt(liveStats.channels_total) }, { icon: 'fa-star', label: 'Total XP', value: heroXpDisplay.toLocaleString() }, { icon: 'fa-microphone', label: 'Voice min', value: fmt(liveStats.leveling_total_voice_minutes) }, { icon: 'fa-user-tag', label: 'Roles', value: fmt(liveStats.roles_total) }] as chip}
		<div class="m-overview-strip-item flex max-w-full min-w-33 flex-none items-center gap-3 rounded-2xl px-4 py-3">
			<div class="m-overview-strip-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base text-white">
				<i class="fas {chip.icon}"></i>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="m-overview-strip-value text-lb-text min-w-0 text-base font-extrabold tabular-nums">{chip.value}</span>
				<span class="text-lb-text/52 text-xs font-semibold uppercase">{chip.label}</span>
			</div>
		</div>
	{/each}
</section>

<div class="m-stats-grid gap-5" class:m-stats-grid--in={mounted}>
	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-users"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Members</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Community size</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.members_total)}</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Leveling coverage</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{fmt(liveStats.members_with_levels)} with levels</span>
			</div>
			<div class="m-seg-bar flex h-2 overflow-hidden rounded-full" title="Share of members with leveling data">
				<div class="m-seg m-seg--a h-full min-w-0" style="width: {membersLevelShare.withPct * grow}%"></div>
				<div class="m-seg m-seg--b h-full min-w-0" style="width: {membersLevelShare.withoutPct * grow}%"></div>
			</div>
			<div class="m-legend text-lb-text-subtle mt-2 flex flex-wrap gap-x-4 gap-y-3 text-xs font-semibold">
				<span><i class="fas fa-circle"></i> With levels</span>
				<span><i class="fas fa-circle"></i> Without</span>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-chart-line"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.members_with_levels)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">With levels</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-gift"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(boostersCount)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Boosting</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-moon"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.member_afk)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Active AFK</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-user-slash"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(membersWithoutLevels)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">No levels</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-hashtag"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Channels</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Server layout</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.channels_total)}</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Mix</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">Text · Voice · Other</span>
			</div>
			<div class="m-seg-bar flex h-2 overflow-hidden rounded-full" title="Channel types">
				<div class="m-seg m-seg--text h-full min-w-0" style="width: {channelMix.textPct * grow}%"></div>
				<div class="m-seg m-seg--voice h-full min-w-0" style="width: {channelMix.voicePct * grow}%"></div>
				<div class="m-seg m-seg--other h-full min-w-0" style="width: {channelMix.otherPct * grow}%"></div>
			</div>
			<div class="m-legend text-lb-text-subtle mt-2 flex flex-wrap gap-x-4 gap-y-3 text-xs font-semibold">
				<span><i class="fas fa-circle"></i> Text {fmt(liveStats.channels_text)}</span>
				<span><i class="fas fa-circle"></i> Voice {fmt(liveStats.channels_voice)}</span>
				<span><i class="fas fa-circle"></i> Ann. / stage {fmt(channelsOtherTotal)}</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-star"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Leveling</h2>
		</div>

		<div class="m-leveling-hero -mx-1 mt-0 mb-2 rounded-2xl px-3 pt-4 pb-5 text-center">
			<p class="text-chili-hot/75 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Total experience</p>
			<p class="m-leveling-hero-value text-2xl font-extrabold text-transparent tabular-nums lg:text-3xl">{heroXpDisplay.toLocaleString()}</p>
			<p class="text-lb-text-subtle mx-0 mt-2 mb-0 text-base">
				Wallet + XP invested in assets · {fmt(liveStats.leveling_wallet_experience)} wallet + {fmt(liveStats.leveling_assets_value)} in market
			</p>
		</div>

		<div class="mb-4 flex flex-col gap-4">
			<div class="m-level-meter">
				<div class="mb-2 flex items-baseline justify-between gap-2">
					<span class="text-lb-text-muted text-base font-semibold">Average vs peak level</span>
					<span class="text-chili-hot/92 text-base font-bold tabular-nums">{fmtDec(liveStats.leveling_avg_level)} / {fmt(liveStats.leveling_max_level)}</span>
				</div>
				<div class="m-level-meter-track h-2 overflow-hidden rounded-full">
					<div class="m-level-meter-fill m-level-meter-fill--avg h-full rounded-full" style="width: {avgLevelBarPct * grow}%"></div>
				</div>
			</div>
		</div>

		<div class="m-leveling-tiles gap-2">
			<div class="m-level-tile flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-comments"></i>
				<span class="text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_total_chat)}</span>
				<span class="text-lb-text-faint text-xs font-semibold uppercase">Messages</span>
			</div>
			<div class="m-level-tile flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-chart-line"></i>
				<span class="text-lb-text text-base font-extrabold tabular-nums">{avgXP}</span>
				<span class="text-lb-text-faint text-xs font-semibold uppercase">Avg XP / member</span>
			</div>
			<div class="m-level-tile flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-crown"></i>
				<span class="text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_max_level)}</span>
				<span class="text-lb-text-faint text-xs font-semibold uppercase">Highest level</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-user-tag"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Roles &amp; structure</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Role catalog</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.roles_total)}</p>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-rocket"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(boostLevel)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Boost tier</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-gift"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.members_boosters)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Boosts</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-folder"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.categories_total)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Categories</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-user-cog"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.members_with_custom_roles)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Custom roles</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-microphone-alt"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Voice activity</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Tracked minutes</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.leveling_total_voice_minutes)}</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Active vs AFK</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums"
					>{fmt(liveStats.leveling_total_voice_active)} · {fmt(liveStats.leveling_total_voice_afk)}</span
				>
			</div>
			<div class="m-level-meter-stack flex h-2 overflow-hidden rounded-full" title="Share of voice minutes">
				<div class="m-level-meter-stack-active h-full" style="width: {voiceMix.activePct * grow}%"></div>
				<div class="m-level-meter-stack-afk h-full" style="width: {voiceMix.afkPct * grow}%"></div>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-check-circle"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_total_voice_active)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Active min</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-chart-line"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{avgVoiceMinutes}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Avg / member</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-chart-bar"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{avgVoiceActive}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Avg active</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-pause-circle"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_total_voice_afk)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">AFK min</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-video"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_total_voice_video)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Video min</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-desktop"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.leveling_total_voice_streaming)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Stream min</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-chart-line"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Market</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">XP in the market</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.assets_market_value)}</p>
			<p
				class="m-hero-trend text-lb-text-muted mx-0 mt-2 mb-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums"
				class:m-hero-trend--up={marketUnrealized >= 0}
				class:m-hero-trend--down={marketUnrealized < 0}
			>
				<i class="fas {marketUnrealized >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
				{marketUnrealized >= 0 ? '+' : '−'}{fmt(Math.abs(marketUnrealized))} XP unrealized P/L
			</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Capital flow</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">In · Out</span>
			</div>
			<div class="m-seg-bar flex h-2 overflow-hidden rounded-full" title="XP bought in vs cashed out">
				<div class="m-seg m-seg--a h-full min-w-0" style="width: {marketFlow.inPct * grow}%"></div>
				<div class="m-seg m-seg--b h-full min-w-0" style="width: {marketFlow.outPct * grow}%"></div>
			</div>
			<div class="m-legend text-lb-text-subtle mt-2 flex flex-wrap gap-x-4 gap-y-3 text-xs font-semibold">
				<span><i class="fas fa-circle"></i> Bought in {fmt(liveStats.assets_buy_volume)}</span>
				<span><i class="fas fa-circle"></i> Cashed out {fmt(liveStats.assets_sell_volume)}</span>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-right-left"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.assets_trade_count)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Trades</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-users"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.assets_traders)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Traders</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-briefcase"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.assets_open_positions)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Open assets</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-arrow-up-from-bracket"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.assets_buy_volume)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">XP bought in</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-download"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.assets_sell_volume)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">XP cashed out</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center" data-dir={marketProfit >= 0 ? 'up' : 'down'}>
				<i class="fas fa-scale-balanced"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{marketProfit >= 0 ? '+' : '−'}{fmt(Math.abs(marketProfit))}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Realized P/L</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-bag-shopping"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Items</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Items bought</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.items_buys)}</p>
			<p class="text-lb-text-muted mx-0 mt-2 mb-0 text-xs font-semibold tabular-nums">
				{fmt(liveStats.items_buy_spend)} XP spent across {fmt(liveStats.items_distinct_bought)} unique items
			</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Heist outcomes</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{stealHitRate}% success</span>
			</div>
			<div class="m-seg-bar flex h-2 overflow-hidden rounded-full" title="Successful steals vs caught">
				<div class="m-seg m-seg--a h-full min-w-0" style="width: {heistMix.landedPct * grow}%"></div>
				<div class="m-seg m-seg--b h-full min-w-0" style="width: {heistMix.caughtPct * grow}%"></div>
			</div>
			<div class="m-legend text-lb-text-subtle mt-2 flex flex-wrap gap-x-4 gap-y-3 text-xs font-semibold">
				<span><i class="fas fa-circle"></i> Landed {fmt(liveStats.items_steals_landed)}</span>
				<span><i class="fas fa-circle"></i> Caught {fmt(liveStats.items_steals_caught)}</span>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-wand-magic-sparkles"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_activations)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Activations</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-hand"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_stolen)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">XP stolen</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-bomb"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_bombed)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">XP bombed</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-gift"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_gifted)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">XP gifted</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-magnifying-glass"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_spies)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Spy reports</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-crown"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.items_bounties_placed)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Bounties set</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"><i class="fas fa-dice"></i></div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Minigames</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">XP wagered</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.minigames_wagered)}</p>
			<p class="text-lb-text-muted mx-0 mt-2 mb-0 text-xs font-semibold tabular-nums">
				{fmt(liveStats.minigames_plays)} plays · {fmt(liveStats.minigames_paid_out)} XP paid out
			</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Player win rate</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{minigamesWinRate}%</span>
			</div>
			<div class="m-level-meter-track h-2 overflow-hidden rounded-full">
				<div class="m-level-meter-fill m-level-meter-fill--avg h-full rounded-full" style="width: {Math.max(4, minigamesWinRate) * grow}%"></div>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-trophy"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.minigames_biggest_win)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Biggest win</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-scale-balanced"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums"
					>{liveStats.minigames_net <= 0 ? '+' : '−'}{fmt(Math.abs(liveStats.minigames_net))}</span
				>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">House edge</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"><i class="fas fa-gift"></i></div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Giveaways</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Giveaways hosted</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.giveaways_total)}</p>
			<p class="text-lb-text-muted mx-0 mt-2 mb-0 text-xs font-semibold tabular-nums">
				{fmt(liveStats.giveaways_entries)} entries from {fmt(liveStats.giveaways_entrants)} members
			</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Odds of winning</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{giveawayClaimPct.toFixed(1)}%</span>
			</div>
			<div class="m-level-meter-track h-2 overflow-hidden rounded-full">
				<div class="m-level-meter-fill m-level-meter-fill--avg h-full rounded-full" style="width: {Math.max(4, giveawayClaimPct) * grow}%"></div>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-medal"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.giveaways_winners)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Winners drawn</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-hourglass-half"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.giveaways_active)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Running now</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-tower-broadcast"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Content creators</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Streams broadcast</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.streams_total)}</p>
			<p class="text-lb-text-muted mx-0 mt-2 mb-0 text-xs font-semibold tabular-nums">
				{fmt(liveStats.streams_creators)} creators · {fmt(liveStats.streams_peak_viewers)} peak viewers
			</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Engagement mix</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">Likes · Chat · Gifts · Shares</span>
			</div>
			<div class="m-seg-bar flex h-2 overflow-hidden rounded-full" title="Stream engagement breakdown">
				<div class="m-seg m-seg--text h-full min-w-0" style="width: {streamEngage.likePct * grow}%"></div>
				<div class="m-seg m-seg--voice h-full min-w-0" style="width: {streamEngage.chatPct * grow}%"></div>
				<div class="m-seg m-seg--other h-full min-w-0" style="width: {streamEngage.giftPct * grow}%"></div>
				<div class="m-seg m-seg--b h-full min-w-0" style="width: {streamEngage.sharePct * grow}%"></div>
			</div>
			<div class="m-legend text-lb-text-subtle mt-2 flex flex-wrap gap-x-4 gap-y-3 text-xs font-semibold">
				<span><i class="fas fa-circle"></i> Likes {fmt(liveStats.streams_likes)}</span>
				<span><i class="fas fa-circle"></i> Chat {fmt(liveStats.streams_chat_messages)}</span>
				<span><i class="fas fa-circle"></i> Gifts {fmt(liveStats.streams_gifts)}</span>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-user-plus"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.streams_follows)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Follows</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-share-nodes"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.streams_shares)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Shares</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-user-group"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.streams_unique_chatters)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Chatters</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-scroll"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Quests</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Quests enrolled</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.quests_enrolled)}</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Rewards claimed</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{questClaimPct.toFixed(0)}%</span>
			</div>
			<div class="m-level-meter-track h-2 overflow-hidden rounded-full">
				<div class="m-level-meter-fill m-level-meter-fill--avg h-full rounded-full" style="width: {Math.max(4, questClaimPct) * grow}%"></div>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-award"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.quests_claimed)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Rewards claimed</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-users"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.quests_participants)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Participants</span>
			</div>
		</div>
	</div>

	<div class="m-stat-card m-overview-card rounded-2xl px-4 py-4">
		<div class="m-stat-card-head mb-4 flex items-center gap-3">
			<div class="m-stat-card-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg">
				<i class="fas fa-shield-halved"></i>
			</div>
			<h2 class="m-stat-card-title text-lb-text text-base font-bold">Staff &amp; feedback</h2>
		</div>
		<div class="m-overview-hero mb-1 rounded-2xl px-3 pt-4 pb-4 text-center">
			<p class="text-chili-hot/72 mx-0 mt-0 mb-1 text-xs font-semibold uppercase">Staff reviews</p>
			<p class="m-overview-hero-value text-lb-text text-2xl font-extrabold tabular-nums lg:text-3xl">{fmt(liveStats.staff_reviews)}</p>
		</div>
		<div class="m-bar-block mt-4">
			<div class="m-bar-head text-lb-text-muted mb-2 flex items-baseline justify-between gap-2 text-base font-semibold">
				<span>Average staff rating</span>
				<span class="m-bar-meta text-chili-hot/88 text-xs font-bold tabular-nums">{liveStats.staff_avg_rating || '—'} / 5</span>
			</div>
			<div class="m-level-meter-track h-2 overflow-hidden rounded-full">
				<div class="m-level-meter-fill m-level-meter-fill--avg h-full rounded-full" style="width: {Math.max(4, staffRatingPct) * grow}%"></div>
			</div>
		</div>
		<div class="m-mini-grid mt-4 gap-2">
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-comment-dots"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.feedback_submissions)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">Feedback</span>
			</div>
			<div class="m-mini flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center">
				<i class="fas fa-moon"></i>
				<span class="m-mini-value text-lb-text text-base font-extrabold tabular-nums">{fmt(liveStats.afk_active)}</span>
				<span class="m-mini-label text-lb-text-subtle text-xs font-semibold uppercase">AFK now</span>
			</div>
		</div>
	</div>
</div>
