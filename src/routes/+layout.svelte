<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { effectAccentCssVars } from '$lib/items.js';
	import '../app.css';
	import Toast from '$lib/frontend/ToastHost.svelte';

	let { children } = $props();

	const effectAccentStyle = effectAccentCssVars();
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot</title>
	{@html `<link rel="stylesheet" href="/fa/css/all.min.css" media="print" onload="this.media='all';this.onload=null" />`}
	<noscript><link rel="stylesheet" href="/fa/css/all.min.css" /></noscript>
	{@html `<style>${effectAccentStyle}</style>`}
</svelte:head>

<Toast />
{@render children()}
