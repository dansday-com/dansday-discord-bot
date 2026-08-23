<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stats = $derived((data.stats ?? {}) as Record<string, number>);
	const g = $derived((data.global ?? {}) as Record<string, number>);

	function n(v: unknown): number {
		return Number(v) || 0;
	}

	function fmt(val: unknown): string {
		return n(val).toLocaleString();
	}

	function compact(val: unknown): string {
		const v = n(val);
		if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v >= 10_000_000_000 ? 0 : 1)}B`;
		if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
		if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
		return v.toLocaleString();
	}

	function signed(val: unknown): string {
		const v = n(val);
		return `${v >= 0 ? '+' : ''}${v.toLocaleString()}`;
	}

	function formatUptime(ms: number): string {
		if (!ms || ms <= 0) return '0s';
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		const d = Math.floor(h / 24);
		if (d > 0) return `${d}d ${h % 24}h`;
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	function formatMinutes(minutes: unknown): string {
		const m = n(minutes);
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ${m % 60}m`;
		const d = Math.floor(h / 24);
		return `${fmt(d)}d ${h % 24}h`;
	}

	const avgUptimeMs = $derived(
		n(stats.running_bots) + n(stats.running_selfbots) > 0 ? Math.floor(n(stats.total_uptime_ms) / (n(stats.running_bots) + n(stats.running_selfbots))) : 0
	);
	const avgMembersPerServer = $derived(n(stats.total_servers) > 0 ? Math.round(n(stats.total_members) / n(stats.total_servers)) : 0);
	const minigamesNet = $derived(n(g.minigames_wagered) - n(g.minigames_paid_out));

	const headline = $derived([
		{ icon: 'fa-users', label: 'Members reached', value: compact(stats.total_members), tone: 'text-sky-400', bg: 'bg-sky-500/15' },
		{ icon: 'fa-globe', label: 'Servers', value: fmt(stats.total_servers), tone: 'text-emerald-400', bg: 'bg-emerald-500/15' },
		{ icon: 'fa-star', label: 'XP awarded', value: compact(g.leveling_total_xp), tone: 'text-amber-400', bg: 'bg-amber-500/15' },
		{ icon: 'fa-robot', label: 'Bots running', value: `${fmt(stats.running_bots)}/${fmt(stats.total_bots)}`, tone: 'text-violet-400', bg: 'bg-violet-500/15' }
	]);

	const sections = $derived([
		{
			title: 'Official Bots',
			icon: 'fa-robot',
			tone: 'violet',
			rows: [
				{ icon: 'fa-layer-group', label: 'Total Bots', value: fmt(stats.total_bots) },
				{ icon: 'fa-play', label: 'Running', value: fmt(stats.running_bots) },
				{ icon: 'fa-stop', label: 'Stopped', value: fmt(stats.stopped_bots) },
				{ icon: 'fa-user-ninja', label: 'Selfbots', value: fmt(stats.total_selfbots) },
				{ icon: 'fa-play-circle', label: 'Selfbots Active', value: fmt(stats.running_selfbots) }
			]
		},
		{
			title: 'Uptime',
			icon: 'fa-clock',
			tone: 'amber',
			rows: [
				{ icon: 'fa-tachometer-alt', label: 'Total Uptime', value: formatUptime(n(stats.total_uptime_ms)) },
				{ icon: 'fa-balance-scale', label: 'Average Uptime', value: formatUptime(avgUptimeMs) },
				{ icon: 'fa-network-wired', label: 'Total Running', value: fmt(n(stats.running_bots) + n(stats.running_selfbots)) },
				{ icon: 'fa-user-shield', label: 'Panel Accounts', value: fmt(stats.total_panel_accounts) }
			]
		},
		{
			title: 'Members',
			icon: 'fa-users',
			tone: 'sky',
			rows: [
				{ icon: 'fa-user-group', label: 'Total Members', value: fmt(stats.total_members) },
				{ icon: 'fa-chart-bar', label: 'Avg per Server', value: fmt(avgMembersPerServer) },
				{ icon: 'fa-crown', label: 'Largest Server', value: fmt(stats.largest_server_members) },
				{ icon: 'fa-rocket', label: 'Boosters', value: fmt(g.members_boosters) },
				{ icon: 'fa-user-tag', label: 'With Levels', value: fmt(g.members_with_levels) },
				{ icon: 'fa-moon', label: 'AFK Now', value: fmt(g.afk_active) }
			]
		},
		{
			title: 'Structure',
			icon: 'fa-hashtag',
			tone: 'emerald',
			rows: [
				{ icon: 'fa-hashtag', label: 'Channels', value: fmt(g.channels_total) },
				{ icon: 'fa-comment', label: 'Text', value: fmt(g.channels_text) },
				{ icon: 'fa-microphone', label: 'Voice', value: fmt(g.channels_voice) },
				{ icon: 'fa-folder', label: 'Categories', value: fmt(g.categories_total) },
				{ icon: 'fa-user-tag', label: 'Roles', value: fmt(g.roles_total) },
				{ icon: 'fa-palette', label: 'Custom Roles', value: fmt(g.members_with_custom_roles) }
			]
		},
		{
			title: 'Leveling',
			icon: 'fa-star',
			tone: 'amber',
			rows: [
				{ icon: 'fa-star', label: 'Total XP', value: fmt(g.leveling_total_xp) },
				{ icon: 'fa-wallet', label: 'Wallet XP', value: fmt(g.leveling_wallet_xp) },
				{ icon: 'fa-arrow-up', label: 'Max Level', value: fmt(g.leveling_max_level) },
				{ icon: 'fa-chart-bar', label: 'Avg Level', value: n(g.leveling_avg_level).toFixed(1) },
				{ icon: 'fa-comment', label: 'Messages', value: fmt(g.leveling_total_chat) }
			]
		},
		{
			title: 'Voice activity',
			icon: 'fa-microphone',
			tone: 'rose',
			rows: [
				{ icon: 'fa-clock', label: 'Total Voice', value: formatMinutes(g.leveling_total_voice_minutes) },
				{ icon: 'fa-bolt', label: 'Active', value: formatMinutes(g.leveling_total_voice_active) },
				{ icon: 'fa-moon', label: 'AFK', value: formatMinutes(g.leveling_total_voice_afk) },
				{ icon: 'fa-video', label: 'Video', value: formatMinutes(g.leveling_total_voice_video) },
				{ icon: 'fa-tower-broadcast', label: 'Streaming', value: formatMinutes(g.leveling_total_voice_streaming) }
			]
		},
		{
			title: 'Shop',
			icon: 'fa-store',
			tone: 'teal',
			rows: [
				{ icon: 'fa-tags', label: 'Items in Shop', value: fmt(stats.shop_items_total) },
				{ icon: 'fa-circle-check', label: 'Enabled', value: fmt(stats.shop_items_enabled) },
				{ icon: 'fa-calendar', label: 'Scheduled', value: fmt(stats.shop_items_scheduled) },
				{ icon: 'fa-coins', label: 'Avg Price', value: `${fmt(stats.shop_avg_cost)} XP` },
				{ icon: 'fa-cart-shopping', label: 'Distinct Bought', value: fmt(g.items_distinct_bought) }
			]
		},
		{
			title: 'Items',
			icon: 'fa-bag-shopping',
			tone: 'teal',
			rows: [
				{ icon: 'fa-cart-shopping', label: 'Purchases', value: fmt(g.items_buys) },
				{ icon: 'fa-coins', label: 'XP Spent', value: fmt(g.items_buy_spend) },
				{ icon: 'fa-bolt', label: 'Activations', value: fmt(g.items_activations) },
				{ icon: 'fa-gift', label: 'Gifted', value: fmt(g.items_gifts) },
				{ icon: 'fa-trash', label: 'Discarded', value: fmt(g.items_discards) }
			]
		},
		{
			title: 'PvP',
			icon: 'fa-hand',
			tone: 'rose',
			rows: [
				{ icon: 'fa-hand', label: 'XP Stolen', value: fmt(g.items_stolen) },
				{ icon: 'fa-crosshairs', label: 'Steal Attempts', value: fmt(g.items_steal_attempts) },
				{ icon: 'fa-shield-halved', label: 'Steals Caught', value: fmt(g.items_steals_caught) },
				{ icon: 'fa-bomb', label: 'XP Bombed', value: fmt(g.items_bombed) },
				{ icon: 'fa-magnifying-glass', label: 'Spies', value: fmt(g.items_spies) },
				{ icon: 'fa-bullseye', label: 'Bounties Pooled', value: fmt(g.bounties_pooled) }
			]
		},
		{
			title: 'Market',
			icon: 'fa-chart-line',
			tone: 'emerald',
			rows: [
				{ icon: 'fa-coins', label: 'XP Invested', value: fmt(g.assets_invested) },
				{ icon: 'fa-sack-dollar', label: 'Market Value', value: fmt(g.assets_market_value) },
				{ icon: 'fa-arrow-trend-up', label: 'Unrealized', value: signed(g.assets_unrealized_net) },
				{ icon: 'fa-money-bill-trend-up', label: 'Realized', value: signed(g.assets_realized_net) },
				{ icon: 'fa-layer-group', label: 'Open Positions', value: fmt(g.assets_open_positions) },
				{ icon: 'fa-users', label: 'Traders', value: fmt(g.assets_traders) }
			]
		},
		{
			title: 'Minigames',
			icon: 'fa-dice',
			tone: 'violet',
			rows: [
				{ icon: 'fa-dice', label: 'Plays', value: fmt(g.minigames_plays) },
				{ icon: 'fa-coins', label: 'Wagered', value: fmt(g.minigames_wagered) },
				{ icon: 'fa-hand-holding-dollar', label: 'Paid Out', value: fmt(g.minigames_paid_out) },
				{ icon: 'fa-scale-balanced', label: 'House Net', value: signed(minigamesNet) },
				{ icon: 'fa-trophy', label: 'Biggest Win', value: fmt(g.minigames_biggest_win) }
			]
		},
		{
			title: 'Giveaways & Quests',
			icon: 'fa-gift',
			tone: 'sky',
			rows: [
				{ icon: 'fa-gift', label: 'Giveaways', value: fmt(g.giveaways_total) },
				{ icon: 'fa-bolt', label: 'Active', value: fmt(g.giveaways_active) },
				{ icon: 'fa-ticket', label: 'Entries', value: fmt(g.giveaways_entries) },
				{ icon: 'fa-crown', label: 'Winners', value: fmt(g.giveaways_winners) },
				{ icon: 'fa-scroll', label: 'Quests Claimed', value: fmt(g.quests_claimed) },
				{ icon: 'fa-users', label: 'Quest Members', value: fmt(g.quests_participants) }
			]
		},
		{
			title: 'Content creators',
			icon: 'fa-video',
			tone: 'rose',
			rows: [
				{ icon: 'fa-user-plus', label: 'Creators', value: fmt(g.streams_creators) },
				{ icon: 'fa-tower-broadcast', label: 'Live Now', value: fmt(g.streams_live_now) },
				{ icon: 'fa-video', label: 'Streams', value: fmt(g.streams_total) },
				{ icon: 'fa-eye', label: 'Peak Viewers', value: fmt(g.streams_peak_viewers) },
				{ icon: 'fa-heart', label: 'Likes', value: fmt(g.streams_likes) },
				{ icon: 'fa-comment', label: 'Stream Chat', value: fmt(g.streams_chat_messages) }
			]
		},
		{
			title: 'Staff & feedback',
			icon: 'fa-user-shield',
			tone: 'teal',
			rows: [
				{ icon: 'fa-star', label: 'Staff Reviews', value: fmt(g.staff_reviews) },
				{ icon: 'fa-chart-bar', label: 'Avg Rating', value: n(g.staff_avg_rating) > 0 ? `${n(g.staff_avg_rating).toFixed(2)} / 5` : '—' },
				{ icon: 'fa-comment-dots', label: 'Feedback', value: fmt(g.feedback_submissions) }
			]
		}
	]);

	const TONES: Record<string, { bg: string; text: string; row: string }> = {
		violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', row: 'text-violet-400/90' },
		emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', row: 'text-emerald-400/90' },
		amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', row: 'text-amber-400/90' },
		sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', row: 'text-sky-400/90' },
		rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', row: 'text-rose-400/90' },
		teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', row: 'text-teal-400/90' }
	};
