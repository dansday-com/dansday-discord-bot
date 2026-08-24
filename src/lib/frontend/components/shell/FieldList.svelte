<script lang="ts">
	let {
		fields
	}: {
		fields: { label: string; desc: string; req?: string }[];
	} = $props();
</script>

<div class="border-base-300 flex flex-col gap-px overflow-hidden rounded-xl border">
	{#each fields as f}
		<div class="bg-primary/4 flex flex-col gap-[3px] px-3 py-2.5">
			<span class="text-base-content inline-flex items-center gap-2 text-[12.5px] font-extrabold">
				{f.label}
				{#if f.req}
					<span
						class="badge badge-xs h-auto border-none px-1.5 py-0.5 text-[9px] font-bold uppercase {f.req === 'optional'
							? 'bg-base-300 text-base-content/60'
							: 'bg-primary/15 text-primary'}"
					>
						{f.req}
					</span>
				{/if}
			</span>
			<span class="text-base-content/60 text-[12.5px] leading-relaxed">{f.desc}</span>
		</div>
	{/each}
</div>
