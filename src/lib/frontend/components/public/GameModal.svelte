<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon,
		title,
		state = 'idle',
		shake = false,
		closable = true,
		leading,
		onclose,
		children
	}: {
		icon?: string;
		title: string;
		state?: 'idle' | 'win' | 'lose';
		shake?: boolean;
		closable?: boolean;
		leading?: Snippet;
		onclose: () => void;
		children: Snippet;
	} = $props();

	const aura = $derived(state === 'win' ? 'from-success/25' : state === 'lose' ? 'from-error/25' : 'from-warning/16');
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={title}>
	<div class="modal-box border-base-300 relative isolate max-w-[420px] overflow-hidden border p-4 min-[600px]:p-5 {shake ? 'animate-game-shake' : ''}">
		<div class="pointer-events-none absolute -inset-[40%] -z-1 bg-radial-[circle_at_50%_0%] to-transparent to-55% opacity-50 {aura}"></div>

		<div class="mb-3.5 flex items-center justify-between">
			<span class="text-base-content inline-flex items-center gap-2 text-[15px] font-extrabold">
				{#if leading}
					{@render leading()}
				{:else if icon}
					<span class="animate-game-wobble text-[19px] text-[#d9a528]"><i class="fas {icon}"></i></span>
				{/if}{title}
			</span>
			{#if closable}
				<button type="button" class="btn btn-ghost btn-sm btn-circle text-base-content/60" aria-label="Close" onclick={onclose}>
					<i class="fas fa-times text-lg"></i>
				</button>
			{/if}
		</div>

		{@render children()}
	</div>
	<button type="button" class="modal-backdrop bg-base-content/55 backdrop-blur-[5px]" onclick={() => closable && onclose()}>close</button>
</div>
