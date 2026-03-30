<script lang="ts">
	import type { LayoutProps } from './$types';

	let { data }: LayoutProps = $props();

	const s = $derived(data.overview.stats ?? {});
	const sync = $derived(data.overview.sync ?? {});
	const settings = $derived(data.overview.settings ?? []);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '—';
		return val.toLocaleString();
	}

	function fmtDate(val: string | null | undefined): string {
		if (!val) return '—';
		return new Date(val).toLocaleString();
	}
</script>

<svelte:head>
	<title>{data.overview.name} — Overview | Dansday</title>
</svelte:head>

<div class="space-y-4">
	<!-- Members -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
		<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
			<i class="fas fa-users text-ash-400"></i>Members
		</h3>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
			{#each [
				{ label: 'Total', value: fmt(s.members_total) },
				{ label: 'With Levels', value: fmt(s.members_with_levels) },
				{ label: 'Boosting', value: fmt(s.members_boosters) },
				{ label: 'Active AFK', value: fmt(s.members_afk) },
				{ label: 'Custom Roles', value: fmt(s.members_with_custom_roles) }
			] as stat}
				<div class="bg-ash-700 rounded-lg p-3 text-center">
					<p class="text-lg font-bold text-ash-100">{stat.value}</p>
					<p class="text-xs text-ash-400 mt-0.5">{stat.label}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Channels -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
		<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
			<i class="fas fa-hashtag text-ash-400"></i>Channels
		</h3>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
			{#each [
				{ label: 'Total', value: fmt(s.channels_total) },
				{ label: 'Text', value: fmt(s.channels_text) },
				{ label: 'Voice', value: fmt(s.channels_voice) },
				{ label: 'Announcement', value: fmt(s.channels_announcement) },
				{ label: 'Stage', value: fmt(s.channels_stage) }
			] as stat}
				<div class="bg-ash-700 rounded-lg p-3 text-center">
					<p class="text-lg font-bold text-ash-100">{stat.value}</p>
					<p class="text-xs text-ash-400 mt-0.5">{stat.label}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Leveling -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
		<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
			<i class="fas fa-chart-line text-ash-400"></i>Leveling
		</h3>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
			{#each [
				{ label: 'Total XP', value: fmt(s.leveling_total_experience) },
				{ label: 'Avg Level', value: fmt(s.leveling_avg_level) },
				{ label: 'Max Level', value: fmt(s.leveling_max_level) },
				{ label: 'Total Chat', value: fmt(s.leveling_total_chat) },
				{ label: 'Voice Minutes', value: fmt(s.leveling_total_voice_minutes) }
			] as stat}
				<div class="bg-ash-700 rounded-lg p-3 text-center">
					<p class="text-lg font-bold text-ash-100">{stat.value}</p>
					<p class="text-xs text-ash-400 mt-0.5">{stat.label}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Roles & Voice side by side -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- Roles & Structure -->
		<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
			<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
				<i class="fas fa-shield-halved text-ash-400"></i>Roles & Structure
			</h3>
			<div class="grid grid-cols-2 gap-3">
				{#each [
					{ label: 'Total Roles', value: fmt(s.roles_total) },
					{ label: 'Boost Level', value: fmt(s.boost_level ?? data.overview.boost_level) },
					{ label: 'Total Boosts', value: fmt(s.members_boosters) },
					{ label: 'Categories', value: fmt(s.categories_total) }
				] as stat}
					<div class="bg-ash-700 rounded-lg p-3 text-center">
						<p class="text-lg font-bold text-ash-100">{stat.value}</p>
						<p class="text-xs text-ash-400 mt-0.5">{stat.label}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Voice Activity -->
		<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
			<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
				<i class="fas fa-microphone text-ash-400"></i>Voice Activity
			</h3>
			<div class="grid grid-cols-2 gap-3">
				{#each [
					{ label: 'Total Minutes', value: fmt(s.leveling_total_voice_minutes) },
					{ label: 'Active', value: fmt(s.leveling_total_voice_active) },
					{ label: 'AFK', value: fmt(s.leveling_total_voice_afk) },
					{ label: 'Unique AFK', value: fmt(s.members_afk) }
				] as stat}
					<div class="bg-ash-700 rounded-lg p-3 text-center">
						<p class="text-lg font-bold text-ash-100">{stat.value}</p>
						<p class="text-xs text-ash-400 mt-0.5">{stat.label}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Data Sync -->
	<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
		<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
			<i class="fas fa-rotate text-ash-400"></i>Data Sync
		</h3>
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
			{#each [
				{ label: 'Members', value: fmtDate(sync.members_last_updated) },
				{ label: 'Levels', value: fmtDate(sync.levels_last_updated) },
				{ label: 'Channels', value: fmtDate(sync.channels_last_updated) },
				{ label: 'Categories', value: fmtDate(sync.categories_last_updated) },
				{ label: 'Roles', value: fmtDate(sync.roles_last_updated) }
			] as item}
				<div class="bg-ash-700 rounded-lg p-3">
					<p class="text-xs text-ash-400 mb-1">{item.label}</p>
					<p class="text-xs text-ash-200">{item.value}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Configured Components -->
	{#if settings.length > 0}
		<div class="bg-ash-800 rounded-xl border border-ash-700 p-4 sm:p-5">
			<h3 class="text-sm font-semibold text-ash-300 mb-3 flex items-center gap-2">
				<i class="fas fa-puzzle-piece text-ash-400"></i>Configured Components
			</h3>
			<div class="flex flex-wrap gap-2">
				{#each settings as s}
					<span class="text-xs px-2.5 py-1 rounded-full bg-ash-700 text-ash-200 capitalize">
						{s.component_name.replace(/_/g, ' ')}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
