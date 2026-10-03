<script lang="ts">
	import { getContext } from 'svelte';
	import FeatureDisabled from '$lib/frontend/components/FeatureDisabled.svelte';
	import { EmptyState, LevelRewards } from '$lib/frontend/components/public';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
</script>

<svelte:head><title>Level Rewards — {data.server.name}</title></svelte:head>

{#if !data.levelingEnabled}
	<FeatureDisabled
		title="Leveling is turned off"
		message="This server has not enabled leveling, so no roles are given for levels. An administrator can turn it on in the bot configuration panel."
		icon="fa-trophy"
	/>
{:else if !data.levelRewards || data.levelRewards.items.length === 0}
	<EmptyState icon="fa-trophy" message="No level rewards yet" hint="This server has not set any roles for reaching a level." boxed />
{:else}
	<LevelRewards rewards={data.levelRewards} xp={ctx?.liveXp ?? data.balance.xp} levelReq={data.levelReq} />
{/if}
