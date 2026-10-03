<script lang="ts">
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import { PageShell } from '$lib/frontend/components/shell';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<PageShell trailing="live">
	<ServerNav server={data.server} />

	{@render children()}
</PageShell>
