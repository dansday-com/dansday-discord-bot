<script lang="ts">
	import { getContext } from 'svelte';
	import FeatureDisabled from '$lib/frontend/components/FeatureDisabled.svelte';
	import { EmptyState, Rewards } from '$lib/frontend/components/public';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
</script>

<svelte:head><title>Rewards — {data.server.name}</title></svelte:head>

{#if !data.levelingEnabled}
	<FeatureDisabled
		title="Leveling is turned off"
		message="This server has not enabled leveling, so no roles are given for levels. An administrator can turn it on in the bot configuration panel."
		icon="fa-trophy"
	/>
{:else if !data.rewards || data.rewards.items.length === 0}
	<EmptyState icon="fa-trophy" message="No rewards yet" hint="This server has not set any roles for reaching a level." boxed />
{:else}
	<Rewards rewards={data.rewards} xp={ctx?.liveXp ?? data.balance.xp} levelReq={data.levelReq} />
{/if}
