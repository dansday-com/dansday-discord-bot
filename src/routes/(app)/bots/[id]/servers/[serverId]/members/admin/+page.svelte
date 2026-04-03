<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const perm = $derived((data.permissions?.settings ?? {}) as { admin_roles?: string[] });
	const roleIds = $derived(perm.admin_roles ?? []);
	const permissionsHref = $derived(`/bots/${data.botId}/servers/${data.serverId}/config/permissions`);
</script>

<MemberList members={data.members} filterRoleIds={roleIds} {permissionsHref} />
