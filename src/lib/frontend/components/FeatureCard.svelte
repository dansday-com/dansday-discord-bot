<script lang="ts">
	type Tone = 'teal' | 'brick' | 'stone';

	let {
		icon,
		tone = 'teal' as Tone,
		title,
		desc
	}: {
		icon: string;
		tone?: Tone;
		title: string;
		desc: string;
	} = $props();

	const toneClass: Record<Tone, string> = {
		teal: 'bg-chili-hot/12 text-chili-hot',
		brick: 'bg-chili-brick/10 text-chili-brick',
		stone: 'bg-yacht-stone/25 text-yacht-stone'
	};
</script>

<div
	class="bg-chili-surface-elevated border-lb-border hover:border-chili-hot/28 rounded-2xl border p-5 shadow-[0_4px_20px_var(--color-lb-shadow)] transition-transform duration-150 hover:-translate-y-0.5"
>
	<div class="mb-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg {toneClass[tone]}">
		<i class="fas {icon}"></i>
	</div>
	<h3 class="text-lb-text m-0 mb-2 text-base font-bold">{title}</h3>
	<p class="text-lb-text-muted m-0 text-base">{desc}</p>
</div>
