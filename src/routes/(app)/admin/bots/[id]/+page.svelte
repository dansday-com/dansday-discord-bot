<script lang="ts">
	import ServerList from '$lib/frontend/components/ServerList.svelte';
	import { adminServerPath } from '$lib/frontend/redirect.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ServerList servers={data.servers} href={(s) => adminServerPath(data.bot.id, s.id)} />
