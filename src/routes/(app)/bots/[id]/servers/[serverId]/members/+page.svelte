<script lang="ts">
	import MemberList from '$lib/components/server/MemberList.svelte';
	import type { LayoutProps } from './$types';
	let { data }: LayoutProps = $props();
</script>

<MemberList members={data.members} />
