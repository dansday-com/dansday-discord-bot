<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import { SERVER_SETTINGS } from '$lib/serverSettingsComponents.js';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}/config`);

	const tabs = SERVER_SETTINGS.configNavTabs;

	function isActive(suffix: string) {
		const full = base + suffix;
		if (suffix === '') return page.url.pathname === base;
		return page.url.pathname === full;
	}
</script>

<svelte:head>
	<title>Configuration | Dansday Discord Bot</title>
</svelte:head>

<div class="flex flex-col gap-4 lg:flex-row">
	<nav class="flex-shrink-0 lg:w-60 xl:w-64">
		<div class="bg-ash-800 border-ash-700 flex flex-row gap-1 overflow-x-auto rounded-xl border p-2 lg:flex-col lg:overflow-x-visible">
			{#each tabs as tab}
				{@const active = isActive(tab.href)}
				{@const featureOff = tab.featureComponent && data.featureEnabledByComponent?.[tab.featureComponent] === false}
				<a
					href={base + tab.href}
					title={tab.label}
					aria-label={featureOff ? `${tab.label} (module off)` : tab.label}
					class="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all lg:w-full lg:min-w-0
						{active ? 'bg-ash-600 text-ash-100 font-medium' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
				>
					<i class="fas {tab.icon} w-4 shrink-0 text-center text-xs transition-colors {featureOff ? (active ? 'text-ash-400' : 'text-ash-500') : tab.iconClass}"
					></i>
					<span class="min-w-0 flex-1 whitespace-nowrap lg:truncate">{tab.label}</span>
				</a>
			{/each}
		</div>
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
