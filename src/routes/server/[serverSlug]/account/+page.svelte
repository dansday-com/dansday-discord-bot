<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { publicServerPath } from '$lib/url.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	onMount(() => {
		const base = publicServerPath(data.server.slug);
		let stored = '';
		try {
			stored = sessionStorage.getItem(`items_card_${data.server.slug}`) || '';
		} catch {
			stored = '';
		}
		if (stored) {
			goto(`${base}/account/overview/${stored}`, { replaceState: true });
		} else {
			goto(base, { replaceState: true });
		}
	});
</script>

<div class="text-base-content/60 flex items-center justify-center py-15 text-[22px]">
	<i class="fas fa-circle-notch fa-spin"></i>
</div>
