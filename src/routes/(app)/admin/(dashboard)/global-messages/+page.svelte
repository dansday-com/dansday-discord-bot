<script lang="ts">
	import MessageLibrary from '$lib/frontend/components/messages/MessageLibrary.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { ADMIN_TAB_PATHS } from '$lib/frontend/redirect.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Global Messages - {APP_NAME}</title>
</svelte:head>

<MessageLibrary
	title="Global messages"
	intro="Write one message and send it to every server on all of your bots. It lands in each server's Bot Updates Channel, in that server's language when you have translated it. Saving a message edits every copy already posted, and you can pull it back from one server or all of them."
	empty="No global messages yet. Create one for an announcement, a downtime notice or an update."
	base={ADMIN_TAB_PATHS.globalMessages}
	apiBase="/api/admin/messages"
	limit={data.limit}
	messages={data.messages}
/>
