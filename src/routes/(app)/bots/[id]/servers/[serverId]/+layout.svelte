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

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	<!-- Back -->
	<a href="/bots/{data.botId}" class="text-ash-400 hover:text-ash-100 mb-5 inline-flex items-center gap-2 text-sm transition-colors">
		<i class="fas fa-arrow-left"></i>Back to Bot
	</a>

	<!-- Server Header -->
	<div class="bg-ash-700 border-ash-600 mb-5 rounded-xl border p-4 sm:p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:gap-6">
			<div class="bg-ash-600 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-24 sm:w-24">
				{#if data.overview.server_icon}
					<img src={data.overview.server_icon} alt={data.overview.name} class="h-full w-full object-cover" />
				{:else}
					<i class="fas fa-server text-ash-100 text-2xl"></i>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h2 class="text-ash-100 truncate text-xl font-bold sm:text-2xl">{data.overview.name || 'Unnamed Server'}</h2>
					<div class="flex flex-wrap gap-2 text-xs sm:text-sm">
						<span class="bg-ash-800 border-ash-600 text-ash-300 flex items-center gap-1.5 rounded-lg border px-2 py-1">
							<i class="fas fa-id-card text-ash-400"></i>{data.overview.discord_server_id}
						</span>
						{#if (data.overview.boost_level ?? 0) > 0}
							<span class="bg-ash-800 border-ash-600 text-ash-300 flex items-center gap-1.5 rounded-lg border px-2 py-1">
								<i class="fas fa-gem text-purple-400"></i>Level {data.overview.boost_level}
							</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Tab Nav -->
	<div class="bg-ash-800 border-ash-700 mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all sm:px-4
					{isActive(tab.href) ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} text-xs"></i>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>

	<!-- Page Content -->
	{@render children()}
</div>
