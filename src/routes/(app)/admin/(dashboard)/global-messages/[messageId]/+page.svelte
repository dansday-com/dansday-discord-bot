<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import MessageEditor from '$lib/frontend/components/messages/MessageEditor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.message?.name ?? 'New global message'} - {APP_NAME}</title>
</svelte:head>

{#key data.key}
	<MessageEditor {data} />
{/key}
