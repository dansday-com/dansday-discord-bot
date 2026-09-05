<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		icon,
		accent,
		title,
		what,
		children
	}: {
		id?: string;
		icon: string;
		accent: string;
		title: string;
		what: string;
		children: Snippet;
	} = $props();
</script>

<article {id} class="border-base-300 bg-base-100 rounded-2xl border border-l-[3px] p-4 shadow-sm" style="--ac: {accent}; border-left-color: var(--ac);">
	<div class="mb-3.5 flex items-start gap-2.75">
		<span
			class="inline-grid size-9.5 shrink-0 place-items-center rounded-xl text-base text-(--ac)"
			style="background: color-mix(in srgb, var(--ac) 13%, transparent);"
		>
			<i class="fas {icon}"></i>
		</span>
		<div class="min-w-0">
			<h3 class="text-base-content text-sm font-bold">{title}</h3>
			<p class="text-base-content/60 mt-0.5 text-[12.5px] leading-relaxed">{what}</p>
		</div>
	</div>
	{@render children()}
</article>
