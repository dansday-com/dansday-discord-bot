<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import FeatureDisabled from '$lib/frontend/components/FeatureDisabled.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader trailing="live" />

	<main class="m-main">
		<div class="m-inner">
			<ServerNav server={data.server} accountEnabled={data.accountEnabled} publicStatsEnabled={data.publicStatsEnabled} />

			{#if data.publicStatsEnabled}
				{@render children()}
			{:else}
				<FeatureDisabled
					title="Public pages are turned off"
					message="This server has not enabled its public statistics pages. An administrator can turn them on in the bot configuration panel."
				/>
			{/if}
		</div>
	</main>

	<MainFooter />
</div>
