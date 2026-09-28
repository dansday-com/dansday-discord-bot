<script lang="ts">
	import MemberList from '$lib/frontend/components/MemberList.svelte';
	import type { LayoutProps } from './$types';
	let { data }: LayoutProps = $props();
</script>

<MemberList members={data.members} />
