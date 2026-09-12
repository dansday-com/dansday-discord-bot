<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		icon = 'fa-triangle-exclamation',
		title = 'Are you sure?',
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		dangerous = true,
		loading = false,
		onconfirm,
		oncancel,
		children
	}: {
		icon?: string;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		dangerous?: boolean;
		loading?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
		children?: Snippet;
	} = $props();

	const halo = $derived(dangerous ? 'bg-error/14 border-error/35 text-error' : 'bg-primary/14 border-primary/35 text-primary');
	const accept = $derived(dangerous ? 'btn-error' : 'btn-primary');

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !loading) oncancel();
	}
</script>

<svelte:window {onkeydown} />

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={title}>
	<div class="modal-box border-base-300 max-w-[380px] border p-5 text-center">
		<div class="mx-auto mb-3 grid size-14 place-items-center rounded-full border text-[24px] {halo}">
			<i class="fas {icon}"></i>
		</div>

		<h3 class="text-base-content text-lg font-extrabold tracking-tight">{title}</h3>
		<p class="text-base-content/60 mt-2 text-[13px] leading-relaxed">{message}</p>

		{#if children}{@render children()}{/if}

		<div class="modal-action mt-5 flex-col-reverse gap-2 min-[400px]:flex-row">
			<button type="button" class="btn btn-ghost btn-sm flex-1" onclick={oncancel} disabled={loading}>
				{cancelLabel}
			</button>
			<button type="button" class="btn btn-sm flex-1 font-bold {accept}" onclick={onconfirm} disabled={loading}>
				{#if loading}<span class="loading loading-spinner loading-xs"></span>{/if}{confirmLabel}
			</button>
		</div>
	</div>
	<button type="button" class="modal-backdrop bg-base-content/55 backdrop-blur-[5px]" onclick={() => !loading && oncancel()}>close</button>
</div>
