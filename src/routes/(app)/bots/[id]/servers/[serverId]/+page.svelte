<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
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

	const avgXP = $derived((s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_experience ?? 0) / s.members_with_levels).toLocaleString() : '0');
	const minigamesWinRate = $derived((s.minigames_plays ?? 0) > 0 ? Math.round((Number(s.minigames_wins) / Number(s.minigames_plays)) * 100) : 0);

	const featureCards = $derived([
		{
			title: 'Market',
			icon: 'fa-chart-line',
			accent: 'emerald',
			rows: [
				{ icon: 'fa-chart-line', label: 'XP in market', value: s.assets_market_value },
				{ icon: 'fa-right-left', label: 'Trades', value: s.assets_trade_count },
				{ icon: 'fa-users', label: 'Traders', value: s.assets_traders },
				{ icon: 'fa-briefcase', label: 'Open assets', value: s.assets_open_positions },
				{ icon: 'fa-arrow-up-from-bracket', label: 'XP bought in', value: s.assets_buy_volume },
				{ icon: 'fa-download', label: 'XP cashed out', value: s.assets_sell_volume }
			]
		},
		{
			title: 'Items',
			icon: 'fa-bag-shopping',
			accent: 'yellow',
			rows: [
				{ icon: 'fa-cart-shopping', label: 'Items bought', value: s.items_buys },
				{ icon: 'fa-coins', label: 'XP spent', value: s.items_buy_spend },
				{ icon: 'fa-wand-magic-sparkles', label: 'Activations', value: s.items_activations },
				{ icon: 'fa-hand', label: 'XP stolen', value: s.items_stolen },
				{ icon: 'fa-bomb', label: 'XP bombed', value: s.items_bombed },
				{ icon: 'fa-gift', label: 'XP gifted', value: s.items_gifted },
				{ icon: 'fa-magnifying-glass', label: 'Spy reports', value: s.items_spies },
				{ icon: 'fa-crown', label: 'Bounties set', value: s.items_bounties_placed }
			]
		},
		{
			title: 'Minigames',
			icon: 'fa-dice',
			accent: 'orange',
			rows: [
				{ icon: 'fa-coins', label: 'XP wagered', value: s.minigames_wagered },
				{ icon: 'fa-gamepad', label: 'Plays', value: s.minigames_plays },
				{ icon: 'fa-percent', label: 'Win rate', value: `${minigamesWinRate}%` },
				{ icon: 'fa-trophy', label: 'Biggest win', value: s.minigames_biggest_win },
				{ icon: 'fa-hand-holding-dollar', label: 'XP paid out', value: s.minigames_paid_out }
			]
		},
		{
			title: 'Giveaways',
			icon: 'fa-gift',
			accent: 'pink',
			rows: [
				{ icon: 'fa-gift', label: 'Hosted', value: s.giveaways_total },
				{ icon: 'fa-medal', label: 'Winners', value: s.giveaways_winners },
				{ icon: 'fa-ticket', label: 'Entries', value: s.giveaways_entries },
				{ icon: 'fa-users', label: 'Entrants', value: s.giveaways_entrants },
				{ icon: 'fa-hourglass-half', label: 'Running now', value: s.giveaways_active }
			]
		},
		{
			title: 'Content creators',
			icon: 'fa-tower-broadcast',
			accent: 'rose',
			rows: [
				{ icon: 'fa-tower-broadcast', label: 'Streams', value: s.streams_total },
				{ icon: 'fa-video', label: 'Creators', value: s.streams_creators },
				{ icon: 'fa-eye', label: 'Peak viewers', value: s.streams_peak_viewers },
				{ icon: 'fa-heart', label: 'Likes', value: s.streams_likes },
				{ icon: 'fa-comments', label: 'Chat msgs', value: s.streams_chat_messages },
				{ icon: 'fa-gem', label: 'Gifts', value: s.streams_gifts }
			]
		},
		{
			title: 'Quests',
			icon: 'fa-scroll',
			accent: 'blue',
			rows: [
				{ icon: 'fa-scroll', label: 'Enrolled', value: s.quests_enrolled },
				{ icon: 'fa-award', label: 'Rewards claimed', value: s.quests_claimed },
				{ icon: 'fa-users', label: 'Participants', value: s.quests_participants }
			]
		},
		{
			title: 'Staff & feedback',
			icon: 'fa-shield-halved',
			accent: 'cyan',
			rows: [
				{ icon: 'fa-shield-halved', label: 'Staff reviews', value: s.staff_reviews },
				{ icon: 'fa-star', label: 'Avg rating', value: s.staff_avg_rating },
				{ icon: 'fa-comment-dots', label: 'Feedback', value: s.feedback_submissions },
				{ icon: 'fa-moon', label: 'AFK now', value: s.afk_active }
			]
		}
	]);

	const accentClasses: Record<string, { bg: string; icon: string; row: string }> = {
		emerald: { bg: 'bg-emerald-500/15', icon: 'text-emerald-400', row: 'text-emerald-400/90' },
		yellow: { bg: 'bg-yellow-500/15', icon: 'text-yellow-400', row: 'text-yellow-400/90' },
		orange: { bg: 'bg-orange-500/15', icon: 'text-orange-400', row: 'text-orange-400/90' },
		pink: { bg: 'bg-pink-500/15', icon: 'text-pink-400', row: 'text-pink-400/90' },
		rose: { bg: 'bg-rose-500/15', icon: 'text-rose-400', row: 'text-rose-400/90' },
		blue: { bg: 'bg-blue-500/15', icon: 'text-blue-400', row: 'text-blue-400/90' },
		cyan: { bg: 'bg-cyan-500/15', icon: 'text-cyan-400', row: 'text-cyan-400/90' }
	};

	const avgVoiceMinutes = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_minutes ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);

	const avgVoiceActive = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_active ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);
