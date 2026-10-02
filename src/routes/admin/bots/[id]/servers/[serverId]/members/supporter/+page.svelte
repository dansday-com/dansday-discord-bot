<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<MemberList
	members={data.members}
	serverId={data.serverId}
	boostersOnly
	staffRoleIds={data.staffRoleIds}
	adminRoleIds={data.adminRoleIds}
	actor={data.panelActor}
/>
