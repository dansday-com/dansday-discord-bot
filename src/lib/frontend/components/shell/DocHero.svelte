<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal } from './reveal';

	let {
		icon,
		title,
		lead,
		actions
	}: {
		icon: string;
		title: string;
		lead: string;
		actions?: Snippet;
	} = $props();
</script>

<header class="translate-y-5 text-center opacity-0 transition-all duration-500 ease-out" use:reveal>
	<div
		class="from-primary animate-badge-float mx-auto mb-4 grid size-16 place-items-center rounded-[20px] bg-linear-to-br to-[#a52a0b] text-[28px] text-white shadow-[0_16px_36px_-14px_rgba(165,42,11,0.6)]"
	>
		<i class="fas {icon}"></i>
	</div>
	<h1 class="text-base-content mb-2 text-[clamp(22px,4vw,32px)] font-extrabold">{title}</h1>
	<p class="text-base-content/60 mx-auto max-w-[540px] text-[14.5px] leading-relaxed">{lead}</p>
	{#if actions}
		<div class="mt-4 flex flex-wrap justify-center gap-2">{@render actions()}</div>
	{/if}
</header>
