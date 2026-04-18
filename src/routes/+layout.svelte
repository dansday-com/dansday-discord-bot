<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import '../app.css';
	import Toast from '$lib/frontend/Toast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot</title>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
</svelte:head>

<Toast />
{@render children()}
