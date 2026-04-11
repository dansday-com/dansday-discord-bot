<script lang="ts">
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="from-ash-950 to-ash-800 flex min-h-screen flex-col bg-gradient-to-br">
	<MainHeader palette="dark" trailing="home" />
	<main class="flex flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4">
		<div class="w-full max-w-md">
			{@render children()}
		</div>
	</main>
	<MainFooter palette="dark" />
</div>
