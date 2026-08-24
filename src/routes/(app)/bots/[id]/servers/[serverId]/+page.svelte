<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { DashGrid, RowStat, StatCard, type Tone } from '$lib/frontend/components/dash';
	import type { LayoutProps } from './$types';

	let { data }: LayoutProps = $props();

	const o = $derived(data.overview);
	const s = $derived(o.stats ?? {});
	const sync = $derived(o.sync ?? {});
	const enabledFeatures = $derived(Array.isArray(o.enabledFeatures) ? o.enabledFeatures : []);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '0';
		return val.toLocaleString();
	}

	function fmtDec(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toFixed(2);
	}

	const membersWithoutLevels = $derived(Math.max(0, (s.members_total ?? 0) - (s.members_with_levels ?? 0)));

	const avgXP = $derived((s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_xp ?? 0) / s.members_with_levels).toLocaleString() : '0');
	const minigamesWinRate = $derived((s.minigames_plays ?? 0) > 0 ? Math.round((Number(s.minigames_wins) / Number(s.minigames_plays)) * 100) : 0);

	const avgVoiceMinutes = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_minutes ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);

	const avgVoiceActive = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_active ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);

	const cards: { title: string; icon: string; tone: Tone; rows: { icon: string; label: string; value: string }[] }[] = $derived([
		{
			title: 'Members',
			icon: 'fa-users',
			tone: 'sky',
			rows: [
				{ icon: 'fa-user-friends', label: 'Total', value: fmt(s.members_total) },
				{ icon: 'fa-chart-line', label: 'With levels', value: fmt(s.members_with_levels) },
				{ icon: 'fa-gift', label: 'Boosting', value: fmt(s.members_unique_boosters ?? s.members_boosters) },
				{ icon: 'fa-moon', label: 'Active AFK', value: fmt(s.member_afk) },
				{ icon: 'fa-user-slash', label: 'Without levels', value: fmt(membersWithoutLevels) }
			]
		},
		{
			title: 'Channels',
			icon: 'fa-hashtag',
			tone: 'violet',
			rows: [
				{ icon: 'fa-list', label: 'Total', value: fmt(s.channels_total) },
				{ icon: 'fa-comment', label: 'Text', value: fmt(s.channels_text) },
				{ icon: 'fa-microphone', label: 'Voice', value: fmt(s.channels_voice) },
				{ icon: 'fa-bullhorn', label: 'Announcement', value: fmt(s.channels_announcement) },
				{ icon: 'fa-video', label: 'Stage', value: fmt(s.channels_stage) }
			]
		},
		{
			title: 'Leveling',
			icon: 'fa-trophy',
			tone: 'amber',
			rows: [
				{ icon: 'fa-star', label: 'Total XP', value: fmt(s.leveling_total_xp) },
				{ icon: 'fa-chart-bar', label: 'Avg level', value: fmtDec(s.leveling_avg_level) },
				{ icon: 'fa-crown', label: 'Max level', value: fmt(s.leveling_max_level) },
				{ icon: 'fa-chart-line', label: 'Avg XP', value: avgXP },
				{ icon: 'fa-comments', label: 'Total chat', value: fmt(s.leveling_total_chat) }
			]
		},
		{
			title: 'Roles & structure',
			icon: 'fa-user-tag',
			tone: 'emerald',
			rows: [
				{ icon: 'fa-shield-alt', label: 'Total roles', value: fmt(s.roles_total) },
				{ icon: 'fa-rocket', label: 'Boost level', value: fmt(o.boost_level ?? s.boost_level) },
				{ icon: 'fa-gift', label: 'Total boosts', value: fmt(s.members_boosters) },
				{ icon: 'fa-folder', label: 'Categories', value: fmt(s.categories_total) },
				{ icon: 'fa-user-cog', label: 'Custom roles', value: fmt(s.members_with_custom_roles) }
			]
		},
		{
			title: 'Voice activity',
			icon: 'fa-microphone-alt',
			tone: 'lime',
			rows: [
				{ icon: 'fa-clock', label: 'Total minutes', value: fmt(s.leveling_total_voice_minutes) },
				{ icon: 'fa-check-circle', label: 'Active', value: fmt(s.leveling_total_voice_active) },
				{ icon: 'fa-chart-line', label: 'Avg / member', value: avgVoiceMinutes },
				{ icon: 'fa-chart-bar', label: 'Avg active', value: avgVoiceActive },
				{ icon: 'fa-pause-circle', label: 'AFK', value: fmt(s.leveling_total_voice_afk) },
				{ icon: 'fa-video', label: 'Video', value: fmt(s.leveling_total_voice_video) },
				{ icon: 'fa-desktop', label: 'Streaming', value: fmt(s.leveling_total_voice_streaming) }
			]
		},
		{
			title: 'Market',
			icon: 'fa-chart-line',
			tone: 'teal',
			rows: [
				{ icon: 'fa-chart-line', label: 'XP in market', value: fmt(s.assets_market_value) },
				{ icon: 'fa-right-left', label: 'Trades', value: fmt(s.assets_trade_count) },
				{ icon: 'fa-users', label: 'Traders', value: fmt(s.assets_traders) },
				{ icon: 'fa-briefcase', label: 'Open assets', value: fmt(s.assets_open_positions) },
				{ icon: 'fa-arrow-up-from-bracket', label: 'XP bought in', value: fmt(s.assets_buy_volume) },
				{ icon: 'fa-download', label: 'XP cashed out', value: fmt(s.assets_sell_volume) }
			]
		},
		{
			title: 'Items',
			icon: 'fa-bag-shopping',
			tone: 'orange',
			rows: [
				{ icon: 'fa-cart-shopping', label: 'Items bought', value: fmt(s.items_buys) },
				{ icon: 'fa-coins', label: 'XP spent', value: fmt(s.items_buy_spend) },
				{ icon: 'fa-wand-magic-sparkles', label: 'Activations', value: fmt(s.items_activations) },
				{ icon: 'fa-hand', label: 'XP stolen', value: fmt(s.items_stolen) },
				{ icon: 'fa-bomb', label: 'XP bombed', value: fmt(s.items_bombed) },
				{ icon: 'fa-gift', label: 'XP gifted', value: fmt(s.items_gifted) },
				{ icon: 'fa-magnifying-glass', label: 'Spy reports', value: fmt(s.items_spies) },
				{ icon: 'fa-crown', label: 'Bounties set', value: fmt(s.items_bounties_placed) }
			]
		},
		{
			title: 'Minigames',
			icon: 'fa-dice',
			tone: 'pink',
			rows: [
				{ icon: 'fa-coins', label: 'XP wagered', value: fmt(s.minigames_wagered) },
				{ icon: 'fa-gamepad', label: 'Plays', value: fmt(s.minigames_plays) },
				{ icon: 'fa-percent', label: 'Win rate', value: `${minigamesWinRate}%` },
				{ icon: 'fa-trophy', label: 'Biggest win', value: fmt(s.minigames_biggest_win) },
				{ icon: 'fa-hand-holding-dollar', label: 'XP paid out', value: fmt(s.minigames_paid_out) }
			]
		},
		{
			title: 'Giveaways',
			icon: 'fa-gift',
			tone: 'rose',
			rows: [
				{ icon: 'fa-gift', label: 'Hosted', value: fmt(s.giveaways_total) },
				{ icon: 'fa-medal', label: 'Winners', value: fmt(s.giveaways_winners) },
				{ icon: 'fa-ticket', label: 'Entries', value: fmt(s.giveaways_entries) },
				{ icon: 'fa-users', label: 'Entrants', value: fmt(s.giveaways_entrants) },
				{ icon: 'fa-hourglass-half', label: 'Running now', value: fmt(s.giveaways_active) }
			]
		},
		{
			title: 'Content creators',
			icon: 'fa-tower-broadcast',
			tone: 'cyan',
			rows: [
				{ icon: 'fa-tower-broadcast', label: 'Streams', value: fmt(s.streams_total) },
				{ icon: 'fa-video', label: 'Creators', value: fmt(s.streams_creators) },
				{ icon: 'fa-eye', label: 'Peak viewers', value: fmt(s.streams_peak_viewers) },
				{ icon: 'fa-heart', label: 'Likes', value: fmt(s.streams_likes) },
				{ icon: 'fa-comments', label: 'Chat msgs', value: fmt(s.streams_chat_messages) },
				{ icon: 'fa-gem', label: 'Gifts', value: fmt(s.streams_gifts) }
			]
		},
		{
			title: 'Quests',
			icon: 'fa-scroll',
			tone: 'sky',
			rows: [
				{ icon: 'fa-scroll', label: 'Enrolled', value: fmt(s.quests_enrolled) },
				{ icon: 'fa-award', label: 'Rewards claimed', value: fmt(s.quests_claimed) },
				{ icon: 'fa-users', label: 'Participants', value: fmt(s.quests_participants) }
			]
		},
		{
			title: 'Staff & feedback',
			icon: 'fa-shield-halved',
			tone: 'violet',
			rows: [
				{ icon: 'fa-shield-halved', label: 'Staff reviews', value: fmt(s.staff_reviews) },
				{ icon: 'fa-star', label: 'Avg rating', value: fmt(s.staff_avg_rating) },
				{ icon: 'fa-comment-dots', label: 'Feedback', value: fmt(s.feedback_submissions) },
				{ icon: 'fa-moon', label: 'AFK now', value: fmt(s.afk_active) }
			]
		}
	]);

	const syncRows = $derived([
		{ icon: 'fa-server', label: 'Server', at: o.updated_at },
		{ icon: 'fa-users', label: 'Members', at: sync.members_last_updated },
		{ icon: 'fa-star', label: 'Levels', at: sync.levels_last_updated },
		{ icon: 'fa-hashtag', label: 'Channels', at: sync.channels_last_updated },
		{ icon: 'fa-folder', label: 'Categories', at: sync.categories_last_updated },
		{ icon: 'fa-shield-alt', label: 'Roles', at: sync.roles_last_updated }
	]);
