<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}`);

	const tabs = $derived([
		{ label: 'Overview', icon: 'fa-chart-pie', href: base },
		{ label: 'Members', icon: 'fa-users', href: `${base}/members` },
		{ label: 'Embed Builder', icon: 'fa-envelope-open-text', href: `${base}/embed` },
		{ label: 'Configuration', icon: 'fa-sliders', href: `${base}/config` }
	]);

	function isActive(href: string) {
		if (href === base) return page.url.pathname === base;
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
	<!-- Back -->
	<a
		href="/bots/{data.botId}"
		class="inline-flex items-center gap-2 text-ash-400 hover:text-ash-100 transition-colors text-sm mb-5"
	>
		<i class="fas fa-arrow-left"></i>Back to Bot
	</a>

	<!-- Server Header -->
	<div class="flex items-center gap-4 mb-5">
		<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-ash-600 flex items-center justify-center overflow-hidden flex-shrink-0">
			{#if data.overview.server_icon}
				<img src={data.overview.server_icon} alt={data.overview.name} class="w-full h-full object-cover" />
			{:else}
				<i class="fas fa-server text-ash-300 text-lg"></i>
			{/if}
		</div>
		<div class="min-w-0">
			<h2 class="text-xl sm:text-2xl font-bold text-ash-100 truncate">{data.overview.name}</h2>
			<p class="text-xs text-ash-500 font-mono mt-0.5">{data.overview.discord_server_id}</p>
		</div>
	</div>

	<!-- Tab Nav -->
	<div class="flex gap-1 bg-ash-800 border border-ash-700 rounded-xl p-1 mb-5 overflow-x-auto">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
					{isActive(tab.href)
						? 'bg-ash-600 text-ash-100'
						: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} text-xs"></i>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>

	<!-- Page Content -->
	{@render children()}
</div>
