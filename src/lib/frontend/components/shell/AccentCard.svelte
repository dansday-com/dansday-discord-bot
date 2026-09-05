<script lang="ts">
	let {
		icon,
		accent,
		title,
		text,
		size = 'card'
	}: {
		icon: string;
		accent: string;
		title?: string;
		text: string;
		size?: 'card' | 'tip';
	} = $props();
</script>

<div
	class="border-base-300 bg-base-100 flex items-center gap-3 rounded-2xl border border-l-[3px] px-4 py-3.5 {size === 'card' ? 'min-w-0 flex-[1_1_240px]' : ''}"
	style="--ac: {accent}; border-left-color: var(--ac);"
>
	<span
		class="grid shrink-0 place-items-center rounded-xl text-(--ac) {size === 'card' ? 'size-10.5 text-lg' : 'size-9 text-[15px]'}"
		style="background: color-mix(in srgb, var(--ac) 14%, transparent);"
	>
		<i class="fas {icon}"></i>
	</span>
	<div class="min-w-0">
		{#if title}
			<h3 class="text-base-content mb-0.5 text-[13.5px] font-bold">{title}</h3>
		{/if}
		<p class="text-base-content/60 text-xs leading-relaxed">{text}</p>
	</div>
</div>
