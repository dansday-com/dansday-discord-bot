<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onDestroy, onMount } from 'svelte';
	import {
		DashGrid,
		FILL,
		MeterBar,
		MiniGrid,
		MiniStat,
		SegBar,
		StatCard,
		StatHero,
		StatStrip,
		TrendChip,
		growOnMount,
		prefersReducedMotion
	} from '$lib/frontend/components/dash';
	import type { PageProps } from './$types';
	import type { PublicPageStats } from '$lib/frontend/public/statistics/index.js';

	let { data }: PageProps = $props();

	let liveStats = $state<PublicPageStats>({ ...data.stats });
	let liveBoost = $state(data.boost_level);
	let es: EventSource | null = null;

	const growth = growOnMount();
	const grow = $derived(growth.value);

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
		(liveStats.members_with_levels ?? 0) > 0 ? Math.round((liveStats.leveling_total_xp ?? 0) / Number(liveStats.members_with_levels)).toLocaleString() : '0'
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

	function split(parts: number[]): number[] {
		const clean = parts.map((p) => Math.max(0, Number(p) || 0));
		const total = clean.reduce((s, x) => s + x, 0);
		if (total <= 0) return clean.map(() => 0);
		return clean.map((p) => (p / total) * 100);
	}

	const marketProfit = $derived(Number(liveStats.assets_realized_net) || 0);
	const marketUnrealized = $derived(Number(liveStats.assets_unrealized_net) || 0);

	const giveawayClaimPct = $derived(pct(liveStats.giveaways_winners, liveStats.giveaways_entrants));
	const questClaimPct = $derived(pct(liveStats.quests_claimed, liveStats.quests_enrolled));
	const staffRatingPct = $derived(pct(liveStats.staff_avg_rating, 5));

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

	const boostersCount = $derived(Number(liveStats.members_unique_boosters ?? liveStats.members_boosters) || 0);
	const channelsOtherTotal = $derived((Number(liveStats.channels_announcement) || 0) + (Number(liveStats.channels_stage) || 0));

	const memberSplit = $derived(split([liveStats.members_with_levels ?? 0, membersWithoutLevels]));
	const channelSplit = $derived([
		pct(liveStats.channels_text, liveStats.channels_total),
		pct(liveStats.channels_voice, liveStats.channels_total),
		pct(channelsOtherTotal, liveStats.channels_total)
	]);
	const voiceSplit = $derived(split([liveStats.leveling_total_voice_active ?? 0, liveStats.leveling_total_voice_afk ?? 0]));
	const marketSplit = $derived(split([liveStats.assets_buy_volume ?? 0, liveStats.assets_sell_volume ?? 0]));
	const heistSplit = $derived(split([liveStats.items_steals_landed ?? 0, liveStats.items_steals_caught ?? 0]));
	const streamSplit = $derived(
		split([liveStats.streams_likes ?? 0, liveStats.streams_chat_messages ?? 0, liveStats.streams_gifts ?? 0, liveStats.streams_shares ?? 0])
	);

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
		const t = Number(liveStats.leveling_total_xp) || 0;
		if (lastXpForHero === null) {
			lastXpForHero = t;
			if (prefersReducedMotion()) heroXpDisplay = t;
			else animateHeroXp(t);
			return;
		}
		if (t !== lastXpForHero) {
			lastXpForHero = t;
			animateHeroXp(t);
		}
	});

	const strip = $derived([
		{ icon: 'fa-users', label: 'Members', value: fmt(liveStats.members_total) },
		{ icon: 'fa-hashtag', label: 'Channels', value: fmt(liveStats.channels_total) },
		{ icon: 'fa-star', label: 'Total XP', value: heroXpDisplay.toLocaleString() },
		{ icon: 'fa-microphone', label: 'Voice min', value: fmt(liveStats.leveling_total_voice_minutes) },
		{ icon: 'fa-user-tag', label: 'Roles', value: fmt(liveStats.roles_total) }
	]);

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
	<meta name="theme-color" content="#e43d12" />
	<meta property="og:title" content="{data.server.name || data.server.slug} Statistics | {APP_NAME} Discord Bot" />
	<meta property="og:description" content="Members, channels, leveling, and voice activity for this community." />
