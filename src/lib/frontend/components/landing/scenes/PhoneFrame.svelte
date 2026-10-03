<script lang="ts">
	import type { Snippet } from 'svelte';

	let { dark = true, children }: { dark?: boolean; children: Snippet } = $props();
</script>

<div
	class="w-[min(340px,100%)] rounded-[46px] bg-[#0c0c0f] p-[9px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
	aria-hidden="true"
>
	<div class="relative flex h-[640px] flex-col overflow-hidden rounded-[38px] {dark ? 'bg-ash-900 text-white' : 'bg-base-200 text-base-content'}">
		<div class="relative flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold">
			<span class="tabular-nums">9:41</span>
			<span class="absolute top-2.5 left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"></span>
			<span class="flex items-center gap-1.5 text-[11px]">
				<i class="fas fa-signal"></i><i class="fas fa-wifi"></i><i class="fas fa-battery-full text-[13px]"></i>
			</span>
		</div>
		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
		<div class="flex h-6 shrink-0 items-center justify-center">
			<span class="h-1 w-28 rounded-full {dark ? 'bg-white/45' : 'bg-base-content/40'}"></span>
		</div>
	</div>
</div>
