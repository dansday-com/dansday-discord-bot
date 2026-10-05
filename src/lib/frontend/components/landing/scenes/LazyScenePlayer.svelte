<script lang="ts">
	import { nearView } from '$lib/frontend/nearView.js';
	import type { Scene } from './types.js';

	type Player = typeof import('./ScenePlayer.svelte').default;
	type Props = { set: 'menu' | 'essentials' | 'beyond'; label: string; variant?: 'desktop' | 'phone' };

	let { set, label, variant = 'desktop' }: Props = $props();

	let loaded = $state<{ Player: Player; scenes: Scene[] } | null>(null);

	async function load() {
		const [{ default: Player }, scripts] = await Promise.all([import('./ScenePlayer.svelte'), import('./scripts/index.js')]);
		const sets = { menu: scripts.MENU_SCENES, essentials: scripts.ESSENTIAL_SCENES, beyond: scripts.BEYOND_SCENES };
		loaded = { Player, scenes: sets[set] };
	}
</script>

{#if loaded}
	<loaded.Player scenes={loaded.scenes} {label} {variant} />
{:else}
	<div use:nearView={load} class="min-h-[460px] sm:min-h-[560px]" aria-hidden="true"></div>
{/if}
