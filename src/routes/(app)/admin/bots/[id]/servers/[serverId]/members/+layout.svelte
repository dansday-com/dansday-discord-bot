<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { page } from '$app/state';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(adminServerSectionPath(data.botId, data.serverId, 'members'));

	const tabs = [
		{ label: 'Members', icon: 'fa-users text-blue-400', href: '' },
		{ label: 'Joins', icon: 'fa-right-to-bracket text-cyan-400', href: '/joins' },
		{ label: 'Links', icon: 'fa-link text-emerald-400', href: '/links' }
	];
</script>

<svelte:head>
	<title>Members | {APP_NAME} Discord Bot</title>
</svelte:head>

{#if page.params.memberId}
	<a href={base} class="text-ash-400 hover:text-ash-100 mb-4 inline-flex items-center gap-2 text-sm transition-colors">
		<i class="fas fa-arrow-left text-violet-300"></i>All members
	</a>
{:else}
	<div class="bg-ash-800 border-ash-700 mb-4 grid grid-cols-3 gap-1 rounded-xl border p-1">
		{#each tabs as tab (tab.href)}
			{@const active = page.url.pathname === base + tab.href}
			<a
				href={base + tab.href}
				class="flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-all
					{active ? 'bg-ash-600 text-ash-100' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} text-xs"></i>{tab.label}
			</a>
		{/each}
	</div>
{/if}

{@render children()}
