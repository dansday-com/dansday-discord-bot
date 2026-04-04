<script lang="ts">
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import type { LayoutProps } from './$types';

	let { data }: LayoutProps = $props();

	const o = $derived(data.overview);
	const s = $derived(o.stats ?? {});
	const sync = $derived(o.sync ?? {});
	const settings = $derived(Array.isArray(o.settings) ? o.settings : []);

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

	const avgVoiceMinutes = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_minutes ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);

	const avgVoiceActive = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_active ?? 0) / s.members_with_levels).toLocaleString() : '0'
	);
</script>

<svelte:head>
	<title>{o.name} — Overview | Dansday</title>
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
						<span class="text-ash-300 flex items-center gap-2 text-sm">
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
						<span class="text-ash-300 flex items-center gap-2 text-sm">
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
						<span class="text-ash-300 flex items-center gap-2 text-sm">
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
						<span class="text-ash-300 flex items-center gap-2 text-sm">
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
				{#each [{ icon: 'fa-clock', label: 'Total Minutes', value: fmt(s.leveling_total_voice_minutes) }, { icon: 'fa-check-circle', label: 'Active', value: fmt(s.leveling_total_voice_active) }, { icon: 'fa-chart-line', label: 'Avg Minutes', value: avgVoiceMinutes }, { icon: 'fa-chart-bar', label: 'Avg Active', value: avgVoiceActive }, { icon: 'fa-pause-circle', label: 'AFK', value: fmt(s.leveling_total_voice_afk) }] as row}
					<div class="bg-ash-800/50 flex items-center justify-between rounded-lg p-2">
						<span class="text-ash-300 flex items-center gap-2 text-sm">
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
						<span class="text-ash-300 flex items-center gap-2 text-sm">
							<i class="fas {row.icon} text-xs text-cyan-400/90"></i>{row.label}
						</span>
						<LocalTime value={row.at} includeSeconds class="text-ash-100 truncate text-right text-xs font-bold sm:text-sm" />
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="bg-ash-700 border-ash-600 hover:border-ash-500 rounded-xl border p-4 shadow-lg transition-all sm:p-6">
		<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold sm:text-base">
			<i class="fas fa-sliders-h text-emerald-400"></i>Configured Components
		</h3>
		<p class="text-ash-300 mt-2 text-sm">
			{settings.length ? `${settings.length} component${settings.length !== 1 ? 's' : ''} configured.` : 'No components configured yet.'}
		</p>
		{#if settings.length > 0}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each settings as cfg}
					<span class="bg-ash-800 border-ash-600 text-ash-200 flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs sm:text-sm">
						<i class="fas fa-cog text-emerald-400/90"></i>
						<span class="font-medium">{cfg.component_name}</span>
						<span class="text-ash-500 text-[0.65rem] sm:text-xs">
							Updated <LocalTime value={cfg.updated_at} includeSeconds class="inline" />
						</span>
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>
