<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import { effectAccentCssVars } from '$lib/items.js';
	import Toast from '$lib/frontend/ToastHost.svelte';

	let { children } = $props();

	const effectAccentStyle = effectAccentCssVars();

	const ICONS_HREF = '/fa/css/all.min.css';
	const deferIcons = page.route.id === '/';

	const STYLESHEET_OF_ROUTE: Record<string, string> = {
		'/': 'home',
		'/server/[serverSlug]': 'server',
		'/server/[serverSlug]/leaderboard': 'server',
		'/server/[serverSlug]/members': 'server'
	};
	const stylesheetOf = (routeId: string | null | undefined) => (routeId && STYLESHEET_OF_ROUTE[routeId]) || 'app';
	const documentStylesheet = stylesheetOf(page.route.id);

	beforeNavigate(({ to, type, cancel }) => {
		if (type === 'leave' || type === 'popstate' || !to?.route.id) return;
		if (stylesheetOf(to.route.id) === documentStylesheet) return;
		cancel();
		location.href = to.url.href;
	});

	afterNavigate(({ to, type }) => {
		if (type === 'popstate' && stylesheetOf(to?.route.id) !== documentStylesheet) location.reload();
	});

	onMount(() => {
		if (!deferIcons) return;
		return onFirstInteraction(() => {
			if (document.querySelector(`link[href="${ICONS_HREF}"]`)) return;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = ICONS_HREF;
			document.head.appendChild(link);
		});
	});
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot</title>
	{#if !deferIcons}
		{@html `<link rel="stylesheet" href="${ICONS_HREF}" media="print" onload="this.media='all';this.onload=null" />`}
	{/if}
	<noscript><link rel="stylesheet" href={ICONS_HREF} /></noscript>
	{@html `<style>${effectAccentStyle}</style>`}
</svelte:head>

<Toast />
{@render children()}