</svelte:head>

<div class="text-base-content/60 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
	<p class="m-0 flex flex-wrap items-center gap-1.5">Statistics</p>
</div>

<div class="mb-3 sm:mb-4 lg:mb-5">
	<StatStrip items={strip} />
</div>

<DashGrid>
	<StatCard icon="fa-users" title="Members" tone="sky">
		<StatHero label="Community size" value={fmt(liveStats.members_total)} />
		<SegBar
			head="Leveling coverage"
			meta="{fmt(liveStats.members_with_levels)} with levels"
			title="Share of members with leveling data"
			{grow}
			segments={[
				{ label: 'With levels', pct: memberSplit[0], color: FILL.primary },
				{ label: 'Without', pct: memberSplit[1], color: FILL.muted }
			]}
		/>
		<MiniGrid cols={2}>
			<MiniStat icon="fa-chart-line" value={fmt(liveStats.members_with_levels)} label="With levels" />
			<MiniStat icon="fa-gift" value={fmt(boostersCount)} label="Boosting" />
			<MiniStat icon="fa-moon" value={fmt(liveStats.member_afk)} label="Active AFK" />
			<MiniStat icon="fa-user-slash" value={fmt(membersWithoutLevels)} label="No levels" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-hashtag" title="Channels" tone="violet">
		<StatHero label="Server layout" value={fmt(liveStats.channels_total)} />
		<SegBar
			head="Mix"
			meta="Text · Voice · Other"
			title="Channel types"
			{grow}
			segments={[
				{ label: `Text ${fmt(liveStats.channels_text)}`, pct: channelSplit[0], color: FILL.primary },
				{ label: `Voice ${fmt(liveStats.channels_voice)}`, pct: channelSplit[1], color: FILL.accent },
				{ label: `Ann. / stage ${fmt(channelsOtherTotal)}`, pct: channelSplit[2], color: FILL.neutral }
			]}
		/>
	</StatCard>

	<StatCard icon="fa-star" title="Leveling" tone="amber">
		<StatHero
			label="Total XP"
			value={heroXpDisplay.toLocaleString()}
			hint="Wallet + XP invested in assets · {fmt(liveStats.leveling_wallet_xp)} wallet + {fmt(liveStats.leveling_assets_value)} in market"
		/>
		<MeterBar head="Average vs peak level" meta="{fmtDec(liveStats.leveling_avg_level)} / {fmt(liveStats.leveling_max_level)}" pct={avgLevelBarPct} {grow} />
		<MiniGrid cols={3}>
			<MiniStat icon="fa-comments" value={fmt(liveStats.leveling_total_chat)} label="Messages" />
			<MiniStat icon="fa-chart-line" value={avgXP} label="Avg XP / member" />
			<MiniStat icon="fa-crown" value={fmt(liveStats.leveling_max_level)} label="Highest level" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-user-tag" title="Roles & structure" tone="emerald">
		<StatHero label="Role catalog" value={fmt(liveStats.roles_total)} />
		<MiniGrid cols={2}>
			<MiniStat icon="fa-rocket" value={fmt(boostLevel)} label="Boost tier" />
			<MiniStat icon="fa-gift" value={fmt(liveStats.members_boosters)} label="Boosts" />
			<MiniStat icon="fa-folder" value={fmt(liveStats.categories_total)} label="Categories" />
			<MiniStat icon="fa-user-cog" value={fmt(liveStats.members_with_custom_roles)} label="Custom roles" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-microphone-alt" title="Voice activity" tone="lime">
		<StatHero label="Tracked minutes" value={fmt(liveStats.leveling_total_voice_minutes)} />
		<SegBar
			head="Active vs AFK"
			meta="{fmt(liveStats.leveling_total_voice_active)} · {fmt(liveStats.leveling_total_voice_afk)}"
			title="Share of voice minutes"
			{grow}
			segments={[
				{ label: 'Active', pct: voiceSplit[0], color: FILL.accent },
				{ label: 'AFK', pct: voiceSplit[1], color: FILL.neutral }
			]}
		/>
		<MiniGrid cols={3}>
			<MiniStat icon="fa-check-circle" value={fmt(liveStats.leveling_total_voice_active)} label="Active min" />
			<MiniStat icon="fa-chart-line" value={avgVoiceMinutes} label="Avg / member" />
			<MiniStat icon="fa-chart-bar" value={avgVoiceActive} label="Avg active" />
			<MiniStat icon="fa-pause-circle" value={fmt(liveStats.leveling_total_voice_afk)} label="AFK min" />
			<MiniStat icon="fa-video" value={fmt(liveStats.leveling_total_voice_video)} label="Video min" />
			<MiniStat icon="fa-desktop" value={fmt(liveStats.leveling_total_voice_streaming)} label="Stream min" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-chart-line" title="Market" tone="teal">
		<StatHero label="XP in the market" value={fmt(liveStats.assets_market_value)}>
			{#snippet trailing()}
				<TrendChip value={marketUnrealized} text="{marketUnrealized >= 0 ? '+' : '−'}{fmt(Math.abs(marketUnrealized))}" label="XP unrealized P/L" />
			{/snippet}
		</StatHero>
		<SegBar
			head="Capital flow"
			meta="In · Out"
			title="XP bought in vs cashed out"
			{grow}
			segments={[
				{ label: `Bought in ${fmt(liveStats.assets_buy_volume)}`, pct: marketSplit[0], color: FILL.primary },
				{ label: `Cashed out ${fmt(liveStats.assets_sell_volume)}`, pct: marketSplit[1], color: FILL.muted }
			]}
		/>
		<MiniGrid cols={3}>
			<MiniStat icon="fa-right-left" value={fmt(liveStats.assets_trade_count)} label="Trades" />
			<MiniStat icon="fa-users" value={fmt(liveStats.assets_traders)} label="Traders" />
			<MiniStat icon="fa-briefcase" value={fmt(liveStats.assets_open_positions)} label="Open assets" />
			<MiniStat icon="fa-arrow-up-from-bracket" value={fmt(liveStats.assets_buy_volume)} label="XP bought in" />
			<MiniStat icon="fa-download" value={fmt(liveStats.assets_sell_volume)} label="XP cashed out" />
			<MiniStat
				icon="fa-scale-balanced"
				value="{marketProfit >= 0 ? '+' : '−'}{fmt(Math.abs(marketProfit))}"
				label="Realized P/L"
				dir={marketProfit >= 0 ? 'up' : 'down'}
			/>
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-bag-shopping" title="Items" tone="orange">
		<StatHero
			label="Items bought"
			value={fmt(liveStats.items_buys)}
			hint="{fmt(liveStats.items_buy_spend)} XP spent across {fmt(liveStats.items_distinct_bought)} unique items"
		/>
		<SegBar
			head="Heist outcomes"
			meta="{stealHitRate}% success"
			title="Successful steals vs caught"
			{grow}
			segments={[
				{ label: `Landed ${fmt(liveStats.items_steals_landed)}`, pct: heistSplit[0], color: FILL.primary },
				{ label: `Caught ${fmt(liveStats.items_steals_caught)}`, pct: heistSplit[1], color: FILL.muted }
			]}
		/>
		<MiniGrid cols={3}>
			<MiniStat icon="fa-wand-magic-sparkles" value={fmt(liveStats.items_activations)} label="Activations" />
			<MiniStat icon="fa-hand" value={fmt(liveStats.items_stolen)} label="XP stolen" />
			<MiniStat icon="fa-bomb" value={fmt(liveStats.items_bombed)} label="XP bombed" />
			<MiniStat icon="fa-gift" value={fmt(liveStats.items_gifted)} label="XP gifted" />
			<MiniStat icon="fa-magnifying-glass" value={fmt(liveStats.items_spies)} label="Spy reports" />
			<MiniStat icon="fa-crown" value={fmt(liveStats.items_bounties_placed)} label="Bounties set" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-dice" title="Minigames" tone="pink">
		<StatHero
			label="XP wagered"
			value={fmt(liveStats.minigames_wagered)}
			hint="{fmt(liveStats.minigames_plays)} plays · {fmt(liveStats.minigames_paid_out)} XP paid out"
		/>
		<MeterBar head="Player win rate" meta="{minigamesWinRate}%" pct={Math.max(4, minigamesWinRate)} {grow} />
		<MiniGrid cols={2}>
			<MiniStat icon="fa-trophy" value={fmt(liveStats.minigames_biggest_win)} label="Biggest win" />
			<MiniStat icon="fa-scale-balanced" value="{liveStats.minigames_net <= 0 ? '+' : '−'}{fmt(Math.abs(liveStats.minigames_net))}" label="House edge" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-gift" title="Giveaways" tone="rose">
		<StatHero
			label="Giveaways hosted"
			value={fmt(liveStats.giveaways_total)}
			hint="{fmt(liveStats.giveaways_entries)} entries from {fmt(liveStats.giveaways_entrants)} members"
		/>
		<MeterBar head="Odds of winning" meta="{giveawayClaimPct.toFixed(1)}%" pct={Math.max(4, giveawayClaimPct)} {grow} />
		<MiniGrid cols={2}>
			<MiniStat icon="fa-medal" value={fmt(liveStats.giveaways_winners)} label="Winners drawn" />
			<MiniStat icon="fa-hourglass-half" value={fmt(liveStats.giveaways_active)} label="Running now" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-tower-broadcast" title="Content creators" tone="cyan">
		<StatHero
			label="Streams broadcast"
			value={fmt(liveStats.streams_total)}
			hint="{fmt(liveStats.streams_creators)} creators · {fmt(liveStats.streams_peak_viewers)} peak viewers"
		/>
		<SegBar
			head="Engagement mix"
			meta="Likes · Chat · Gifts · Shares"
			title="Stream engagement breakdown"
			{grow}
			segments={[
				{ label: `Likes ${fmt(liveStats.streams_likes)}`, pct: streamSplit[0], color: FILL.primary },
				{ label: `Chat ${fmt(liveStats.streams_chat_messages)}`, pct: streamSplit[1], color: FILL.accent },
				{ label: `Gifts ${fmt(liveStats.streams_gifts)}`, pct: streamSplit[2], color: FILL.neutral },
				{ label: `Shares ${fmt(liveStats.streams_shares)}`, pct: streamSplit[3], color: FILL.muted }
			]}
		/>
		<MiniGrid cols={3}>
			<MiniStat icon="fa-user-plus" value={fmt(liveStats.streams_follows)} label="Follows" />
			<MiniStat icon="fa-share-nodes" value={fmt(liveStats.streams_shares)} label="Shares" />
			<MiniStat icon="fa-user-group" value={fmt(liveStats.streams_unique_chatters)} label="Chatters" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-scroll" title="Quests" tone="sky">
		<StatHero label="Quests enrolled" value={fmt(liveStats.quests_enrolled)} />
		<MeterBar head="Rewards claimed" meta="{questClaimPct.toFixed(0)}%" pct={Math.max(4, questClaimPct)} {grow} />
		<MiniGrid cols={2}>
			<MiniStat icon="fa-award" value={fmt(liveStats.quests_claimed)} label="Rewards claimed" />
			<MiniStat icon="fa-users" value={fmt(liveStats.quests_participants)} label="Participants" />
		</MiniGrid>
	</StatCard>

	<StatCard icon="fa-shield-halved" title="Staff & feedback" tone="violet">
		<StatHero label="Staff reviews" value={fmt(liveStats.staff_reviews)} />
		<MeterBar head="Average staff rating" meta="{liveStats.staff_avg_rating || '—'} / 5" pct={Math.max(4, staffRatingPct)} {grow} />
		<MiniGrid cols={2}>
			<MiniStat icon="fa-comment-dots" value={fmt(liveStats.feedback_submissions)} label="Feedback" />
			<MiniStat icon="fa-moon" value={fmt(liveStats.afk_active)} label="AFK now" />
		</MiniGrid>
	</StatCard>
</DashGrid>
