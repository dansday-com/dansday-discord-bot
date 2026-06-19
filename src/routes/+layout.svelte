<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { effectAccentCssVars } from '$lib/items.js';
	import '../app.css';
	import Toast from '$lib/frontend/Toast.svelte';

	let { children } = $props();

	const effectAccentStyle = effectAccentCssVars();
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot</title>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
	{@html `<style>${effectAccentStyle}</style>`}
</svelte:head>

<Toast />
{@render children()}
