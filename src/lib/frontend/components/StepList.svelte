<script lang="ts">
	type Step = { icon: string; title: string; desc: string };

	let { steps }: { steps: Step[] } = $props();
</script>

<div class="g-steps flex flex-wrap gap-3">
	{#each steps as s, i}
		<div class="g-step relative overflow-hidden rounded-2xl px-4 pt-5 pb-4" style="--d: {i * 80}ms">
			<span class="g-step-num text-4xl">{i + 1}</span>
			<span class="g-step-ic text-yacht-teal mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-base">
				<i class="fas {s.icon}"></i>
			</span>
			<h3>{s.title}</h3>
			<p>{s.desc}</p>
		</div>
	{/each}
</div>
