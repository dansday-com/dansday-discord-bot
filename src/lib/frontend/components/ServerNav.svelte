<script lang="ts">
	import { page } from '$app/state';
	import { publicServerPath } from '$lib/url.js';

	let {
		server,
		accountEnabled = false,
		publicStatsEnabled = true
	}: {
		server: { slug: string; name?: string | null; server_icon?: string | null };
		accountEnabled?: boolean;
		publicStatsEnabled?: boolean;
	} = $props();

	const basePath = $derived(publicServerPath(server.slug));
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isLeaderboard = $derived(pathNorm.endsWith('/leaderboard'));
	const isMembers = $derived(pathNorm.endsWith('/members'));
	const isAccount = $derived(/\/account(\/|$)/.test(pathNorm));
	const isOverview = $derived(!isLeaderboard && !isMembers && !isAccount);

	const tabs = $derived(
		[
			{ label: 'Statistics', icon: 'fa-chart-pie', href: basePath, active: isOverview, show: publicStatsEnabled },
			{ label: 'Leaderboard', icon: 'fa-trophy', href: `${basePath}/leaderboard`, active: isLeaderboard, show: publicStatsEnabled },
			{ label: 'Members', icon: 'fa-users', href: `${basePath}/members`, active: isMembers, show: publicStatsEnabled },
			{ label: 'Account', icon: 'fa-user', href: `${basePath}/account`, active: isAccount, show: accountEnabled }
		].filter((t) => t.show)
	);
</script>

<header class="m-header">
	<div class="m-server-icon">
		{#if server.server_icon}
			<img src={server.server_icon} alt={server.name || ''} />
		{:else}
			<span class="m-icon-placeholder">🏆</span>
		{/if}
	</div>
	<div class="m-header-text">
		<h1>{server.name || server.slug}</h1>
	</div>
</header>

{#if tabs.length > 1}
	<div class="m-section-tabs">
		{#each tabs as tab}
			<a href={tab.href} class="m-section-tab" class:m-section-tab--active={tab.active} data-sveltekit-preload-data="hover">
				<i class="fas {tab.icon}"></i>
				{tab.label}
			</a>
		{/each}
	</div>
{/if}
