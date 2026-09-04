<script lang="ts">
	let { steps }: { steps: { icon: string; title: string; desc: string }[] } = $props();
</script>

<div class="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
	{#each steps as s, i}
		<div class="card border-base-300 bg-base-100 relative overflow-hidden border px-4 pt-4.5 pb-4 shadow-sm">
			<span class="text-primary/12 absolute -top-2.5 right-2 text-[52px] leading-none font-black">{i + 1}</span>
			<span class="bg-primary/14 text-primary mb-2.5 inline-grid size-9.5 place-items-center rounded-xl text-base">
				<i class="fas {s.icon}"></i>
			</span>
			<h3 class="text-base-content mb-1 text-sm font-bold">{s.title}</h3>
			<p class="text-base-content/60 text-[12.5px] leading-relaxed">{s.desc}</p>
		</div>
	{/each}
</div>