</script>

<svelte:head>
	<title>{o.name} — Overview | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6">
	<div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
					<i class="fas fa-users text-lg text-blue-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Members</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-user-friends', label: 'Total', value: fmt(s.members_total) }, { icon: 'fa-chart-line', label: 'With Levels', value: fmt(s.members_with_levels) }, { icon: 'fa-gift', label: 'Boosting', value: fmt(s.members_unique_boosters ?? s.members_boosters) }, { icon: 'fa-moon', label: 'Active AFK', value: fmt(s.member_afk) }, { icon: 'fa-user-slash', label: 'Without Levels', value: fmt(membersWithoutLevels) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-blue-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
					<i class="fas fa-hashtag text-lg text-violet-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Channels</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-list', label: 'Total', value: fmt(s.channels_total) }, { icon: 'fa-comment', label: 'Text', value: fmt(s.channels_text) }, { icon: 'fa-microphone', label: 'Voice', value: fmt(s.channels_voice) }, { icon: 'fa-bullhorn', label: 'Announcement', value: fmt(s.channels_announcement) }, { icon: 'fa-video', label: 'Stage', value: fmt(s.channels_stage) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-violet-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
					<i class="fas fa-trophy text-lg text-amber-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Leveling</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-star', label: 'Total XP', value: fmt(s.leveling_total_experience) }, { icon: 'fa-chart-bar', label: 'Avg Level', value: fmtDec(s.leveling_avg_level) }, { icon: 'fa-crown', label: 'Max Level', value: fmt(s.leveling_max_level) }, { icon: 'fa-chart-line', label: 'Avg XP', value: avgXP }, { icon: 'fa-comments', label: 'Total Chat', value: fmt(s.leveling_total_chat) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-amber-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
					<i class="fas fa-user-tag text-lg text-green-500"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Roles & Structure</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-shield-alt', label: 'Total Roles', value: fmt(s.roles_total) }, { icon: 'fa-rocket', label: 'Boost Level', value: fmt(o.boost_level ?? s.boost_level) }, { icon: 'fa-gift', label: 'Total Boosts', value: fmt(s.members_boosters) }, { icon: 'fa-folder', label: 'Categories', value: fmt(s.categories_total) }, { icon: 'fa-user-cog', label: 'Custom Roles', value: fmt(s.members_with_custom_roles) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-green-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20">
					<i class="fas fa-microphone-alt text-lg text-yellow-500"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Voice Activity</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-clock', label: 'Total Minutes', value: fmt(s.leveling_total_voice_minutes) }, { icon: 'fa-check-circle', label: 'Active', value: fmt(s.leveling_total_voice_active) }, { icon: 'fa-pause-circle', label: 'AFK', value: fmt(s.leveling_total_voice_afk) }, { icon: 'fa-video', label: 'Video', value: fmt(s.leveling_total_voice_video) }, { icon: 'fa-desktop', label: 'Streaming', value: fmt(s.leveling_total_voice_streaming) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-yellow-400/90"></i>{row.label}
						</span>
						<span class="text-ash-100 text-lg font-bold">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15">
					<i class="fas fa-database text-lg text-cyan-400"></i>
				</div>
				<h3 class="text-ash-100 text-base font-bold">Data Sync</h3>
			</div>
			<div class="space-y-2">
				{#each [{ icon: 'fa-server', label: 'Server', at: o.updated_at }, { icon: 'fa-users', label: 'Members', at: sync.members_last_updated }, { icon: 'fa-star', label: 'Levels', at: sync.levels_last_updated }, { icon: 'fa-hashtag', label: 'Channels', at: sync.channels_last_updated }, { icon: 'fa-folder', label: 'Categories', at: sync.categories_last_updated }, { icon: 'fa-shield-alt', label: 'Roles', at: sync.roles_last_updated }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-base">
							<i class="fas {row.icon} text-xs text-cyan-400/90"></i>{row.label}
						</span>
						<LocalTime value={row.at} includeSeconds class="text-ash-100 truncate text-right text-xs font-bold sm:text-base" />
					</div>
				{/each}
			</div>
		</div>

		{#each featureCards as card}
			<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-5 shadow-lg transition-all sm:p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg {accentClasses[card.accent].bg}">
						<i class="fas {card.icon} text-lg {accentClasses[card.accent].icon}"></i>
					</div>
					<h3 class="text-ash-100 text-base font-bold">{card.title}</h3>
				</div>
				<div class="space-y-2">
					{#each card.rows as row}
						<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
							<span class="text-ash-300 flex items-center gap-2 text-base">
								<i class="fas {row.icon} text-xs {accentClasses[card.accent].row}"></i>{row.label}
							</span>
							<span class="text-ash-100 text-lg font-bold">{typeof row.value === 'string' ? row.value : fmt(row.value)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-6">
		<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold sm:text-base">
			<i class="fas fa-toggle-on text-emerald-400"></i>Enabled features
		</h3>
		<p class="text-ash-300 mt-2 text-base">
			{enabledFeatures.length
				? `${enabledFeatures.length} optional feature${enabledFeatures.length === 1 ? '' : 's'} ${enabledFeatures.length === 1 ? 'is' : 'are'} on. Main and Permissions are always required.`
				: 'No optional features are enabled. Main and Permissions are always on.'}
		</p>
		{#if enabledFeatures.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each enabledFeatures as cfg}
					<span class="bg-ash-800 border-ash-600 text-ash-200 flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs sm:text-base">
						<i class="fas fa-check-circle text-emerald-400/90"></i>
						<span class="font-medium">{cfg.label}</span>
						{#if cfg.updated_at}
							<span class="text-ash-500 text-xs sm:text-xs">
								Updated <LocalTime value={cfg.updated_at} includeSeconds class="inline" />
							</span>
						{/if}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>
