<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}/config`);

	const tabs = [
		{ label: 'Main Config', icon: 'fa-gear', href: '' },
		{ label: 'Welcomer', icon: 'fa-hand-wave', href: '/welcomer' },
		{ label: 'Booster', icon: 'fa-gem', href: '/booster' },
		{ label: 'Permissions', icon: 'fa-shield-halved', href: '/permissions' },
		{ label: 'Custom Supporter Role', icon: 'fa-star', href: '/custom-supporter-role' },
		{ label: 'Staff Report & Rating', icon: 'fa-clipboard-check', href: '/staff-report' },
		{ label: 'Notifications', icon: 'fa-bell', href: '/notifications' },
		{ label: 'Feedback', icon: 'fa-comment-dots', href: '/feedback' },
		{ label: 'Giveaway', icon: 'fa-gift', href: '/giveaway' },
		{ label: 'Forwarder', icon: 'fa-forward', href: '/forwarder' },
		{ label: 'Leveling', icon: 'fa-chart-line', href: '/leveling' }
	];

	function isActive(suffix: string) {
		const full = base + suffix;
		if (suffix === '') return page.url.pathname === base;
		return page.url.pathname === full;
	}
</script>

<svelte:head>
	<title>Configuration | Dansday</title>
</svelte:head>

<div class="flex flex-col lg:flex-row gap-4">
	<!-- Sidebar -->
	<nav class="lg:w-56 flex-shrink-0">
		<div class="bg-ash-800 border border-ash-700 rounded-xl p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
			{#each tabs as tab}
				<a
					href={base + tab.href}
					class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all whitespace-nowrap flex-shrink-0
						{isActive(tab.href)
							? 'bg-ash-600 text-ash-100 font-medium'
							: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
				>
					<i class="fas {tab.icon} text-xs w-4 text-center"></i>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		{@render children()}
	</div>
</div>
