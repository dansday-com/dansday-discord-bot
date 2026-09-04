<script lang="ts">
	import { toneVars, type Tone } from './tones';

	let {
		icon,
		label,
		value,
		tone = 'sky'
	}: {
		icon: string;
		label: string;
		value: string;
		tone?: Tone;
	} = $props();
</script>

<div class="card border-base-300 bg-base-100 h-full border shadow-sm" style={toneVars(tone)}>
	<div class="card-body gap-1.5 p-3.5 sm:gap-2 sm:p-5">
		<div class="flex items-center gap-2">
			<span class="grid size-8 shrink-0 place-items-center rounded-lg bg-(--tone-soft) text-sm text-(--tone)">
				<i class="fas {icon}"></i>
			</span>
			<span class="text-base-content/55 min-w-0 truncate text-[11px] font-medium sm:text-xs">{label}</span>
		</div>
		<div class="text-base-content text-xl font-extrabold tracking-tight break-all tabular-nums sm:text-3xl">{value}</div>
	</div>
</div>
