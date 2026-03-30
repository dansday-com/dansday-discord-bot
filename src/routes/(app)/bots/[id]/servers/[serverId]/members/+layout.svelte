<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}/members`);

	const tabs = [
		{ label: 'All', href: '' },
		{ label: 'Members', href: '/member' },
		{ label: 'Supporter', href: '/supporter' },
		{ label: 'Staff', href: '/staff' },
		{ label: 'Admin', href: '/admin' }
	];

	function isActive(suffix: string) {
		const full = base + suffix;
		if (suffix === '') return page.url.pathname === base;
		return page.url.pathname === full;
	}
</script>

<svelte:head>
	<title>Members | Dansday</title>
</svelte:head>

<!-- Sub-tab nav -->
<div class="flex gap-1 bg-ash-800 border border-ash-700 rounded-xl p-1 mb-4 overflow-x-auto">
	{#each tabs as tab}
		<a
			href={base + tab.href}
			class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
				{isActive(tab.href) ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
		>
			{tab.label}
		</a>
	{/each}
</div>

{@render children()}
