<script lang="ts">
	import { BRAND_TONE, type BrandTone } from './tones';

	let {
		icon,
		title,
		desc,
		tone = 'teal'
	}: {
		icon: string;
		title: string;
		desc: string;
		tone?: BrandTone;
	} = $props();
</script>

<div class="card border-base-300 bg-base-100 hover:border-primary/40 h-full border shadow-sm transition-colors">
	<div class="card-body gap-0 p-5 sm:p-6">
		<span class="mb-3.5 grid size-10 shrink-0 place-items-center rounded-xl text-lg sm:size-[42px] {BRAND_TONE[tone]}">
			<i class="fas {icon}"></i>
		</span>
		<h3 class="card-title text-base-content mb-1.5 text-[15px] font-bold">{title}</h3>
		<p class="text-base-content/60 text-[13px] leading-relaxed">{desc}</p>
	</div>
</div>
