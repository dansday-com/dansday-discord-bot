<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const roleIds = $derived(data.staffRoleIds ?? []);
	const configureHref = $derived(adminServerSectionPath(data.botId, data.serverId, 'config'));
</script>

<MemberList
	members={data.members}
	serverId={data.serverId}
	filterRoleIds={roleIds}
	{configureHref}
	configureLabel="Open Main configuration"
	staffRoleIds={data.staffRoleIds}
	adminRoleIds={data.adminRoleIds}
	actor={data.panelActor}
/>
