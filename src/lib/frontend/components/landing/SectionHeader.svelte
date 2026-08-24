<script lang="ts">
	let {
		title,
		desc
	}: {
		title: string;
		desc?: string;
	} = $props();
</script>

<div class="mb-6 text-center sm:mb-7">
	<h2 class="text-base-content m-0 text-[22px] font-extrabold tracking-tight sm:text-[26px]">{title}</h2>
	{#if desc}
		<p class="text-base-content/60 mx-auto mt-2 max-w-2xl text-sm leading-relaxed">{desc}</p>
	{/if}
</div>
