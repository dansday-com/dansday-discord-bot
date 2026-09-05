<script lang="ts">
	let {
		chart,
		id,
		ariaLabel
	}: {
		chart: { width: number; height: number; line: string; area: string; zeroY: number; up: boolean };
		id: string;
		ariaLabel: string;
	} = $props();

	const stroke = $derived(chart.up ? 'var(--color-success)' : 'var(--color-error)');
</script>

<svg class="block h-24 w-full" viewBox="0 0 {chart.width} {chart.height}" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
	<defs>
		<linearGradient {id} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={stroke} stop-opacity="0.35" />
			<stop offset="100%" stop-color={stroke} stop-opacity="0" />
		</linearGradient>
	</defs>
	<line
		x1="0"
		y1={chart.zeroY}
		x2={chart.width}
		y2={chart.zeroY}
		class="stroke-base-content/20"
		stroke-width="1"
		stroke-dasharray="3 3"
		vector-effect="non-scaling-stroke"
	/>
	<path d={chart.area} fill="url(#{id})" />
	<path d={chart.line} fill="none" {stroke} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
