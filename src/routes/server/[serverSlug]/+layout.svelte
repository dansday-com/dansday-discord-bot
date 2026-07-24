<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="m-root text-lb-text relative flex min-h-dvh flex-col overflow-x-hidden">
	<div class="m-blob m-blob-1 pointer-events-none fixed z-0 h-105 w-105 rounded-full opacity-15"></div>
	<div class="m-blob m-blob-2 pointer-events-none fixed z-0 h-80 w-80 rounded-full opacity-15"></div>
	<div class="m-blob m-blob-3 pointer-events-none fixed z-0 h-65 w-65 rounded-full opacity-15"></div>

	<MainHeader trailing="live" />

	<main class="flex-1 overflow-y-auto">
		<div class="m-inner relative z-1 mx-auto my-0 w-full max-w-7xl min-w-0 px-4 pt-4 pb-12 lg:px-8">
			<ServerNav server={data.server} accountEnabled={data.accountEnabled} publicStatsEnabled={data.publicStatsEnabled} />

			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
