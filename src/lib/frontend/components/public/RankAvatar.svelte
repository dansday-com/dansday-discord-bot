<script lang="ts">
	import { initial, rankStyle } from './ranks';

	let {
		src = null,
		name,
		size = 56,
		rank = null,
		badge = false
	}: {
		src?: string | null;
		name: string;
		size?: number;
		rank?: number | null;
		badge?: boolean;
	} = $props();

	const style = $derived(rankStyle(rank));
	const ringStyle = $derived(
		style
			? `background: conic-gradient(from 0deg, ${style.color}, transparent 60%, ${style.color}); box-shadow: 0 0 20px ${style.glow}, 0 0 40px ${style.glow};`
			: 'background: conic-gradient(from 220deg, var(--color-secondary), var(--color-primary), var(--color-accent), var(--color-secondary)); box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 20%, transparent);'
	);
</script>

<div class="relative shrink-0">
	<div class="rounded-full p-0.75" style="{ringStyle} width: {size + 6}px; height: {size + 6}px;">
		<div class="bg-base-300 border-base-100 size-full overflow-hidden rounded-full border-2">
			{#if src}
				<img {src} alt={name} class="size-full object-cover" loading="lazy" />
			{:else}
				<div
					class="from-base-300 to-base-100 text-primary/90 grid size-full place-items-center bg-linear-to-br font-extrabold"
					style="font-size: {Math.round(size * 0.39)}px"
				>
					{initial(name)}
				</div>
			{/if}
		</div>
	</div>

	{#if badge && style && rank != null}
		<span
			class="border-base-100 absolute -right-1 -bottom-1 grid size-5.5 place-items-center rounded-full border-2 text-[10px] font-black shadow-sm"
			style="background: {style.gradient}; color: #111;"
		>
			{rank}
		</span>
	{/if}
</div>
