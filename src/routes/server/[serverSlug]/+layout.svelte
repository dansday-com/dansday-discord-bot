<script lang="ts">
	import { page } from '$app/state';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const basePath = $derived(publicServerPath(data.server.slug));
	const leaderboardPath = $derived(`${basePath}/leaderboard`);
	const membersPath = $derived(`${basePath}/members`);
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isLeaderboard = $derived(pathNorm.endsWith('/leaderboard'));
	const isMembers = $derived(pathNorm.endsWith('/members'));
	const isOverview = $derived(!isLeaderboard && !isMembers);
</script>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader mode="stats" />

	<main class="m-main">
		<div class="m-inner">
			<header class="m-header">
				<div class="m-server-icon">
					{#if data.server.server_icon}
						<img src={data.server.server_icon} alt={data.server.name || ''} />
					{:else}
						<span class="m-icon-placeholder">🏆</span>
					{/if}
				</div>
				<div class="m-header-text">
					<h1>{data.server.name || data.server.slug}</h1>
					<p>
						Public statistics
						<span class="m-metric-pill m-metric-pill--live" title="Stats update from live data">
							<span class="m-live-dot"></span>
							Live
						</span>
					</p>
				</div>
			</header>

			<div class="m-section-tabs">
				<a href={basePath} class="m-section-tab" class:m-section-tab--active={isOverview} data-sveltekit-preload-data="hover">
					<i class="fas fa-chart-pie"></i>
					Server statistics
				</a>
				<a href={leaderboardPath} class="m-section-tab" class:m-section-tab--active={isLeaderboard} data-sveltekit-preload-data="hover">
					<i class="fas fa-trophy"></i>
					Leaderboard
				</a>
				<a href={membersPath} class="m-section-tab" class:m-section-tab--active={isMembers} data-sveltekit-preload-data="hover">
					<i class="fas fa-users"></i>
					Members
				</a>
			</div>

			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
