<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'neutral',
		icon,
		title,
		line,
		delta = null,
		deltaUp = true,
		until = null,
		wide = false,
		showClose = false,
		onclose,
		children
	}: {
		tone?: 'win' | 'lose' | 'neutral';
		icon: string;
		title: string;
		line: string;
		delta?: string | null;
		deltaUp?: boolean;
		until?: string | null;
		wide?: boolean;
		showClose?: boolean;
		onclose: () => void;
		children?: Snippet;
	} = $props();

	const topBorder = $derived(tone === 'win' ? 'border-t-success' : tone === 'lose' ? 'border-t-error' : 'border-t-primary');
</script>

<div class="modal modal-open" role="dialog" aria-modal="true" aria-label={title}>
	<div
		class="modal-box border-base-300 flex flex-col border border-t-4 text-center {topBorder} {wide
			? 'max-w-[440px] px-5 pt-5.5 pb-5'
			: 'max-w-[360px] px-6 pt-7 pb-6'}"
	>
		<div
			class="animate-pop-in bg-primary/14 border-primary/35 text-primary mx-auto mb-3 grid place-items-center rounded-full border {wide
				? 'size-14 text-[26px]'
				: 'size-19 text-[34px]'}"
		>
			<i class="fas {icon}"></i>
		</div>

		<div class="text-base-content font-extrabold tracking-tight {wide ? 'text-lg' : 'text-[22px]'}">{title}</div>

		{#if delta}
			<div class="mt-2 text-[26px] font-extrabold tabular-nums {deltaUp ? 'text-success' : 'text-error'}">{delta}</div>
		{/if}

		<p class="text-base-content/60 mt-2.5 leading-relaxed {wide ? 'text-xs' : 'text-[13.5px]'}">{line}</p>

		{#if children}{@render children()}{/if}

		{#if until}
			<div class="badge bg-primary/10 border-primary/20 text-primary mx-auto mt-3.5 gap-1.5 text-xs font-bold">
				<i class="fas fa-clock"></i>Active until {until}
			</div>
		{/if}

		{#if showClose}
			<div class="modal-action justify-center">
				<button type="button" class="btn btn-primary rounded-full px-6 font-bold" onclick={onclose}>
					<i class="fas fa-check"></i>Done
				</button>
			</div>
		{/if}
	</div>
	<button type="button" class="modal-backdrop bg-base-content/45 backdrop-blur-[4px]" onclick={onclose}>close</button>
</div>
