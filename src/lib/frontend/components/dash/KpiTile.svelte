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

<div class="card border-base-300 bg-base-100 border shadow-sm" style={toneVars(tone)}>
	<div class="card-body gap-2 p-4 sm:p-5">
		<div class="flex items-center gap-2">
			<span class="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--tone-soft)] text-sm text-[var(--tone)]">
				<i class="fas {icon}"></i>
			</span>
			<span class="text-base-content/55 min-w-0 truncate text-xs font-medium">{label}</span>
		</div>
		<div class="text-base-content text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">{value}</div>
	</div>
</div>
