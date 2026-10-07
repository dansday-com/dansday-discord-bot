<script lang="ts">
	import { page } from '$app/state';
	import MessageLibrary from '$lib/frontend/components/messages/MessageLibrary.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<svelte:head>
	<title>Messages - {APP_NAME}</title>
</svelte:head>

<MessageLibrary
	title="Messages"
	intro="Write as the bot: plain posts with photos and videos, embeds, or a full Components V2 layout. Add buttons and dropdowns that show another message privately or hand out roles. Each post stays the way it was sent, so a saved message can be changed and sent again."
	empty="No messages yet. Create one to post as the bot, build a rules panel, or set up role buttons."
	{base}
	apiBase="/api/servers/{data.serverId}/messages"
	limit={data.limit}
	messages={data.messages}
/>
