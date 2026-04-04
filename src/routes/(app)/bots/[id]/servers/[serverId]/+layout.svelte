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
		...(data.user.authenticated && (data.user.account_source === 'accounts' || data.user.account_type === 'owner')
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

<div class="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
	{#if !data.user.authenticated || data.user.account_source !== 'server_accounts'}
		<a href="/bots/{data.botId}" class="text-ash-400 hover:text-ash-100 mb-5 inline-flex items-center gap-2 text-sm transition-colors">
			<i class="fas fa-arrow-left text-violet-300"></i>Back to Bot
		</a>
	{/if}

	<header class="bg-ash-700 border-ash-600 mb-4 rounded-lg border px-3 py-3 sm:mb-5 sm:rounded-xl sm:px-4 sm:py-3.5">
		<div class="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<div class="flex w-full max-w-full flex-col items-center gap-2 sm:w-auto sm:min-w-0 sm:flex-1 sm:flex-row sm:items-center sm:gap-3 sm:text-left">
				<div class="bg-ash-600 ring-ash-500/40 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 sm:h-12 sm:w-12">
					{#if data.overview.server_icon}
						<img src={data.overview.server_icon} alt="" class="h-full w-full object-cover" />
					{:else}
						<i class="fas fa-server text-base text-violet-300 sm:text-lg"></i>
					{/if}
				</div>
				<h2
					class="text-ash-100 max-w-[min(100%,20rem)] truncate text-center text-base font-semibold tracking-tight sm:max-w-[min(100%,28rem)] sm:text-left sm:text-lg"
				>
					{data.overview.name || 'Unnamed Server'}
				</h2>
			</div>
			<nav
				class="flex w-full max-w-md flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:max-w-none sm:shrink-0 sm:justify-end"
				aria-label="Server shortcuts"
			>
				<span
					class="bg-ash-800/80 border-ash-600 text-ash-400 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.65rem] sm:text-xs"
					title="Discord server ID"
				>
					<i class="fas fa-id-card shrink-0 text-[0.6rem] text-cyan-300/90"></i>
					<span class="truncate">{data.overview.discord_server_id}</span>
				</span>
				{#if (data.overview.boost_level ?? 0) > 0}
					<span class="bg-ash-800/80 border-ash-600 text-ash-300 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] sm:text-xs">
						<i class="fas fa-gem text-[0.6rem] text-purple-400/90"></i>LV {data.overview.boost_level}
					</span>
				{/if}
				<a
					href={discordServerLink((data.overview as any).discord_server_id)}
					target="_blank"
					rel="noreferrer"
					class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] transition-colors sm:text-xs"
				>
					<i class="fab fa-discord text-[0.7rem] text-indigo-300"></i>Discord
				</a>
				{#if (data.overview as any).vanity_url_code}
					<a
						href={inviteLink((data.overview as any).vanity_url_code)}
						target="_blank"
						rel="noreferrer"
						class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] transition-colors sm:text-xs"
					>
						<i class="fas fa-link text-[0.6rem] text-emerald-300"></i>Invite
					</a>
				{:else if (data.overview as any).invite_code}
					<a
						href={inviteLink((data.overview as any).invite_code)}
						target="_blank"
						rel="noreferrer"
						class="bg-ash-800/80 border-ash-600 text-ash-300 hover:text-ash-100 hover:bg-ash-700 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] transition-colors sm:text-xs"
					>
						<i class="fas fa-link text-[0.6rem] text-emerald-300"></i>Invite
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