</script>

<svelte:head>
	<title>Overview | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="mb-4">
	<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
		<i class="fas fa-chart-pie mr-2 text-sky-400"></i>Panel Overview
	</h2>
	<p class="text-ash-400 text-xs sm:text-sm">
		Everything across all your bots and servers{n(g.servers_counted) > 0
			? ` · ${fmt(g.servers_counted)} server${n(g.servers_counted) === 1 ? '' : 's'} counted`
			: ''}.
	</p>
</div>

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		{#each headline as tile}
			<div class="bg-ash-700 border-ash-600 rounded-xl border p-4 shadow-lg sm:p-5">
				<div class="mb-2 flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg {tile.bg}">
						<i class="fas {tile.icon} text-sm {tile.tone}"></i>
					</div>
					<span class="text-ash-400 text-xs font-medium">{tile.label}</span>
				</div>
				<div class="text-ash-100 text-2xl font-bold sm:text-3xl">{tile.value}</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
		{#each sections as section}
			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg {TONES[section.tone].bg}">
						<i class="fas {section.icon} text-lg {TONES[section.tone].text}"></i>
					</div>
					<h3 class="text-ash-100 text-base font-bold">{section.title}</h3>
				</div>
				<div class="space-y-2">
					{#each section.rows as row}
						<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
							<span class="text-ash-300 flex items-center gap-2 text-sm">
								<i class="fas {row.icon} text-xs {TONES[section.tone].row}"></i>{row.label}
							</span>
							<span class="text-ash-100 text-lg font-bold">{row.value}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
