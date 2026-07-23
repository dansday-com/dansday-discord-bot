<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="m-root text-lb-text relative flex flex-col overflow-x-hidden">
	<div class="m-blob m-blob-1 pointer-events-none fixed z-0 h-[420px] w-[420px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-2 pointer-events-none fixed z-0 h-[320px] w-[320px] rounded-full opacity-14"></div>
	<div class="m-blob m-blob-3 pointer-events-none fixed z-0 h-[260px] w-[260px] rounded-full opacity-14"></div>

	<MainHeader trailing="live" />

	<main class="m-main flex-1 overflow-y-auto">
		<div class="m-inner relative z-1 mx-auto my-0 max-w-[1280px] px-8 pt-8 pb-16">
			<ServerNav server={data.server} accountEnabled={data.accountEnabled} publicStatsEnabled={data.publicStatsEnabled} />

			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
