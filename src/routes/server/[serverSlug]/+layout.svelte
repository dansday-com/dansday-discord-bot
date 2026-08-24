<script lang="ts">
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="m-root" data-theme="dansday">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader trailing="live" />

	<main class="m-main">
		<div class="m-inner">
			<ServerNav server={data.server} />

			{@render children()}
		</div>
	</main>

	<MainFooter />
</div>
