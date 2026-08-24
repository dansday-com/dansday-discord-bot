<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		eyebrow,
		icon,
		image = null,
		rank,
		accent,
		round = false,
		trailing,
		children
	}: {
		title: string;
		subtitle?: string;
		eyebrow?: string;
		icon?: string;
		image?: string | null;
		rank?: number;
		accent?: string;
		round?: boolean;
		trailing?: Snippet;
		children?: Snippet;
	} = $props();

	const tinted = $derived(!!accent);
</script>

<div
	class="flex items-center gap-3 rounded-xl px-3 py-2.5 {tinted ? 'border' : 'border-base-300 bg-base-200/50 border'}"
	style={tinted ? `background: color-mix(in srgb, ${accent} 10%, transparent); border-color: color-mix(in srgb, ${accent} 28%, transparent);` : undefined}
>
	{#if rank !== undefined}
		<span class="text-base-content/40 w-4 shrink-0 text-center text-xs font-bold tabular-nums">{rank}</span>
	{/if}

	{#if image}
		<img
			class="border-base-300 size-9 shrink-0 rounded-full border object-cover"
			src={image}
			alt=""
			loading="lazy"
			onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
		/>
	{:else if icon}
		<span
			class="grid size-9 shrink-0 place-items-center text-[0.95rem] {round ? 'rounded-full' : 'rounded-xl'} {accent
				? 'text-white'
				: 'bg-[var(--tone-soft)] text-[var(--tone)]'}"
			style={accent ? `background: ${accent};` : undefined}
		>
			<i class="fas {icon}"></i>
		</span>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col gap-0.5">
		{#if eyebrow}
			<span class="text-base-content/45 text-[9px] font-semibold tracking-[0.08em] uppercase">{eyebrow}</span>
		{/if}
		<span class="text-base-content min-w-0 truncate text-sm font-bold">{title}</span>
		{#if subtitle}
			<span class="text-base-content/55 min-w-0 truncate text-[11px] font-semibold tabular-nums">{subtitle}</span>
		{/if}
		{#if children}{@render children()}{/if}
	</div>

	{#if trailing}
		<div class="shrink-0 text-right">{@render trailing()}</div>
	{/if}
</div>
