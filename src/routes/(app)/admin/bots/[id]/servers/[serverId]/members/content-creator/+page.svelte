<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import { adminServerSectionPath } from '$lib/frontend/redirect.js';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	const roleIds = $derived(data.contentCreatorRoleIds ?? []);
	const configureHref = $derived(adminServerSectionPath(data.botId, data.serverId, 'config/content-creator'));
</script>

<MemberList members={data.members} filterRoleIds={roleIds} {configureHref} configureLabel="Open Content Creator configuration" />
