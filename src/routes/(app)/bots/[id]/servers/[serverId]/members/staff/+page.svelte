<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const roleIds = $derived(data.staffRoleIds ?? []);
	const configureHref = $derived(`/bots/${data.botId}/servers/${data.serverId}/config`);
</script>

<MemberList members={data.members} filterRoleIds={roleIds} {configureHref} configureLabel="Open Main configuration" />
