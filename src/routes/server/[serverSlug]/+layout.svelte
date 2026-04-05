<script lang="ts">
	import { page } from '$app/state';
	import { publicServerPath } from '$lib/publicSiteUrls.js';
	import type { LayoutProps } from './$types';
	import './public-page.css';

	let { data, children }: LayoutProps = $props();

	const basePath = $derived(publicServerPath(data.server.slug));
	const leaderboardPath = $derived(`${basePath}/leaderboard`);
	const membersPath = $derived(`${basePath}/members`);
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isLeaderboard = $derived(pathNorm.endsWith('/leaderboard'));
	const isMembers = $derived(pathNorm.endsWith('/members'));
	const isOverview = $derived(!isLeaderboard && !isMembers);
</script>

<div class="lb-root">
	<div class="blob blob-1"></div>
	<div class="blob blob-2"></div>
	<div class="blob blob-3"></div>

	<nav class="lb-nav">
		<div class="lb-nav-inner">
			<div class="lb-nav-brand">
				<div class="lb-nav-icon">
					<i class="fas fa-bolt"></i>
				</div>
				<span>Dansday Discord Bot Panel</span>
			</div>
			<div class="lb-nav-right">
				<span class="lb-nav-live">
					<span class="lb-nav-live-dot"></span>
					Live
				</span>
			</div>
		</div>
	</nav>

	<main class="lb-main">
		<div class="lb-inner">
			<header class="lb-header">
				<div class="lb-server-icon">
					{#if data.server.server_icon}
						<img src={data.server.server_icon} alt={data.server.name || ''} />
					{:else}
						<span class="lb-icon-placeholder">🏆</span>
					{/if}
				</div>
				<div class="lb-header-text">
					<h1>{data.server.name || data.server.slug}</h1>
					<p>Public statistics</p>
				</div>
			</header>

			<div class="lb-section-tabs">
				<a href={basePath} class="lb-section-tab" class:lb-section-tab--active={isOverview} data-sveltekit-preload-data="hover">
					<i class="fas fa-chart-pie"></i>
					Server statistics
				</a>
				<a href={leaderboardPath} class="lb-section-tab" class:lb-section-tab--active={isLeaderboard} data-sveltekit-preload-data="hover">
					<i class="fas fa-trophy"></i>
					Leaderboard
				</a>
				<a href={membersPath} class="lb-section-tab" class:lb-section-tab--active={isMembers} data-sveltekit-preload-data="hover">
					<i class="fas fa-users"></i>
					Members
				</a>
			</div>

			{@render children()}
		</div>
	</main>

	<footer class="lb-footer">
		<div class="lb-footer-inner">
			<p class="lb-footer-copy">
				Copyright &copy; {new Date().getFullYear()}
				<a href="https://dansday.com" target="_blank">dansday.com</a>. All rights reserved.
			</p>
		</div>
	</footer>
</div>
