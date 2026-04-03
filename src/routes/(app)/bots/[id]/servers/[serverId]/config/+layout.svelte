<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}/config`);

	const tabs = [
		{ label: 'Main Config', icon: 'fa-gear', iconClass: 'text-emerald-400', href: '' },
		{ label: 'Leaderboards', icon: 'fa-trophy', iconClass: 'text-amber-400', href: '/leaderboards' },
		{ label: 'Welcomer', icon: 'fa-hand', iconClass: 'text-sky-400', href: '/welcomer' },
		{ label: 'Booster', icon: 'fa-gem', iconClass: 'text-purple-400', href: '/booster' },
		{ label: 'Permissions', icon: 'fa-shield-halved', iconClass: 'text-blue-400', href: '/permissions' },
		{ label: 'Custom Supporter Role', icon: 'fa-star', iconClass: 'text-yellow-400', href: '/custom-supporter-role' },
		{ label: 'Staff Report & Rating', icon: 'fa-clipboard-check', iconClass: 'text-orange-400', href: '/staff-report' },
		{ label: 'Content Creator', icon: 'fa-video', iconClass: 'text-pink-400', href: '/content-creator' },
		{ label: 'Notifications', icon: 'fa-bell', iconClass: 'text-rose-400', href: '/notifications' },
		{ label: 'Feedback', icon: 'fa-comment-dots', iconClass: 'text-cyan-400', href: '/feedback' },
		{ label: 'Giveaway', icon: 'fa-gift', iconClass: 'text-pink-400', href: '/giveaway' },
		{ label: 'Forwarder', icon: 'fa-forward', iconClass: 'text-violet-400', href: '/forwarder' },
		{ label: 'Leveling', icon: 'fa-chart-line', iconClass: 'text-lime-400', href: '/leveling' }
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

<div class="flex flex-col gap-4 lg:flex-row">
	<nav class="flex-shrink-0 lg:w-56">
		<div class="bg-ash-800 border-ash-700 flex flex-row gap-1 overflow-x-auto rounded-xl border p-2 lg:flex-col lg:overflow-x-visible">
			{#each tabs as tab}
				{@const active = isActive(tab.href)}
				<a
					href={base + tab.href}
					class="flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-all
						{active ? 'bg-ash-600 text-ash-100 font-medium' : 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
				>
					<i class="fas {tab.icon} {tab.iconClass} {active ? '' : 'opacity-75'} w-4 text-center text-xs"></i>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
