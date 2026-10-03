<script lang="ts">
	import type { Snippet } from 'svelte';

	let { url, children }: { url: string; children: Snippet } = $props();
</script>

<div
	class="border-ash-950 bg-ash-950 flex h-[490px] flex-col overflow-hidden rounded-xl border shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] sm:h-[530px]"
	aria-hidden="true"
>
	<div class="flex h-11 shrink-0 items-center gap-3 px-4">
		<span class="flex gap-1.5"
			><i class="size-3 rounded-full bg-[#ff5f57]"></i><i class="size-3 rounded-full bg-[#febc2e]"></i><i class="size-3 rounded-full bg-[#28c840]"></i></span
		>
		<span class="bg-ash-800 text-ash-200 mx-auto flex h-7 w-full max-w-md min-w-0 items-center justify-center gap-2 rounded-md px-3 text-[12px]">
			<i class="fas fa-lock text-ash-300 text-[10px]"></i><span class="truncate">{url}</span>
		</span>
		<span class="w-[52px] shrink-0"></span>
	</div>
	<div class="relative min-h-0 flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
