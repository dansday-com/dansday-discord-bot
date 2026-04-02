<script lang="ts">
	import '../app.css';
	import Toast from '$lib/frontend/Toast.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Dansday | Discord Bot Panel</title>
	<link rel="icon" type="image/x-icon" href="/favicon.ico" />
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
</svelte:head>

<Toast />
{@render children()}
