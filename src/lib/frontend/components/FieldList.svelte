<script lang="ts">
	import type { Snippet } from 'svelte';

	type Field = { label: string; desc: string; req?: string };

	let {
		fields,
		tag
	}: {
		fields: Field[];
		tag?: Snippet<[Field]>;
	} = $props();
</script>

<div class="g-fieldlist flex flex-col gap-0.5 overflow-hidden rounded-xl">
	{#each fields as f}
		<div class="g-field flex flex-col gap-1 px-3 py-3 lg:flex-row lg:gap-3">
			<span class="g-field-key text-lb-text text-base font-extrabold lg:max-w-60 lg:flex-[0_0_38%]">
				{f.label}{#if tag}{@render tag(f)}{/if}
			</span>
			<span class="g-field-val text-lb-text-muted flex-1 text-base">{f.desc}</span>
		</div>
	{/each}
</div>
