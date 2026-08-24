<script lang="ts">
	import { page } from '$app/state';
	import { publicServerPath } from '$lib/url.js';
	import { NavTabs, type NavTab } from '$lib/frontend/components/shell';

	let {
		server
	}: {
		server: { slug: string; name?: string | null; server_icon?: string | null };
	} = $props();

	const basePath = $derived(publicServerPath(server.slug));
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isLeaderboard = $derived(pathNorm.endsWith('/leaderboard'));
	const isMembers = $derived(pathNorm.endsWith('/members'));
	const isAccount = $derived(/\/account(\/|$)/.test(pathNorm));
	const isOverview = $derived(!isLeaderboard && !isMembers && !isAccount);

	const accountHash = $derived((page.data as any)?.hash || pathNorm.match(/\/account\/(?:\w+\/)*([0-9a-f]{16})$/)?.[1] || '');
	const accountHref = $derived(accountHash ? `${basePath}/account/overview/${accountHash}` : `${basePath}/account`);

	let hasStoredCard = $state(false);
	$effect(() => {
		pathNorm;
		try {
			hasStoredCard = !!sessionStorage.getItem(`items_card_${server.slug}`);
		} catch {
			hasStoredCard = false;
		}
	});
	const isGuest = $derived(!accountHash && !hasStoredCard);

	const tabs: NavTab[] = $derived(
		[
			{ label: 'Statistics', icon: 'fa-chart-pie', href: basePath, active: isOverview, show: true },
			{ label: 'Leaderboard', icon: 'fa-trophy', href: `${basePath}/leaderboard`, active: isLeaderboard, show: true },
			{ label: 'Members', icon: 'fa-users', href: `${basePath}/members`, active: isMembers, show: true },
			{ label: 'Account', icon: 'fa-user', href: accountHref, active: isAccount, show: !isGuest }
		]
			.filter((t) => t.show)
			.map(({ show, ...t }) => t)
	);
</script>

<header class="mb-4 flex items-center gap-3">
	<div class="border-base-300 bg-base-100 grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border">
		{#if server.server_icon}
			<img class="size-full object-cover" src={server.server_icon} alt={server.name || ''} />
		{:else}
			<span class="text-lg">🏆</span>
		{/if}
	</div>
	<h1 class="text-base-content min-w-0 truncate text-lg font-extrabold tracking-tight sm:text-xl">{server.name || server.slug}</h1>
</header>

{#if tabs.length > 1}
	<div class="mb-4">
		<NavTabs variant="segment" {tabs} />
	</div>
{/if}
