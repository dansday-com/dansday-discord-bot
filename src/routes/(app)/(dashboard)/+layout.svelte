<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = $derived([
		{ label: 'Overview', icon: 'fa-chart-pie', iconClass: 'text-sky-400', href: '/overview' },
		{ label: 'Bots', icon: 'fa-robot', iconClass: 'text-violet-400', href: '/bots' },
		{ label: 'Global Embed', icon: 'fa-bullhorn', iconClass: 'text-rose-400', href: '/global-embed' }
	]);

	function isActive(href: string) {
		return page.url.pathname === href;
	}
</script>

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	<div class="bg-ash-800 border-ash-700 mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1">
		{#each tabs as tab}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				class="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all sm:px-4
					{active ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} {tab.iconClass} {active ? '' : 'opacity-75'} text-xs"></i>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>

	{@render children()}
</div>
