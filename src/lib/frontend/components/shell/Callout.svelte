<script lang="ts">
	let {
		icon,
		accent,
		title,
		text
	}: {
		icon: string;
		accent: string;
		title: string;
		text: string;
	} = $props();
</script>

<div
	class="mt-3.5 flex items-center gap-3.5 rounded-[18px] border bg-linear-[120deg] p-4.5"
	style="--ac: {accent}; background-image: linear-gradient(120deg, color-mix(in srgb, var(--ac) 12%, transparent), transparent); border-color: color-mix(in srgb, var(--ac) 30%, transparent);"
>
	<span class="grid size-12.5 shrink-0 place-items-center rounded-[14px] text-[22px] text-white" style="background: var(--ac);">
		<i class="fas {icon}"></i>
	</span>
	<div class="min-w-0">
		<h3 class="text-base-content mb-0.5 text-sm font-bold">{title}</h3>
		<p class="text-base-content/60 text-[13px] leading-relaxed">{text}</p>
	</div>
</div>
