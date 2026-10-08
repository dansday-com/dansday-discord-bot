<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { APP_NAME } from '$lib/backend/panelServer.js';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import { effectAccentCssVars } from '$lib/items.js';
	import { publicServerSlugFromHost } from '$lib/url.js';
	import Toast from '$lib/frontend/ToastHost.svelte';

	let { children } = $props();

	const effectAccentStyle = effectAccentCssVars();

	const ICONS_HREF = '/fa/css/all.min.css';
	const deferIcons = page.route.id === '/';

	const SERVER_PAGE = /^\/server\/[^/]+(?:\/(?:leaderboard|members))?\/?$/;
	const SUBDOMAIN_SERVER_PAGE = /^\/(?:leaderboard|members)?\/?$/;

	function stylesheetOf(url: URL): string {
		if (publicServerSlugFromHost(url.hostname)) return SUBDOMAIN_SERVER_PAGE.test(url.pathname) ? 'server' : 'app';
		if (url.pathname === '/') return 'home';
		return SERVER_PAGE.test(url.pathname) ? 'server' : 'app';
	}

	const documentStylesheet = stylesheetOf(page.url);

	function markCrossStylesheetLink(event: Event) {
		const link = (event.target as Element | null)?.closest?.('a[href]');
		if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('data-sveltekit-reload')) return;
		const url = new URL(link.href, location.href);
		if (url.origin === location.origin && stylesheetOf(url) !== documentStylesheet) link.setAttribute('data-sveltekit-reload', '');
	}

	onMount(() => {
		const types = ['pointerover', 'pointerdown', 'focusin'] as const;
		for (const type of types) document.addEventListener(type, markCrossStylesheetLink, { capture: true, passive: true });
		return () => {
			for (const type of types) document.removeEventListener(type, markCrossStylesheetLink, { capture: true });
		};
	});

	beforeNavigate(({ to, type, cancel }) => {
		if (type === 'leave' || type === 'popstate' || !to) return;
		if (stylesheetOf(to.url) === documentStylesheet) return;
		cancel();
		location.href = to.url.href;
	});

	afterNavigate(({ to, type }) => {
		if (type === 'popstate' && to && stylesheetOf(to.url) !== documentStylesheet) location.reload();
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
