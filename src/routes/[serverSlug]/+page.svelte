<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.stats);
	const boostLevel = $derived(data.boost_level);

	function fmt(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toLocaleString();
	}

	function fmtDec(val: number | null | undefined): string {
		if (val == null) return '0';
		return Number(val).toFixed(2);
	}

	const membersWithoutLevels = $derived(Math.max(0, (s.members_total ?? 0) - (s.members_with_levels ?? 0)));

	const avgXP = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_experience ?? 0) / Number(s.members_with_levels)).toLocaleString() : '0'
	);

	const avgVoiceMinutes = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_minutes ?? 0) / Number(s.members_with_levels)).toLocaleString() : '0'
	);

	const avgVoiceActive = $derived(
		(s.members_with_levels ?? 0) > 0 ? Math.round((s.leveling_total_voice_active ?? 0) / Number(s.members_with_levels)).toLocaleString() : '0'
	);
</script>

<svelte:head>
	<title>{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot</title>
	<meta name="description" content="Public server statistics for {data.server.name || data.server.slug}." />
	<meta name="theme-color" content="#0c0306" />
	<meta property="og:title" content="{data.server.name || data.server.slug} — Server statistics | Dansday Discord Bot" />
	<meta property="og:description" content="Members, channels, leveling, and voice activity for this community." />
</svelte:head>

<div class="lb-stats-grid">
	<div class="lb-stat-card">
		<div class="lb-stat-card-head">
			<div class="lb-stat-card-icon lb-chili-stat-1">
				<i class="fas fa-users"></i>
			</div>
			<h2 class="lb-stat-card-title">Members</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-user-friends', label: 'Total', value: fmt(s.members_total) }, { icon: 'fa-chart-line', label: 'With Levels', value: fmt(s.members_with_levels) }, { icon: 'fa-gift', label: 'Boosting', value: fmt(s.members_unique_boosters ?? s.members_boosters) }, { icon: 'fa-moon', label: 'Active AFK', value: fmt(s.member_afk) }, { icon: 'fa-user-slash', label: 'Without Levels', value: fmt(membersWithoutLevels) }] as row}
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
			{#each [{ icon: 'fa-list', label: 'Total', value: fmt(s.channels_total) }, { icon: 'fa-comment', label: 'Text', value: fmt(s.channels_text) }, { icon: 'fa-microphone', label: 'Voice', value: fmt(s.channels_voice) }, { icon: 'fa-bullhorn', label: 'Announcement', value: fmt(s.channels_announcement) }, { icon: 'fa-video', label: 'Stage', value: fmt(s.channels_stage) }] as row}
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
			<div class="lb-stat-card-icon lb-chili-stat-3">
				<i class="fas fa-trophy"></i>
			</div>
			<h2 class="lb-stat-card-title">Leveling</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-star', label: 'Total XP', value: fmt(s.leveling_total_experience) }, { icon: 'fa-chart-bar', label: 'Avg Level', value: fmtDec(s.leveling_avg_level) }, { icon: 'fa-crown', label: 'Max Level', value: fmt(s.leveling_max_level) }, { icon: 'fa-chart-line', label: 'Avg XP', value: avgXP }, { icon: 'fa-comments', label: 'Total Chat', value: fmt(s.leveling_total_chat) }] as row}
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
			<div class="lb-stat-card-icon lb-chili-stat-4">
				<i class="fas fa-user-tag"></i>
			</div>
			<h2 class="lb-stat-card-title">Roles &amp; structure</h2>
		</div>
		<div class="lb-stat-rows">
			{#each [{ icon: 'fa-shield-alt', label: 'Total Roles', value: fmt(s.roles_total) }, { icon: 'fa-rocket', label: 'Boost Level', value: fmt(boostLevel) }, { icon: 'fa-gift', label: 'Total Boosts', value: fmt(s.members_boosters) }, { icon: 'fa-folder', label: 'Categories', value: fmt(s.categories_total) }, { icon: 'fa-user-cog', label: 'Custom Roles', value: fmt(s.members_with_custom_roles) }] as row}
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
			{#each [{ icon: 'fa-clock', label: 'Total Minutes', value: fmt(s.leveling_total_voice_minutes) }, { icon: 'fa-check-circle', label: 'Active', value: fmt(s.leveling_total_voice_active) }, { icon: 'fa-chart-line', label: 'Avg Minutes', value: avgVoiceMinutes }, { icon: 'fa-chart-bar', label: 'Avg Active', value: avgVoiceActive }, { icon: 'fa-pause-circle', label: 'AFK', value: fmt(s.leveling_total_voice_afk) }] as row}
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
