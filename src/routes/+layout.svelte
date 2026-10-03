<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import { effectAccentCssVars } from '$lib/items.js';
	import '../app.css';
	import Toast from '$lib/frontend/ToastHost.svelte';

	let { children } = $props();

	const effectAccentStyle = effectAccentCssVars();

	const ICONS_HREF = '/fa/css/all.min.css';
	const deferIcons = page.route.id === '/';

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
