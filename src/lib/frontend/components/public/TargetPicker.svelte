<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		placeholder,
		search = $bindable(),
		hasTargets,
		matches,
		onback,
		children
	}: {
		label: Snippet;
		placeholder: string;
		search: string;
		hasTargets: boolean;
		matches: number;
		onback: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label="Pick a target">
	<div class="modal-box border-base-300 max-h-[85vh] max-w-[440px] border">
		<button type="button" class="btn btn-ghost btn-sm text-base-content/60 mb-2 -ml-2 gap-1.5 px-2" onclick={onback}>
			<i class="fas fa-arrow-left"></i>Back
		</button>

		<p class="text-base-content mb-3 text-sm">{@render label()}</p>

		{#if !hasTargets}
			<p class="text-base-content/50 py-6 text-center text-sm font-semibold">No eligible targets in this server.</p>
		{:else}
			<label class="input border-base-300 bg-base-200 mb-2.5 flex w-full items-center gap-2">
				<i class="fas fa-search text-base-content/40 text-sm" aria-hidden="true"></i>
				<input type="search" class="grow" {placeholder} bind:value={search} autocomplete="off" />
			</label>

			{#if matches === 0}
				<p class="text-base-content/50 py-6 text-center text-sm font-semibold">No members match “{search}”.</p>
			{:else}
				<ul class="flex max-h-[440px] list-none flex-col gap-[7px] overflow-x-hidden overflow-y-auto p-0.5">
					{@render children()}
				</ul>
			{/if}
		{/if}
	</div>
	<button type="button" class="modal-backdrop bg-base-content/55 backdrop-blur-[5px]" onclick={onback}>close</button>
</div>
