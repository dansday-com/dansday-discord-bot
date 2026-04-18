<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}/members`);

	const tabs = [
		{ label: 'All', href: '' },
		{ label: 'Members', href: '/member' },
		{ label: 'Supporter', href: '/supporter' },
		{ label: 'Content Creator', href: '/content-creator' },
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
	<title>Members | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="bg-ash-800 border-ash-700 mb-4 flex gap-1 overflow-x-auto rounded-xl border p-1">
	{#each tabs as tab}
		<a
			href={base + tab.href}
			class="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all
				{isActive(tab.href) ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
		>
			{tab.label}
		</a>
	{/each}
</div>

{@render children()}
