<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	function discordServerLink(id: string) {
		return `https://discord.com/channels/${id}`;
	}
	function inviteLink(code: string) {
		return `https://discord.gg/${code}`;
	}

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/bots/${data.botId}/servers/${data.serverId}`);

	const tabs = $derived([
		{ label: 'Overview', icon: 'fa-chart-pie', iconClass: 'text-sky-400', href: base },
		{ label: 'Selfbot', icon: 'fa-robot', iconClass: 'text-violet-400', href: `${base}/selfbot` },
		...(data.user.authenticated && (data.user.account_source === 'accounts' || data.user.account_source === 'server_accounts')
			? [{ label: 'Configuration', icon: 'fa-sliders', iconClass: 'text-emerald-400', href: `${base}/config` }]
			: []),
		...(data.user.authenticated && (data.user.account_source === 'accounts' || data.user.account_source === 'server_accounts')
			? [{ label: 'Accounts', icon: 'fa-user-shield', iconClass: 'text-amber-400', href: `${base}/accounts` }]
			: []),
		{ label: 'Embed Builder', icon: 'fa-envelope-open-text', iconClass: 'text-fuchsia-400', href: `${base}/embed` },
		{ label: 'Members', icon: 'fa-users', iconClass: 'text-blue-400', href: `${base}/members` }
	]);

	function isActive(href: string) {
		if (href === base) return page.url.pathname === base;
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="mx-auto max-w-7xl px-3 py-4 lg:px-8 lg:py-8">
	{#if !data.user.authenticated || data.user.account_source !== 'server_accounts'}
		<a href="/bots/{data.botId}" class="text-ash-400 hover:text-ash-100 mb-5 inline-flex items-center gap-2 text-base transition-colors">
			<i class="fas fa-arrow-left text-violet-300"></i>Back to Bot
		</a>
	{/if}

	<header class="bg-ash-700 border-ash-600 mb-4 rounded-lg border px-3 py-3 lg:mb-5 lg:rounded-xl lg:px-4 lg:py-3.5">
		<div class="flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
			<div class="flex w-full max-w-full flex-col items-center gap-2 lg:w-auto lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center lg:gap-3 lg:text-left">
				<div class="bg-ash-600 ring-ash-500/40 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 lg:h-12 lg:w-12">
					{#if data.overview.server_icon}
						<img src={data.overview.server_icon} alt="" class="h-full w-full object-cover" />
					{:else}
						<i class="fas fa-server text-base text-violet-300 lg:text-lg"></i>
					{/if}
				</div>
				<h2 class="text-ash-100 max-w-[min(100%,20rem)] truncate text-center text-base font-semibold lg:max-w-[min(100%,28rem)] lg:text-left lg:text-lg">
					{data.overview.name || 'Unnamed Server'}
				</h2>
			</div>
			<nav
				class="flex w-full max-w-md flex-wrap items-center justify-center gap-1.5 lg:w-auto lg:max-w-none lg:shrink-0 lg:justify-end"
				aria-label="Server shortcuts"
			>
				<span
					class="bg-ash-800/80 border-ash-600 text-ash-400 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs lg:text-xs"
					title="Discord server ID"
				>
					<i class="fas fa-id-card shrink-0 text-xs text-cyan-300/90"></i>
					<span class="truncate">{data.overview.discord_server_id}</span>
				</span>
				{#if (data.overview.boost_level ?? 0) > 0}
					<span class="bg-ash-800/80 border-ash-600 text-ash-300 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs lg:text-xs">
						<i class="fas fa-gem text-xs text-purple-400/90"></i>LV {data.overview.boost_level}
					</span>
				{/if}
				<a
					href={discordServerLink((data.overview as any).discord_server_id)}
					target="_blank"
					rel="noreferrer"
					class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors lg:text-xs"
				>
					<i class="fab fa-discord text-xs text-indigo-300"></i>Discord
				</a>
				{#if (data.overview as any).vanity_url_code}
					<a
						href={inviteLink((data.overview as any).vanity_url_code)}
						target="_blank"
						rel="noreferrer"
						class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors lg:text-xs"
					>
						<i class="fas fa-link text-xs text-emerald-300"></i>Invite
					</a>
				{:else if (data.overview as any).invite_code}
					<a
						href={inviteLink((data.overview as any).invite_code)}
						target="_blank"
						rel="noreferrer"
						class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors lg:text-xs"
					>
						<i class="fas fa-link text-xs text-emerald-300"></i>Invite
					</a>
				{/if}
			</nav>
		</div>
	</header>

	<div class="bg-ash-800 border-ash-700 mb-5 flex gap-1 overflow-x-auto rounded-xl border p-1">
		{#each tabs as tab}
			{@const active = isActive(tab.href)}
			<a
				href={tab.href}
				class="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-base font-medium whitespace-nowrap transition-all lg:px-4 {active
					? 'bg-ash-600 text-ash-100'
					: 'text-ash-400 hover:text-ash-200 hover:bg-ash-700'}"
			>
				<i class="fas {tab.icon} {tab.iconClass} {active ? '' : 'opacity-75'} text-xs"></i>
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>

	{@render children()}
</div>
