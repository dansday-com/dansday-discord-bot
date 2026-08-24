<script lang="ts">
	let {
		href,
		name,
		icon = null
	}: {
		href: string;
		name: string;
		icon?: string | null;
	} = $props();
</script>

<a {href} class="card border-base-300 bg-base-100 hover:border-primary/40 flex-row items-center gap-3 border p-3.5 shadow-sm transition-colors sm:p-4">
	<span class="border-base-300 bg-base-100 grid size-[42px] shrink-0 place-items-center overflow-hidden rounded-xl border">
		{#if icon}
			<img src={icon} alt={name} loading="lazy" width="42" height="42" class="size-full object-cover" />
		{:else}
			<i class="fas fa-server text-base-content/50 text-lg"></i>
		{/if}
	</span>

	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-base-content truncate text-sm font-bold">{name}</span>
		<span class="badge badge-ghost badge-sm text-base-content/60 h-auto gap-1.5 border-none px-0 text-[11px]">
			<span class="bg-primary size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden="true"></span>
			Live public statistics
		</span>
	</span>

	<i class="fas fa-chevron-right text-base-content/30 shrink-0 text-[13px]"></i>
</a>
