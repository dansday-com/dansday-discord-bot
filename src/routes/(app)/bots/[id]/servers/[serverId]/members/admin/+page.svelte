<script lang="ts">
	import MemberList from '$lib/components/server/MemberList.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const roleIds = $derived(data.permissions?.admin_roles ?? []);
</script>

<MemberList members={data.members} filterRoleIds={roleIds} />
