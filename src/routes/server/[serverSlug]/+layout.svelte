<script lang="ts">
	import { onMount } from 'svelte';
	import ServerNav from '$lib/frontend/components/ServerNav.svelte';
	import { PageShell } from '$lib/frontend/components/shell';
	import { attachSfx, sfx } from '$lib/frontend/sfx';
	import { getToasts } from '$lib/frontend/toast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let heardToast = -1;

	onMount(attachSfx);

	$effect(() => {
		const newest = getToasts().at(-1);
		if (!newest || newest.id <= heardToast) return;
		heardToast = newest.id;
		if (newest.type === 'error') sfx.nope();
	});
</script>

<PageShell trailing="live">
	<ServerNav server={data.server} />

	{@render children()}
</PageShell>