</script>

<svelte:head>
	<title>{o.name} — Overview | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="space-y-3 sm:space-y-4 lg:space-y-5">
	<DashGrid>
		{#each cards as card}
			<StatCard icon={card.icon} title={card.title} tone={card.tone}>
				<div class="flex flex-col gap-2">
					{#each card.rows as row}
						<RowStat icon={row.icon} label={row.label} value={row.value} />
					{/each}
				</div>
			</StatCard>
		{/each}

		<StatCard icon="fa-database" title="Data sync" tone="teal">
			<div class="flex flex-col gap-2">
				{#each syncRows as row}
					<RowStat icon={row.icon} label={row.label}>
						<LocalTime value={row.at} includeSeconds class="text-base-content shrink-0 truncate text-right text-xs font-bold sm:text-sm" />
					</RowStat>
				{/each}
			</div>
		</StatCard>
	</DashGrid>

	<StatCard icon="fa-toggle-on" title="Enabled features" tone="emerald">
		<p class="text-base-content/60 text-sm">
			{enabledFeatures.length
				? `${enabledFeatures.length} optional feature${enabledFeatures.length === 1 ? '' : 's'} ${enabledFeatures.length === 1 ? 'is' : 'are'} on. Main and Permissions are always required.`
				: 'No optional features are enabled. Main and Permissions are always on.'}
		</p>
		{#if enabledFeatures.length > 0}
			<div class="flex flex-wrap gap-2">
				{#each enabledFeatures as cfg}
					<span class="badge badge-lg border-base-300 bg-base-200 text-base-content/85 h-auto gap-2 py-1.5 text-xs sm:text-sm">
						<i class="fas fa-check-circle text-success"></i>
						<span class="font-medium">{cfg.label}</span>
						{#if cfg.updated_at}
							<span class="text-base-content/45 text-[0.65rem] sm:text-xs">
								Updated <LocalTime value={cfg.updated_at} includeSeconds class="inline" />
							</span>
						{/if}
					</span>
				{/each}
			</div>
		{/if}
	</StatCard>
</div>
